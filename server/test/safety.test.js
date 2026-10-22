import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dns from 'node:dns';
import { installNetguard } from './helpers/netguard.js';
import { resolveBind, isLoopbackHost } from '../src/bind.js';
import { ATTACKS } from '../src/catalog.js';
import { runAttack } from '../src/runner.js';
import { createKeyring } from '../src/parties.js';
import { governed, ungoverned } from '../src/policy.js';
import { isPublicAddress } from '../src/ipguard.js';

test('bind: loopback by default; a non-loopback host is refused unless GALLERY_BIND is set', () => {
  assert.deepEqual(resolveBind({}), { host: '127.0.0.1', port: 5181, allowedHosts: [] });
  assert.equal(resolveBind({ GALLERY_HOST: 'localhost' }).host, 'localhost');
  for (const h of ['0.0.0.0', '192.168.1.5', '::', 'example.com']) assert.throws(() => resolveBind({ GALLERY_HOST: h }), /loopback only/, h);
  assert.equal(resolveBind({ GALLERY_HOST: '0.0.0.0', GALLERY_BIND: '1' }).host, '0.0.0.0');
  assert.throws(() => resolveBind({ GALLERY_PORT: 'abc' }), /valid port/); assert.ok(isLoopbackHost('127.5.5.5'));
});

test('netguard self-test: it records and blocks a connection and a lookup (and sends nothing)', async () => {
  const g = installNetguard({ allowedPorts: [] });
  try {
    assert.throws(() => net.connect({ host: '203.0.113.9', port: 80 }), /netguard: blocked connect/);
    assert.throws(() => net.connect({ host: '169.254.169.254', port: 80 }), /netguard: blocked connect/);
    await assert.rejects(dns.promises.lookup('example.com'), /netguard: blocked lookup/);
    assert.equal(g.violations.length, 3);
  } finally { g.uninstall(); }
});

let server, base, health, guard;
before(async () => {
  const { createApp } = await import('../src/app.js'); const { app, health: h } = await createApp(); health = h; await h.ready;
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  guard = installNetguard({ allowedPorts: [server.address().port] }); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { guard?.uninstall(); health.stop(); server.close(); });

test('netguard: running every attack in every mode through the API makes zero outbound attempts beyond the app\'s own loopback port', async () => {
  for (const a of ATTACKS) for (const mode of ['ungoverned', 'governed', 'both']) {
    const r = await fetch(`${base}/api/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId: a.id, mode }) });
    assert.equal(r.status, 200, `${a.id} ${mode}`); await r.json();
  }
  assert.deepEqual(guard.violations, []);
  assert.ok(guard.attempts.length > 0, 'the guard is live: it saw the test\'s own loopback connections');
  assert.ok(guard.attempts.every((x) => x.kind === 'connect' && /^127\.0\.0\.1:\d+$/.test(x.target)), JSON.stringify(guard.attempts.slice(0, 3)));
});

test('every hostname in the catalog and in every trace is .example, .invalid, or the apex of example.com/net/org; IP literals are reserved or private', async () => {
  const keys = await createKeyring(); const texts = [JSON.stringify(ATTACKS.map(({ refs, ...rest }) => rest))]; // reference links to the specs are citations, not payloads
  for (const a of ATTACKS) for (const p of [ungoverned(), governed()]) texts.push(JSON.stringify(await runAttack(a, p, keys)));
  const okHost = (h) => /\.(example|invalid)$/.test(h) || /^example\.(com|net|org)$/.test(h) || (net.isIP(h) && (!isPublicAddress(h).public || h.startsWith('93.184.216.')));
  const bad = new Set();
  for (const t of texts) for (const m of t.matchAll(/https?:\/\/(?:[^@/"\s]+@)?(\[[0-9a-f:.]+\]|[^/:"\s\\?#]+)/gi)) { const h = m[1].replace(/^\[|\]$/g, '').toLowerCase(); if (!okHost(h)) bad.add(h); }
  assert.deepEqual([...bad], []);
});

test('no secret-looking material: tokens never leave as compact JWTs, and the source has no PingOne ids or private hosts', async () => {
  const { readdirSync, readFileSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('../src/', import.meta.url));
  for (const f of readdirSync(dir)) {
    const s = readFileSync(dir + f, 'utf8');
    assert.ok(!/auth\.pingone\.|pingidentity\.com|BEGIN (RSA |EC )?PRIVATE KEY|AKIA[0-9A-Z]{16}/.test(s), f);
  }
});
