import { query, queryOne, execute } from './db';
import { WebSocketServer, WebSocket } from 'ws';

interface JobMessage {
  job_id: number;
  job_type: string;
  payload: Record<string, unknown>;
}

interface WorkerConfig {
  workerId: string;
  pollInterval: number;
  batchSize: number;
  wsPort: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  workerId: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  pollInterval: 1000,
  batchSize: 1,
  wsPort: parseInt(process.env.WS_PORT || '3001'),
};

const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<unknown>>();

export function registerHandler(jobType: string, handler: (payload: Record<string, unknown>) => Promise<unknown>) {
  if (!handlers) {
    console.warn(`Worker not initialized, queuing handler for: ${jobType}`);
    pendingHandlers.push({ jobType, handler });
    return;
  }
  handlers.set(jobType, handler);
  console.log(`Registered handler for: ${jobType}`);
}

const pendingHandlers: { jobType: string; handler: (payload: Record<string, unknown>) => Promise<unknown> }[] = [];

function flushPendingHandlers() {
  for (const { jobType, handler } of pendingHandlers) {
    handlers.set(jobType, handler);
  }
  pendingHandlers.length = 0;
}

let config = { ...DEFAULT_CONFIG };
let running = true;
let wsServer: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function configureWorker(cfg: Partial<WorkerConfig>) {
  config = { ...config, ...cfg };
  console.log('Worker config updated:', config);
}

export function stopWorker() {
  running = false;
  if (wsServer) {
    wsServer.close();
  }
}

async function registerWorker() {
  const existing = await queryOne<{ worker_id: string }>(
    'SELECT worker_id FROM workers WHERE worker_id = $1',
    [config.workerId]
  );

  if (!existing) {
    await execute(
      'INSERT INTO workers (worker_id, status, jobs_processed) VALUES ($1, $1, $2)',
      [config.workerId, 0]
    );
  }
}

async function heartbeat() {
  await execute(
    'UPDATE workers SET last_heartbeat = NOW() WHERE worker_id = $1',
    [config.workerId]
  );

  broadcast({
    type: 'worker_heartbeat',
    workerId: config.workerId,
    timestamp: new Date().toISOString(),
  });
}

async function markWorkerBusy(jobId: number) {
  await execute(
    'UPDATE workers SET status = $1, current_job_id = $2 WHERE worker_id = $3',
    ['busy', jobId, config.workerId]
  );
}

async function markWorkerIdle() {
  await execute(
    'UPDATE workers SET status = $1, current_job_id = NULL WHERE worker_id = $2',
    ['idle', config.workerId]
  );
}

async function incrementJobsProcessed() {
  await execute(
    'UPDATE workers SET jobs_processed = jobs_processed + 1 WHERE worker_id = $1',
    [config.workerId]
  );
}

async function pollJobs(): Promise<JobMessage[]> {
  try {
    const result = await query<{ message: JobMessage }>(
      "SELECT * FROM pgmq.pop('dymunim_jobs', $1)",
      [config.batchSize]
    );
    return result.map(r => r.message);
  } catch (err) {
    console.error('Poll error:', err);
    return [];
  }
}

async function processJob(message: JobMessage) {
  const { job_id, job_type, payload } = message;

  console.log(`Processing job ${job_id} (${job_type})`);
  
  await execute(
    "UPDATE jobs_state SET status = 'running', attempts = attempts + 1, updated_at = NOW() WHERE job_id = $1",
    [job_id]
  );

  const handler = handlers.get(job_type);
  
  if (!handler) {
    console.error(`No handler for job type: ${job_type}`);
    await execute(
      "UPDATE jobs_state SET status = 'failed', error = $1, updated_at = NOW() WHERE job_id = $2",
      [`No handler for job type: ${job_type}`, job_id]
    );
    return;
  }

  try {
    const startTime = Date.now();
    const result = await handler(payload);
    const duration = Date.now() - startTime;

    await execute(
      "UPDATE jobs_state SET status = 'completed', result = $1, updated_at = NOW() WHERE job_id = $2",
      [JSON.stringify(result), job_id]
    );

    console.log(`Job ${job_id} completed in ${duration}ms`);
    
    broadcast({
      type: 'job_completed',
      jobId: job_id,
      jobType: job_type,
      duration,
      result,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Job ${job_id} failed:`, error);
    
    await execute(
      "UPDATE jobs_state SET status = 'failed', error = $1, updated_at = NOW() WHERE job_id = $2",
      [error, job_id]
    );

    broadcast({
      type: 'job_failed',
      jobId: job_id,
      jobType: job_type,
      error,
    });
  }

  await incrementJobsProcessed();
}

function broadcast(message: unknown) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

async function startWebSocketServer() {
  wsServer = new WebSocketServer({ port: config.wsPort });
  
  wsServer.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWsMessage(ws, msg);
      } catch (e) {
        console.error('Invalid WS message:', e);
      }
    });
  });

  console.log(`WebSocket server on port ${config.wsPort}`);
}

function handleWsMessage(ws: WebSocket, msg: { type: string; payload?: unknown }) {
  switch (msg.type) {
    case 'stop':
      stopWorker();
      ws.send(JSON.stringify({ type: 'stopped' }));
      break;
    case 'status':
      ws.send(JSON.stringify({ 
        type: 'status', 
        workerId: config.workerId,
        running 
      }));
      break;
  }
}

export async function startWorker() {
  console.log(`Starting worker: ${config.workerId}`);
  
  flushPendingHandlers();
  await registerWorker();
  await startWebSocketServer();

  const heartbeatInterval = setInterval(heartbeat, 5000);
  
  while (running) {
    try {
      const jobs = await pollJobs();
      
      if (jobs.length > 0) {
        for (const job of jobs) {
          await markWorkerBusy(job.job_id);
          await processJob(job);
          await markWorkerIdle();
        }
      } else {
        await new Promise(r => setTimeout(r, config.pollInterval));
      }
    } catch (err) {
      console.error('Worker error:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  clearInterval(heartbeatInterval);
  await execute('DELETE FROM workers WHERE worker_id = $1', [config.workerId]);
  console.log('Worker stopped');
}

if (import.meta.main) {
  // Import handlers after worker starts
  import('./handlers/compute').then(() => import('./handlers/data')).then(() => import('./handlers/chaos'));
  startWorker().catch(console.error);
}