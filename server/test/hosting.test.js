import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolveBind } from '../src/bind.js';
import { createApp } from '../src/app.js';

const HOSTED = { MOCK_ONLY: '1', GALLERY_HOST: '0.0.0.0', GALLERY_BIND: '1', GALLERY_PORT: '0' };
const get = (port, path, host) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path, headers: { host } }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b })); }).on('error', reject);
});

test('defaults stay loopback; MOCK_ONLY alone does not unlock a non-loopback bind', () => {
  assert.equal(resolveBind({}).host, '127.0.0.1');
  assert.equal(resolveBind({ MOCK_ONLY: '1' }).host, '127.0.0.1');
  assert.throws(() => resolveBind({ MOCK_ONLY: '1', GALLERY_HOST: '0.0.0.0' }), /loopback only/);
  assert.throws(() => resolveBind({ MOCK_ONLY: '1', GALLERY_HOST: '0.0.0.0', GALLERY_PORT: '8080' }), /GALLERY_BIND/);
});

test('hosted settings (MOCK_ONLY + GALLERY_HOST + GALLERY_BIND) bind all interfaces and serve the readiness probe under a cluster Host header', async () => {
  const { host, port } = resolveBind(HOSTED);
  assert.equal(host, '0.0.0.0');
  const { app, health } = await createApp({ mockOnly: true }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(port, '127.0.0.1', () => r(s)); }); // test binds loopback; the bind decision itself is asserted above
  try {
    const r = await get(server.address().port, '/api/health', 'gallery.apps.example.internal');
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body); assert.equal(j.state, 'ready'); assert.equal(j.mode, 'mock-only');
  } finally { health.stop(); server.close(); }
});
