const lat = process.env.LAT || '19.1363';
const lng = process.env.LNG || '72.8277';
const url = `http://127.0.0.1:4000/api/v1/discovery/products?lat=${lat}&lng=${lng}&limit=20`;
const samples = [];
const started = Date.now();
for (let index = 0; index < 50; index += 1) {
  const t0 = Date.now();
  const response = await fetch(url);
  samples.push(Date.now() - t0);
  if (!response.ok) process.stderr.write(`${response.status}\n`);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples.at(-1);
process.stdout.write(`requests 50 totalMs ${Date.now() - started} p95Ms ${p95}\n`);
