import { performance } from 'node:perf_hooks';
const url = process.argv[2] || 'http://127.0.0.1:3001/api/public/tournaments/campus-champions-2026';
const durations = [];
let failures = 0;
await Promise.all(Array.from({ length: 100 }, async () => {
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); await response.arrayBuffer(); if (!response.ok) failures++; }
    catch { failures++; }
    durations.push(performance.now() - start);
  }
}));
durations.sort((a, b) => a - b);
const result = { concurrentClients: 100, requests: durations.length, failures, medianMs: +durations[Math.floor(durations.length * .5)].toFixed(1), p95Ms: +durations[Math.ceil(durations.length * .95) - 1].toFixed(1), maxMs: +durations.at(-1).toFixed(1), targetP95Ms: 2000 };
console.log(JSON.stringify(result, null, 2));
if (failures || result.p95Ms > 2000) process.exitCode = 1;
