import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installNetguard } from './helpers/netguard.js';
import { isMockOnly } from '../src/mockonly.js';
import { ATTACKS } from '../src/catalog.js';

const servers = []; let guard;
async function start(mockOnly) {
  const { createApp } = await import('../src/app.js'); const { app, health } = await createApp({ mockOnly }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  servers.push({ server, health }); return `http://127.0.0.1:${server.address().port}`;
}
let on, off;
before(async () => { on = await start(true); off = await start(false); guard = installNetguard({ allowedPorts: servers.map((s) => s.server.address().port) }); });
after(() => { guard?.uninstall(); for (const s of servers) { s.health.stop(); s.server.close(); } });
const post = (base, path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const REFUSAL = { error: 'mock_only', message: 'Disabled in the hosted mock.' };

test('MOCK_ONLY env parsing accepts 1 and true only', () => {
  assert.equal(isMockOnly({ MOCK_ONLY: '1' }), true); assert.equal(isMockOnly({ MOCK_ONLY: 'true' }), true);
  for (const v of [undefined, '', '0', 'false', 'no']) assert.equal(isMockOnly({ MOCK_ONLY: v }), false);
});
test('health reports mode mock-only when on, and has no mode field when off', async () => {
  assert.equal((await (await fetch(`${on}/api/health`)).json()).mode, 'mock-only');
  assert.equal('mode' in (await (await fetch(`${off}/api/health`)).json()), false);
});
test('on: anything carrying a target, credential or live flag is refused with 403 mock_only; off: the same request is not refused', async () => {
  for (const extra of [{ url: 'https://evil.example/x' }, { target: 'https://gw.corp.example' }, { token: 'abc' }, { apiKey: 'sk-x' }, { live: true }]) {
    const r = await post(on, '/api/run', { attackId: 'wrong-scope', mode: 'both', ...extra });
    assert.equal(r.status, 403, JSON.stringify(extra)); assert.deepEqual(await r.json(), REFUSAL);
    assert.equal((await post(off, '/api/run', { attackId: 'wrong-scope', mode: 'both', ...extra })).status, 200);
  }
  const q = await fetch(`${on}/api/matrix?url=https://evil.example`); assert.equal(q.status, 403); assert.deepEqual(await q.json(), REFUSAL);
  assert.equal((await fetch(`${off}/api/matrix?url=x`)).status, 200);
  for (const [m, p] of [['POST', '/api/reset'], ['PUT', '/api/run'], ['DELETE', '/api/run'], ['POST', '/api/anything']]) {
    const r = await fetch(on + p, { method: m, headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(r.status, 403, `${m} ${p}`); assert.deepEqual(await r.json(), REFUSAL);
  }
  assert.equal((await post(off, '/api/reset', {})).status, 200);
});
test('on: the normal mock demo still works (run, matrix, catalog)', async () => {
  const j = await (await post(on, '/api/run', { attackId: 'other-account', mode: 'both', controlsOff: ['scope_check'] })).json();
  assert.deepEqual(j.runs.map((r) => r.succeeded), [true, false]);
  assert.equal((await fetch(`${on}/api/matrix`)).status, 200); assert.equal((await fetch(`${on}/api/catalog`)).status, 200);
});
test('on: zero outbound attempts beyond the app\'s own loopback ports, including across refused requests', async () => {
  for (const a of ATTACKS) assert.equal((await post(on, '/api/run', { attackId: a.id, mode: 'both' })).status, 200);
  await post(on, '/api/run', { attackId: 'ssrf-metadata', mode: 'both', url: 'http://169.254.169.254/' });
  assert.deepEqual(guard.violations, []);
  assert.ok(guard.attempts.length > 0 && guard.attempts.every((x) => x.kind === 'connect' && /^127\.0\.0\.1:\d+$/.test(x.target)));
});
