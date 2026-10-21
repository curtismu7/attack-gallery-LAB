// Starts the real server (loopback, OS-assigned port) for the UI tests so they run against the real engine; stops it after.
// Port 0 means a previous run's lingering server can never be mistaken for this one; the bound port is read from the server's own startup line.
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export default async function setup() {
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd: new URL('../../', import.meta.url).pathname, env: { ...process.env, GALLERY_HOST: '127.0.0.1', GALLERY_PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  const stopped = once(child, 'exit');
  const exited = stopped.then(([code, signal]) => { throw new Error(`gallery server exited before it was ready (code ${code}, signal ${signal})`); });
  exited.catch(() => {}); // only meaningful while racing for readiness
  const listening = new Promise((resolve) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; const m = out.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/); if (m) resolve(Number(m[1])); });
  });
  const port = await Promise.race([listening, exited, new Promise((_, rej) => setTimeout(() => rej(new Error('gallery server did not report a port within 15s')), 15_000))]).catch((e) => { child.kill(); throw e; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 150)); }
  process.env.GALLERY_TEST_BASE = base;
  return async () => { child.kill(); await stopped; };
}
