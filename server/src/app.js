import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ATTACKS, attackById } from './catalog.js';
import { CONTROLS, CONTROL_IDS, governed, ungoverned } from './policy.js';
import { runAttack } from './runner.js';
import { createKeyring } from './parties.js';
import { createHealth } from './health.js';

const MODES = ['ungoverned', 'governed', 'both'];
const publicAttack = ({ id, name, pack, goal, story, control, steps, refs, expected }) => ({ id, name, pack, goal, story, control, steps, references: refs, expected });

export async function createApp() {
  let keyring = await createKeyring();
  const app = express();
  const health = createHealth();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));
  app.use('/api/health', health.router);

  app.get('/api/catalog', (req, res) => res.json({ packs: [{ id: 1, name: 'Pack 1: token and identity attacks' }, { id: 2, name: 'Pack 2: MCP authorization attacks' }], attacks: ATTACKS.map(publicAttack) }));
  app.get('/api/controls', (req, res) => res.json({ controls: CONTROLS.map((c) => ({ id: c.id, name: c.name, does: c.does, error: c.error, status: c.status, message: c.message, references: c.refs, seed: c.seed, stops: ATTACKS.filter((a) => a.control === c.id).map((a) => a.id) })) }));
  app.post('/api/run', async (req, res, next) => {
    try {
      const { attackId, mode } = req.body || {};
      const attack = typeof attackId === 'string' ? attackById(attackId) : undefined;
      if (!attack) return res.status(400).json({ error: 'bad_request', message: 'attackId must be one of the catalog ids.', ids: ATTACKS.map((a) => a.id) });
      if (!MODES.includes(mode)) return res.status(400).json({ error: 'bad_request', message: `mode must be one of ${MODES.join(', ')}.` });
      const runs = [];
      if (mode !== 'governed') runs.push(await runAttack(attack, ungoverned(), keyring));
      if (mode !== 'ungoverned') runs.push(await runAttack(attack, governed(), keyring));
      res.json({ attackId, mode, control: attack.control, controls: CONTROL_IDS.length, runs });
    } catch (e) { next(e); }
  });
  app.post('/api/reset', async (req, res, next) => {
    try { keyring = await createKeyring(); res.json({ ok: true, keys: { good: keyring.good.kid, evil: keyring.evil.kid } }); } catch (e) { next(e); }
  });

  const dist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(dist)) app.use(express.static(dist));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large', message: 'Request body is limited to 4 KB.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_request', message: 'Body is not valid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });
  return { app, health };
}
