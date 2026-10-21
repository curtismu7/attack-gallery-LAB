// Starts the real server (loopback, free port) for the UI tests so they run against the real engine; stops it after.
import { spawn } from 'node:child_process';

const PORT = 5193;
export default async function setup() {
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd: new URL('../../', import.meta.url).pathname, env: { ...process.env, GALLERY_HOST: '127.0.0.1', GALLERY_PORT: String(PORT) }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 150)); }
  process.env.GALLERY_TEST_BASE = base;
  return () => child.kill();
}
