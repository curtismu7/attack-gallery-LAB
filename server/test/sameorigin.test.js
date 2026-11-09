// The family same-origin write rule, including the lab-proxy (https://local.ping-devops.com:8443/attack-gallery/).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { resolveBind } from '../src/bind.js';

const NAME = 'attack-gallery.local.ping-devops.com';
const PROXY_ORIGIN = 'https://local.ping-devops.com:8443';
const PROXIED = { host: `${NAME}:5181`, 'x-forwarded-host': 'local.ping-devops.com:8443', 'x-forwarded-proto': 'https' };
const RUN = JSON.stringify({ attackId: 'other-account', mode: 'both' });

const start = async (opts) => {
  const { app, health } = await createApp(opts); await health.ready;
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  return { port: server.address().port, close: () => { health.stop(); server.close(); } };
};
const send = (port, { method = 'POST', path = '/api/run', headers = {}, body = RUN } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
    let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b }));
  });
  req.on('error', reject); req.end(method === 'GET' ? undefined : body);
});

let lab;
before(async () => { lab = await start({ labHosts: [NAME], port: 5181 }); });
after(() => lab.close());

test('lab-proxy: a launcher write (allowed Host, Origin === X-Forwarded-Proto://X-Forwarded-Host) is accepted', async () => {
  const r = await send(lab.port, { headers: { ...PROXIED, origin: PROXY_ORIGIN } });
  assert.equal(r.status, 200, r.body);
  assert.equal(JSON.parse(r.body).runs.length, 2);
  assert.equal((await send(lab.port, { path: '/api/health', method: 'GET', headers: PROXIED })).status, 200);
});

test('loopback: a same-origin write and a write with no Origin are accepted', async () => {
  for (const h of [`127.0.0.1:${lab.port}`, `localhost:${lab.port}`]) {
    assert.equal((await send(lab.port, { headers: { host: h, origin: `http://${h}` } })).status, 200, h);
  }
  assert.equal((await send(lab.port, { headers: { host: `127.0.0.1:${lab.port}` } })).status, 200);
});

test('a foreign Origin on a write is refused (403), behind the proxy or on loopback', async () => {
  for (const origin of ['https://evil.example', 'http://local.ping-devops.com:8443', 'https://local.ping-devops.com', 'null', `http://127.0.0.1:${lab.port + 1}`]) {
    const r = await send(lab.port, { headers: { ...PROXIED, origin } });
    assert.equal(r.status, 403, origin); assert.match(r.body, /bad_origin/);
  }
  const lb = await send(lab.port, { headers: { host: `127.0.0.1:${lab.port}`, origin: 'https://evil.example' } });
  assert.equal(lb.status, 403); assert.match(lb.body, /bad_origin/);
  assert.equal((await send(lab.port, { path: '/api/reset', body: '{}', headers: { ...PROXIED, origin: 'https://evil.example' } })).status, 403);
  // The forwarded proto must be http or https, and the forwarded host must be non-empty.
  assert.equal((await send(lab.port, { headers: { ...PROXIED, 'x-forwarded-proto': 'ftp', origin: 'ftp://local.ping-devops.com:8443' } })).status, 403);
  assert.equal((await send(lab.port, { headers: { ...PROXIED, 'x-forwarded-host': '', origin: 'https://' } })).status, 403);
});

test('forwarded headers on a loopback Host are ignored', async () => {
  for (const [host, xfh, origin] of [[`127.0.0.1:${lab.port}`, 'evil.example', 'https://evil.example'], [`localhost:${lab.port}`, 'local.ping-devops.com:8443', PROXY_ORIGIN]]) {
    const r = await send(lab.port, { headers: { host, 'x-forwarded-host': xfh, 'x-forwarded-proto': 'https', origin } });
    assert.equal(r.status, 403, host); assert.match(r.body, /bad_origin/);
  }
});

test('a Host outside the set is refused before any Origin check, reads included', async () => {
  for (const host of ['local.ping-devops.com:5181', 'evil.example:5181', `${NAME}:1`, NAME, `${NAME}.evil.example:5181`]) {
    const r = await send(lab.port, { headers: { ...PROXIED, host, origin: PROXY_ORIGIN } });
    assert.equal(r.status, 403, host); assert.match(r.body, /host_not_allowed/);
    assert.equal((await send(lab.port, { method: 'GET', path: '/api/health', headers: { host } })).status, 403, host);
  }
  // With no LAB_ALLOWED_HOSTS the lab answers loopback only.
  const bare = await start({ port: 5181 });
  try { assert.equal((await send(bare.port, { headers: { ...PROXIED, origin: PROXY_ORIGIN } })).status, 403); } finally { bare.close(); }
});

test('the hosted build keeps its own host list, and its page origin counts as same-origin', async () => {
  const hosted = await start({ mockOnly: true, allowedHosts: ['gallery.example'] });
  try {
    assert.equal((await send(hosted.port, { headers: { host: 'gallery.example', origin: 'https://gallery.example' } })).status, 200);
    assert.equal((await send(hosted.port, { headers: { host: 'gallery.example', origin: 'https://evil.example' } })).status, 403);
  } finally { hosted.close(); }
});

test('LAB_ALLOWED_HOSTS is parsed by resolveBind', () => {
  assert.deepEqual(resolveBind({ LAB_ALLOWED_HOSTS: ` ${NAME.toUpperCase()} , ` }).labHosts, [NAME]);
});
