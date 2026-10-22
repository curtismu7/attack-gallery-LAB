// demo-health/1, exactly. The check runs in the background; a request never runs it.
import express from 'express';
import { selfCheck } from './checks.js';

const DEMO = { id: 'attack-gallery', name: 'Agent Attack Gallery', version: '0.1.0' };

export function createHealth({ mockOnly = false } = {}) {
  let last = { state: 'unknown', at: null };
  async function refresh() {
    try { last = { state: (await selfCheck()).ok ? 'ready' : 'broken', at: new Date().toISOString() }; } catch { last = { state: 'unknown', at: new Date().toISOString() }; }
  }
  const ready = refresh();
  const timer = setInterval(refresh, 60_000); timer.unref();
  const router = express.Router();
  router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ schema: 'demo-health/1', at: last.at || new Date().toISOString(), state: last.state, runtime: 'offline', ...(mockOnly ? { mode: 'mock-only' } : {}), demo: DEMO });
  });
  return { router, ready, stop: () => clearInterval(timer) };
}
