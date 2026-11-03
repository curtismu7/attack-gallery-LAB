// Rule 19: the Mock/Real toggle's API. The gallery is mock only, so Real is never available (409);
// the hosted build (MOCK_ONLY=1) refuses every switch (403); malformed bodies get 400.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server, base, health, s2;
before(async () => {
  const { app, health: h } = await createApp(); health = h; await h.ready;
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { health.stop(); server.close(); });
const mode = (body, raw) => fetch(`${base}/api/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

test('GET /api/info reports the mock-only source with no real availability', async () => {
  const j = await (await fetch(`${base}/api/info`)).json();
  assert.deepEqual(j, { mode: 'local', hosted: false, source: 'mock', realAvailable: false });
});

test('POST /api/mode keeps Mock and refuses Real with the reason (409)', async () => {
  const keep = await mode({ source: 'mock' });
  assert.equal(keep.status, 200);
  assert.equal((await keep.json()).source, 'mock');
  const real = await mode({ source: 'real' });
  assert.equal(real.status, 409);
  assert.match((await real.json()).message, /mock/i);
  assert.equal((await (await fetch(`${base}/api/info`)).json()).source, 'mock');
});

test('POST /api/mode rejects malformed bodies with 400', async () => {
  for (const body of [{}, { source: 'live' }, { source: 'mock', extra: 1 }, []]) {
    assert.equal((await mode(body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await mode(null, '"mock"')).status, 400);
});

test('the hosted build (MOCK_ONLY) reports itself and refuses every switch (403)', async () => {
  const { app, health: h2 } = await createApp({ mockOnly: true }); await h2.ready;
  await new Promise((r) => { s2 = app.listen(0, '127.0.0.1', r); });
  const b2 = `http://127.0.0.1:${s2.address().port}`;
  try {
    const j = await (await fetch(`${b2}/api/info`)).json();
    assert.equal(j.hosted, true); assert.equal(j.source, 'mock'); assert.equal(j.realAvailable, false);
    assert.equal((await fetch(`${b2}/api/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'real' }) })).status, 403);
    assert.equal((await fetch(`${b2}/api/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'mock' }) })).status, 403);
  } finally { h2.stop(); s2.close(); }
});
