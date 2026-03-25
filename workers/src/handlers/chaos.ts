import { registerHandler } from '../index';

registerHandler('chaos_mode', async (payload) => {
  const chaosType = (payload.chaosType as string) || 'random';
  const intensity = (payload.intensity as number) || 0.5;
  
  const rng = Math.random();
  
  switch (chaosType) {
    case 'fail':
      if (rng < intensity) {
        throw new Error(`Chaos: Random failure (intensity: ${intensity})`);
      }
      break;
      
    case 'slow':
      const delay = (payload.maxDelay as number) || 5000;
      const actualDelay = delay * intensity * rng;
      await new Promise(r => setTimeout(r, actualDelay));
      break;
      
    case 'memory':
      const size = (payload.size as number) || 1000000;
      const arr = new Array(size);
      for (let i = 0; i < size; i++) {
        arr[i] = Math.random();
      }
      return { allocated: size, sum: arr.reduce((a, b) => a + b, 0) };
      
    case 'cpu':
      const iterations = (payload.iterations as number) || 10000000;
      let sum = 0;
      for (let i = 0; i < iterations; i++) {
        sum += Math.sqrt(i) * Math.sin(i);
      }
      return { iterations, result: sum };
      
    case 'random':
    default:
      if (rng < 0.2 * intensity) {
        throw new Error('Chaos: Random exception');
      } else if (rng < 0.4 * intensity) {
        const delay = 2000 * intensity * rng;
        await new Promise(r => setTimeout(r, delay));
      }
      break;
  }
  
  return {
    chaosType,
    intensity,
    survived: true,
    timestamp: new Date().toISOString(),
  };
});

registerHandler('game_of_life', async (payload) => {
  const width = (payload.width as number) || 50;
  const height = (payload.height as number) || 20;
  const generations = (payload.generations as number) || 10;
  const seed = (payload.seed as number) || Date.now();
  
  let seedValue = seed;
  const random = () => {
    const x = Math.sin(seedValue++) * 10000;
    return x - Math.floor(x);
  };
  
  let grid: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => random() > 0.7)
  );
  
  function countNeighbors(g: boolean[][], x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = (y + dy + height) % height;
        const nx = (x + dx + width) % width;
        if (g[ny][nx]) count++;
      }
    }
    return count;
  }
  
  function step(g: boolean[][]): boolean[][] {
    return g.map((row, y) =>
      row.map((cell, x) => {
        const neighbors = countNeighbors(g, x, y);
        return (cell && (neighbors === 2 || neighbors === 3)) ||
               (!cell && neighbors === 3);
      })
    );
  }
  
  const history: string[] = [];
  
  for (let gen = 0; gen < generations; gen++) {
    const snapshot = grid.map(row =>
      row.map(cell => cell ? '█' : ' ').join('')
    ).join('\n');
    history.push(snapshot);
    grid = step(grid);
  }
  
  const finalLive = grid.flat().filter(Boolean).length;
  
  return {
    width,
    height,
    generations,
    finalLive,
    totalHistory: history.length,
    finalGrid: grid.map(row => row.map(cell => cell ? '█' : ' ').join('')).join('\n'),
  };
});