import { registerHandler } from '../index';

function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

registerHandler('prime_sieve', async (payload) => {
  const limit = (payload.limit as number) || 10000;
  const primes: number[] = [];
  
  for (let i = 2; i <= limit; i++) {
    if (isPrime(i)) primes.push(i);
  }
  
  return {
    limit,
    count: primes.length,
    primes: primes.slice(0, 100),
    hasMore: primes.length > 100,
  };
});

registerHandler('fibonacci', async (payload) => {
  const n = (payload.n as number) || 50;
  
  function fib(n: number): bigint {
    if (n <= 1) return BigInt(n);
    let a = 0n, b = 1n;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }
  
  const startTime = Date.now();
  const result = fib(n);
  const duration = Date.now() - startTime;
  
  return {
    n,
    result: result.toString(),
    digits: result.toString().length,
    durationMs: duration,
  };
});

registerHandler('monte_carlo', async (payload) => {
  const iterations = (payload.iterations as number) || 100000;
  let inside = 0;
  
  for (let i = 0; i < iterations; i++) {
    const x = Math.random();
    const y = Math.random();
    if (x * x + y * y <= 1) inside++;
  }
  
  const pi = (inside / iterations) * 4;
  
  return {
    iterations,
    insideCircle: inside,
    estimatedPi: pi,
    actualPi: Math.PI,
    error: Math.abs(pi - Math.PI),
  };
});

registerHandler('sleep', async (payload) => {
  const duration = (payload.duration as number) || 1000;
  await new Promise(r => setTimeout(r, duration));
  
  return {
    sleptFor: duration,
    wokeUp: true,
  };
});

registerHandler('random_fail', async (payload) => {
  const probability = (payload.probability as number) || 0.5;
  const shouldFail = Math.random() < probability;
  
  if (shouldFail) {
    throw new Error(`Random failure (${(probability * 100).toFixed(0)}% chance)`);
  }
  
  return {
    success: true,
    probability,
    result: 'Lucky! No failure this time.',
  };
});

registerHandler('random_timeout', async (payload) => {
  const maxDuration = (payload.maxDuration as number) || 5000;
  const duration = Math.random() * maxDuration;
  
  if (duration > 3000) {
    throw new Error(`Job took too long: ${duration.toFixed(0)}ms (limit 3000ms)`);
  }
  
  await new Promise(r => setTimeout(r, duration));
  
  return {
    duration: duration.toFixed(0),
    completed: true,
  };
});