import { registerHandler } from '../index';

registerHandler('json_transform', async (payload) => {
  const data = payload.data as Record<string, unknown>[];
  const operations = (payload.operations as string[]) || ['filter', 'sort'];
  
  let result = [...data];
  
  if (operations.includes('filter') && payload.filterKey && payload.filterValue !== undefined) {
    result = result.filter(item => item[payload.filterKey as string] === payload.filterValue);
  }
  
  if (operations.includes('sort') && payload.sortKey) {
    result.sort((a, b) => {
      const aVal = a[payload.sortKey as string];
      const bVal = b[payload.sortKey as string];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });
  }
  
  if (operations.includes('group') && payload.groupBy) {
    const groups: Record<string, unknown[]> = {};
    for (const item of result) {
      const key = String(item[payload.groupBy as string]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    result = Object.entries(groups).map(([k, v]) => ({ key: k, items: v }));
  }
  
  return {
    originalLength: data?.length || 0,
    resultLength: result.length,
    operations,
    sample: result.slice(0, 5),
  };
});

registerHandler('word_count', async (payload) => {
  const text = (payload.text as string) || '';
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const wordFreq: Record<string, number> = {};
  
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  }
  
  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  return {
    totalWords: words.length,
    uniqueWords: Object.keys(wordFreq).length,
    topWords: Object.fromEntries(sorted),
    avgWordLength: words.reduce((a, w) => a + w.length, 0) / words.length || 0,
  };
});

registerHandler('sort_benchmark', async (payload) => {
  const size = (payload.size as number) || 10000;
  const algorithms = (payload.algorithms as string[]) || ['quick', 'merge', 'builtin'];
  
  const results: Record<string, { time: number; sorted: boolean }> = {};
  
  function isSorted(arr: number[]): boolean {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) return false;
    }
    return true;
  }
  
  function quickSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const middle = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...quickSort(left), ...middle, ...quickSort(right)];
  }
  
  function mergeSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid));
    const right = mergeSort(arr.slice(mid));
    const merged: number[] = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] <= right[j]) {
        merged.push(left[i++]);
      } else {
        merged.push(right[j++]);
      }
    }
    return [...merged, ...left.slice(i), ...right.slice(j)];
  }
  
  for (const algo of algorithms) {
    const data = Array.from({ length: size }, () => Math.random());
    const start = Date.now();
    let sorted: number[];
    
    switch (algo) {
      case 'quick':
        sorted = quickSort(data);
        break;
      case 'merge':
        sorted = mergeSort(data);
        break;
      case 'builtin':
        sorted = [...data].sort((a, b) => a - b);
        break;
      default:
        continue;
    }
    
    results[algo] = {
      time: Date.now() - start,
      sorted: isSorted(sorted),
    };
  }
  
  return {
    arraySize: size,
    algorithms: results,
  };
});

registerHandler('hash_data', async (payload) => {
  const data = (payload.data as string) || 'hello world';
  const algorithms = (payload.algorithms as string[]) || ['md5', 'sha1', 'sha256'];
  
  const results: Record<string, string> = {};
  
  async function hash(str: string, algo: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest(algo, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  for (const algo of algorithms) {
    try {
      results[algo] = await hash(data, algo);
    } catch {
      results[algo] = `Unsupported: ${algo}`;
    }
  }
  
  return {
    input: data.substring(0, 100),
    inputLength: data.length,
    hashes: results,
  };
});