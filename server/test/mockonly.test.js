import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installNetguard } from './helpers/netguard.js';
import { isMockOnly, createLimiter, sourceKey, limitsFromEnv } from '../src/mockonly.js';
import { ATTACKS } from '../src/catalog.js';

const servers = []; let guard;
async function start(mockOnly, onMatrixCompute) {
  const { createApp } = await import('../src/app.js'); const { app, health } = await createApp({ mockOnly, onMatrixCompute }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  servers.push({ server, health }); return `http://127.0.0.1:${server.address().port}`;
}
let on, off, onComputes = 0, offComputes = 0;
before(async () => { on = await start(true, () => onComputes++); off = await start(false, () => offComputes++); guard = installNetguard({ allowedPorts: servers.map((s) => s.server.address().port) }); });
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

// ---- bounds ----
const fakeRes = () => { const h = {}; const r = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, on(e, f) { (h[e] ||= []).push(f); }, fire(e) { (h[e] || []).forEach((f) => f()); } }; return r; };
const fakeReq = (ip, xff) => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: ip } });
const L = { maxInflight: 2, burst: 3, perSecond: 1, trustProxy: false, maxSources: 100 };
const call = (limit, req) => { const res = fakeRes(); let passed = false; limit(req, res, () => { passed = true; }); return { res, passed }; };

test('limiter: in-flight cap returns 503 with Retry-After and frees a slot on finish or close (no leak, no double release)', () => {
  const limit = createLimiter({ ...L, burst: 100 });
  const a = call(limit, fakeReq('1.1.1.1')), b = call(limit, fakeReq('1.1.1.2')), c = call(limit, fakeReq('1.1.1.3'));
  assert.deepEqual([a.passed, b.passed, c.passed], [true, true, false]); assert.equal(c.res.code, 503); assert.ok(c.res.headers['Retry-After']);
  a.res.fire('finish'); a.res.fire('close'); // both fire in real life; must release once
  assert.equal(call(limit, fakeReq('1.1.1.4')).passed, true);
  assert.equal(call(limit, fakeReq('1.1.1.5')).passed, false);
});
test('limiter: per-source token bucket returns 429 with Retry-After, is per source, and refills over time', () => {
  let t = 0; const limit = createLimiter({ ...L, maxInflight: 100 }, () => t);
  const results = []; for (let i = 0; i < 5; i++) { const r = call(limit, fakeReq('2.2.2.2')); results.push(r.passed ? 200 : r.res.code); if (!r.passed) assert.ok(Number(r.res.headers['Retry-After']) >= 1); }
  assert.deepEqual(results, [200, 200, 200, 429, 429]);
  assert.equal(call(limit, fakeReq('3.3.3.3')).passed, true, 'another source is unaffected');
  t = 2000; assert.equal(call(limit, fakeReq('2.2.2.2')).passed, true, 'refilled');
});
test('limiter: X-Forwarded-For is ignored by default; with trust-proxy only the last (proxy-appended) entry counts; table is bounded', () => {
  assert.equal(sourceKey(fakeReq('9.9.9.9', '1.2.3.4'), false), '9.9.9.9');
  assert.equal(sourceKey(fakeReq('9.9.9.9', '6.6.6.6, 1.2.3.4'), true), '1.2.3.4');
  assert.equal(sourceKey(fakeReq('9.9.9.9'), true), '9.9.9.9');
  const limit = createLimiter({ ...L, burst: 1, maxInflight: 1000, maxSources: 3 });
  for (let i = 0; i < 50; i++) call(limit, fakeReq(`10.0.0.${i}`)); // must not grow without bound or throw
  const spoof = createLimiter({ ...L, burst: 1, maxInflight: 1000 });
  assert.equal(call(spoof, fakeReq('7.7.7.7', 'a')).passed, true); assert.equal(call(spoof, fakeReq('7.7.7.7', 'b')).res.code, 429, 'spoofed XFF does not buy a fresh bucket');
});
test('limitsFromEnv: defaults and overrides; garbage falls back', () => {
  assert.equal(limitsFromEnv({}).trustProxy, false); assert.equal(limitsFromEnv({ GALLERY_TRUST_PROXY: '1' }).trustProxy, true);
  assert.equal(limitsFromEnv({ GALLERY_MAX_INFLIGHT: 'x' }).maxInflight, 8); assert.equal(limitsFromEnv({ GALLERY_MAX_INFLIGHT: '3' }).maxInflight, 3);
});

test('on, under load: a burst of /api/run and /api/matrix is bounded (some 429/503) and /api/health still answers 200 promptly', async () => {
  const { createApp } = await import('../src/app.js');
  const { app, health } = await createApp({ mockOnly: true, limits: { maxInflight: 2, burst: 10, perSecond: 1, trustProxy: false, maxSources: 100 } }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); servers.push({ server, health }); guard.allow(server.address().port);
  const base = `http://127.0.0.1:${server.address().port}`;
  const load = []; for (let i = 0; i < 60; i++) load.push(i % 2 ? fetch(`${base}/api/matrix`) : post(base, '/api/run', { attackId: 'wrong-scope', mode: 'both' }));
  const healthChecks = []; for (let i = 0; i < 20; i++) healthChecks.push(fetch(`${base}/api/health`).then((r) => r.status));
  const codes = (await Promise.all(load)).map((r) => r.status);
  assert.ok(codes.every((c) => [200, 429, 503].includes(c)), codes.join());
  assert.ok(codes.filter((c) => c === 200).length <= 10 + 2 + 2, 'no more than the burst (plus in-flight slack) gets through');
  assert.ok(codes.some((c) => c === 429 || c === 503), 'the burst was bounded');
  assert.deepEqual(await Promise.all(healthChecks), Array(20).fill(200));
  health.stop();
});
test('on: the matrix is computed once and served from cache; off: it is recomputed', async () => {
  const get = async (base) => (await fetch(`${base}/api/matrix`)).json();
  const on0 = onComputes, off0 = offComputes; // other tests may have hit the matrix already
  const a = await get(on), b = await get(on); assert.deepEqual(a, b);
  assert.ok(onComputes - on0 <= 1 && onComputes >= 1, 'mock-only computes the matrix once, however many requests');
  await get(off); await get(off);
  assert.equal(offComputes - off0, 2, 'off recomputes every request');
});
