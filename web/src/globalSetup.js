// Starts the real server (loopback, OS-assigned port) for the UI tests so they run against the real engine; stops it after.
// Port 0 means a previous run's lingering server can never be mistaken for this one; the bound port is read from the server's own startup line.
// If the server dies mid-run (seen under extreme machine load: ECONNREFUSED on its port, no crash output, so an external kill) it is restarted on the same port,
// and the cause is logged. helpers.js retries refused connections meanwhile.
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const cwd = new URL('../../', import.meta.url).pathname;
const MAX_RESTARTS = 5;

function launch(port) {
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd, env: { ...process.env, GALLERY_HOST: '127.0.0.1', GALLERY_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  const stopped = once(child, 'exit');
  const listening = new Promise((resolve) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; const m = out.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/); if (m) resolve(Number(m[1])); });
  });
  return { child, stopped, listening };
}

export default async function setup() {
  let current = launch(0); let stopping = false; let restarts = 0;
  const exited = current.stopped.then(([code, signal]) => { throw new Error(`gallery server exited before it was ready (code ${code}, signal ${signal})`); });
  exited.catch(() => {}); // only meaningful while racing for readiness
  const port = await Promise.race([current.listening, exited, new Promise((_, rej) => setTimeout(() => rej(new Error('gallery server did not report a port within 15s')), 15_000))]).catch((e) => { current.child.kill(); throw e; });
  const base = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let i = 0; i < 60 && !healthy; i++) { try { healthy = (await fetch(`${base}/api/health`)).ok; } catch { /* not up yet */ } if (!healthy) await new Promise((r) => setTimeout(r, 150)); }
  if (!healthy) { current.child.kill(); throw new Error(`gallery server at ${base} never answered /api/health`); }

  const watch = (run) => run.stopped.then(([code, signal]) => {
    if (stopping) return;
    console.error(`[globalSetup] gallery server on ${base} exited unexpectedly (code ${code}, signal ${signal}); restart ${restarts + 1}/${MAX_RESTARTS}`);
    if (++restarts > MAX_RESTARTS) return;
    current = launch(port); watch(current);
  });
  watch(current);
  process.env.GALLERY_TEST_BASE = base;
  return async () => { stopping = true; current.child.kill(); await current.stopped; };
}
