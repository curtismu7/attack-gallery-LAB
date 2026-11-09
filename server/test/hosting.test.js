import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolveBind } from '../src/bind.js';
import { createApp } from '../src/app.js';

const HOSTED = { MOCK_ONLY: '1', GALLERY_HOST: '0.0.0.0', GALLERY_BIND: '1', GALLERY_PORT: '0', GALLERY_ALLOWED_HOSTS: 'gallery.example' };
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
  const { host, port, allowedHosts } = resolveBind({ ...HOSTED, GALLERY_ALLOWED_HOSTS: 'gallery.apps.example.internal' });
  assert.equal(host, '0.0.0.0');
  const { app, health } = await createApp({ mockOnly: true, allowedHosts }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(port, '127.0.0.1', () => r(s)); }); // test binds loopback; the bind decision itself is asserted above
  try {
    const r = await get(server.address().port, '/api/health', 'gallery.apps.example.internal');
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body); assert.equal(j.state, 'ready'); assert.equal(j.mode, 'mock-only');
  } finally { health.stop(); server.close(); }
});

test('MOCK_ONLY on a non-loopback bind refuses to start without GALLERY_ALLOWED_HOSTS; loopback and non-mock do not need it', () => {
  const { GALLERY_ALLOWED_HOSTS, ...noHosts } = HOSTED;
  assert.throws(() => resolveBind(noHosts), /GALLERY_ALLOWED_HOSTS/);
  assert.throws(() => resolveBind({ ...noHosts, GALLERY_ALLOWED_HOSTS: ' , ' }), /GALLERY_ALLOWED_HOSTS/);
  assert.deepEqual(resolveBind({ ...HOSTED, GALLERY_ALLOWED_HOSTS: 'Gallery.Example, other.example' }).allowedHosts, ['gallery.example', 'other.example']);
  assert.deepEqual(resolveBind({ MOCK_ONLY: '1' }).allowedHosts, []);
  assert.equal(resolveBind({ GALLERY_HOST: '0.0.0.0', GALLERY_BIND: '1' }).host, '0.0.0.0');
});

test('Host allow-list: exact match only, port and case ignored, everything else 403 (health included); no list means loopback plus LAB_ALLOWED_HOSTS (sameorigin.test.js)', async () => {
  const { app, health } = await createApp({ mockOnly: true, allowedHosts: ['gallery.example'] }); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = server.address().port;
  const req = (method, path, host) => new Promise((resolve, reject) => { const r = http.request({ host: '127.0.0.1', port, path, method, headers: { host } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); r.on('error', reject); r.end(); });
  try {
    for (const h of ['gallery.example', 'GALLERY.example:8080']) { assert.equal(await req('GET', '/api/health', h), 200, h); assert.equal(await req('GET', '/api/catalog', h), 200, h); }
    for (const h of ['evil.com', 'gallery.example.evil.com', 'evil.com.gallery.example', 'sub.gallery.example', '127.0.0.1', '']) {
      assert.equal(await req('GET', '/api/catalog', h), 403, h); assert.equal(await req('GET', '/api/health', h), 403, `health ${h}`);
    }
    for (const m of ['HEAD', 'OPTIONS']) { assert.equal(await req(m, '/api/catalog', 'evil.com'), 403, m); assert.equal(await req(m, '/api/health', 'evil.com'), 403, `health ${m}`); }
  } finally { health.stop(); server.close(); }
});
