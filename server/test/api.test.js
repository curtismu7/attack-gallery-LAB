import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server, base, health;
before(async () => {
  const { app, health: h } = await createApp(); health = h; await h.ready;
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { health.stop(); server.close(); });
const post = (path, body, raw) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

test('GET /api/health is demo-health/1 exactly', async () => {
  const r = await fetch(`${base}/api/health`); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const j = await r.json();
  assert.deepEqual(Object.keys(j).sort(), ['at', 'demo', 'runtime', 'schema', 'state']); assert.equal(j.schema, 'demo-health/1'); assert.equal(j.state, 'ready'); assert.equal(j.runtime, 'offline');
  assert.deepEqual(j.demo, { id: 'attack-gallery', name: 'Agent Attack Gallery', version: '0.1.0' }); assert.ok(!Number.isNaN(Date.parse(j.at)));
  assert.ok(JSON.stringify(j).length < 4096);
});
test('GET /api/catalog lists ten attacks with steps, control, references and expected results', async () => {
  const j = await (await fetch(`${base}/api/catalog`)).json();
  assert.equal(j.attacks.length, 10);
  for (const a of j.attacks) for (const k of ['id', 'name', 'pack', 'goal', 'steps', 'control', 'references', 'expected']) assert.ok(a[k] !== undefined, `${a.id}.${k}`);
});
test('GET /api/controls lists ten controls each stopping one attack', async () => {
  const j = await (await fetch(`${base}/api/controls`)).json(); assert.equal(j.controls.length, 10);
  for (const c of j.controls) { assert.equal(c.stops.length, 1); assert.ok(c.error && c.message); }
  assert.ok(j.controls.find((c) => c.id === 'act_validation').seed.includes('GatewayTokenPolicy.ts'));
});
test('POST /api/run: both, ungoverned, governed', async () => {
  const both = await (await post('/api/run', { attackId: 'other-account', mode: 'both' })).json();
  assert.deepEqual(both.runs.map((r) => [r.config, r.succeeded]), [['ungoverned', true], ['governed', false]]);
  assert.equal((await (await post('/api/run', { attackId: 'other-account', mode: 'governed' })).json()).runs.length, 1);
  assert.equal((await (await post('/api/run', { attackId: 'ssrf-metadata', mode: 'ungoverned' })).json()).runs[0].succeeded, true);
});
test('validation: bad id, bad mode, bad JSON, missing body, huge body', async () => {
  assert.equal((await post('/api/run', { attackId: 'nope', mode: 'both' })).status, 400);
  assert.equal((await post('/api/run', { attackId: '__proto__', mode: 'both' })).status, 400);
  assert.equal((await post('/api/run', { attackId: { a: 1 }, mode: 'both' })).status, 400);
  assert.equal((await post('/api/run', { attackId: 'wrong-scope', mode: 'sideways' })).status, 400);
  assert.equal((await post('/api/run', null, '{not json')).status, 400);
  assert.equal((await post('/api/run', null, '')).status, 400);
  const huge = await post('/api/run', { attackId: 'wrong-scope', mode: 'both', pad: 'x'.repeat(10_000) }); assert.equal(huge.status, 413);
  assert.equal((await fetch(`${base}/api/nothing`)).status, 404);
});
test('POST /api/reset rotates the demo keys and runs still work', async () => {
  const a = await (await post('/api/reset', {})).json(); const b = await (await post('/api/reset', {})).json();
  assert.equal(a.ok, true); assert.notEqual(a.keys.good, b.keys.good);
  assert.equal((await (await post('/api/run', { attackId: 'bad-client', mode: 'both' })).json()).runs.length, 2);
});

test('POST /api/run controlsOff turns the named control off on the governed side only', async () => {
  const off = await (await post('/api/run', { attackId: 'wrong-scope', mode: 'governed', controlsOff: ['scope_check'] })).json();
  assert.equal(off.runs[0].succeeded, true); assert.equal(off.runs[0].policy.scope_check, false); assert.equal(off.runs[0].policy.ownership_check, true);
  const other = await (await post('/api/run', { attackId: 'wrong-scope', mode: 'governed', controlsOff: ['ownership_check'] })).json();
  assert.equal(other.runs[0].succeeded, false);
  assert.equal((await post('/api/run', { attackId: 'wrong-scope', mode: 'governed', controlsOff: ['nope'] })).status, 400);
  assert.equal((await post('/api/run', { attackId: 'wrong-scope', mode: 'governed', controlsOff: 'scope_check' })).status, 400);
});
test('GET /api/matrix: with one control off, only that control\'s own attack succeeds', async () => {
  const j = await (await fetch(`${base}/api/matrix`)).json();
  const { ATTACKS } = await import('../src/catalog.js');
  for (const a of ATTACKS) for (const c of j.controls) assert.equal(j.cells[a.id][c], c === a.control, `${a.id} x ${c}`);
});
test('responses carry a CSP that forbids inline script and outside connections', async () => {
  const csp = (await fetch(`${base}/api/health`)).headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/); assert.match(csp, /connect-src 'self'/); assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
});
