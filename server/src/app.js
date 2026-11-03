import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ATTACKS, attackById } from './catalog.js';
import { CONTROLS, CONTROL_IDS, governed, governedExcept, ungoverned } from './policy.js';
import { runAttack } from './runner.js';
import { createKeyring } from './parties.js';
import { createHealth } from './health.js';
import { asiForAttack, asiTable } from './asi.js';
import { isMockOnly, mockOnlyGuard, createLimiter, limitsFromEnv, hostGuard } from './mockonly.js';

const MODES = ['ungoverned', 'governed', 'both'];
const publicAttack = ({ id, name, pack, goal, story, control, steps, refs, expected }) => ({ id, name, pack, goal, story, control, steps, references: refs, expected, asi: asiForAttack(id) });

export async function createApp({ mockOnly = isMockOnly(), allowedHosts = [], limits = limitsFromEnv(), onMatrixCompute } = {}) {
  let keyring = await createKeyring();
  const app = express();
  const health = createHealth({ mockOnly });
  app.disable('x-powered-by');
  if (allowedHosts.length) app.use(hostGuard(allowedHosts)); // before everything, health included
  // Inert-text defence in depth: nothing from a response can run script, and the page may only talk to itself.
  app.use((req, res, next) => { res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"); next(); });
  app.use(express.json({ limit: '4kb' }));
  if (mockOnly) app.use(mockOnlyGuard);
  app.use('/api/health', health.router); // health is registered before the limiter and is never throttled
  // Rule 19: the Mock/Real toggle's API. The gallery is mock only (every party is an in-process mock), so Real
  // is never available (409). The hosted build (MOCK_ONLY) refuses every switch (403).
  const NO_REAL = 'Real is not available: every party here is a mock inside this app and nothing leaves the machine.';
  const modeInfo = () => ({ mode: mockOnly ? 'mock-only' : 'local', hosted: mockOnly, source: 'mock', realAvailable: false });
  app.get('/api/info', (_req, res) => res.json(modeInfo()));
  app.post('/api/mode', (req, res) => {
    const b = req.body;
    if (b === null || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).length !== 1 || !['mock', 'real'].includes(b.source)) return res.status(400).json({ error: 'bad_request', message: 'body must be exactly {source: "mock" or "real"}' });
    if (mockOnly) return res.status(403).json({ error: 'mock_only', message: 'The hosted build is Mock only and cannot be switched.' });
    if (b.source === 'real') return res.status(409).json({ error: 'conflict', message: NO_REAL });
    return res.json(modeInfo());
  });
  if (mockOnly) app.use(['/api/run', '/api/matrix'], createLimiter(limits));
  let matrixCache; // mock-only: the matrix is deterministic and /api/reset is refused, so compute it once

  app.get('/api/catalog', (req, res) => res.json({ packs: [{ id: 1, name: 'Pack 1: token and identity attacks' }, { id: 2, name: 'Pack 2: MCP authorization attacks' }], attacks: ATTACKS.map(publicAttack) }));
  // The slide-55 OWASP ASI table as qualified, with the lab's attack mapping. A Ping release claim, UNVERIFIED on our tenant (see asi.js).
  app.get('/api/asi', (req, res) => res.json(asiTable()));
  app.get('/api/controls', (req, res) => res.json({ controls: CONTROLS.map((c) => ({ id: c.id, name: c.name, does: c.does, error: c.error, status: c.status, message: c.message, references: c.refs, seed: c.seed, stops: ATTACKS.filter((a) => a.control === c.id).map((a) => a.id) })) }));
  app.post('/api/run', async (req, res, next) => {
    try {
      const { attackId, mode, controlsOff } = req.body || {};
      const attack = typeof attackId === 'string' ? attackById(attackId) : undefined;
      if (!attack) return res.status(400).json({ error: 'bad_request', message: 'attackId must be one of the catalog ids.', ids: ATTACKS.map((a) => a.id) });
      if (!MODES.includes(mode)) return res.status(400).json({ error: 'bad_request', message: `mode must be one of ${MODES.join(', ')}.` });
      // controlsOff (optional, governed side only): turn named controls off to prove the control is what stops the attack.
      if (controlsOff !== undefined && (!Array.isArray(controlsOff) || controlsOff.some((id) => !CONTROL_IDS.includes(id)))) return res.status(400).json({ error: 'bad_request', message: 'controlsOff must be an array of control ids.', ids: CONTROL_IDS });
      const governedPolicy = Object.fromEntries(CONTROL_IDS.map((id) => [id, !(controlsOff || []).includes(id)]));
      const runs = [];
      if (mode !== 'governed') runs.push(await runAttack(attack, ungoverned(), keyring));
      if (mode !== 'ungoverned') runs.push(await runAttack(attack, governedPolicy, keyring));
      res.json({ attackId, mode, control: attack.control, controls: CONTROL_IDS.length, runs });
    } catch (e) { next(e); }
  });
  // Attacks x controls: each attack run with every control on except one. succeeds = that one control was what stopped it.
  app.get('/api/matrix', async (req, res, next) => {
    try {
      const compute = async () => {
        onMatrixCompute?.();
        const cells = {};
        for (const a of ATTACKS) { cells[a.id] = {}; for (const c of CONTROL_IDS) cells[a.id][c] = (await runAttack(a, governedExcept(c), keyring)).succeeded; }
        return { attacks: ATTACKS.map((a) => a.id), controls: CONTROL_IDS, cells };
      };
      if (!mockOnly) return res.json(await compute());
      matrixCache ??= compute().catch((e) => { matrixCache = undefined; throw e; });
      res.json(await matrixCache);
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
