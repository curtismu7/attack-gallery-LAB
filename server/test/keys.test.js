import test from 'node:test';
import assert from 'node:assert/strict';
import { createIssuer, verifyAccessToken, describeToken } from '../src/keys.js';

for (const alg of ['ES256', 'RS256']) {
  test(`${alg}: mint then verify, and the description never contains the signature`, async () => {
    const iss = await createIssuer('https://as.gallery.example', alg);
    const t = await iss.mint({ sub: 'user-mark', aud: 'x' });
    const claims = await verifyAccessToken(t, iss);
    assert.equal(claims.sub, 'user-mark');
    const d = describeToken(t);
    assert.equal(d.header.alg, alg);
    assert.ok(!JSON.stringify(d).includes(t.split('.')[2]));
  });
}
test('a token signed by a different key, or expired, is rejected', async () => {
  const a = await createIssuer('https://as.gallery.example'); const b = await createIssuer('https://as.gallery.example');
  await assert.rejects(verifyAccessToken(await b.mint({ sub: 'x' }), a));
  await assert.rejects(verifyAccessToken(await a.mint({ sub: 'x' }, { expiresInSec: 10, now: 1000 }), a));
});

// Regression: EC keygen via generateKeyPair aborted Node 20.20.2 (SIGABRT, GC race). EC keys must come from createECDH + JWK import.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { generateEcKeyPair } from '../src/keys.js';
import { sign, verify } from 'node:crypto';

test('source guard: no generateKeyPairSync anywhere, and generateKeyPair only on the non-EC branch', () => {
  const keys = readFileSync(new URL('../src/keys.js', import.meta.url), 'utf8');
  const parties = readFileSync(new URL('../src/parties.js', import.meta.url), 'utf8');
  for (const src of [keys, parties]) assert.ok(!/generateKeyPairSync/.test(src));
  assert.ok(!/generateKeyPair\b/.test(parties));
  const calls = keys.split('\n').filter((l) => /generateKeyPair\(/.test(l));
  assert.equal(calls.length, 1);
  assert.match(calls[0], /alg in EC_CURVES \? generateEcKeyPair\(alg\) : await generateKeyPair\(alg\)/);
});

test('50 EC key creations under forced GC sign and verify', async () => {
  if (typeof globalThis.gc !== 'function') {
    const r = spawnSync(process.execPath, ['--expose-gc', '--test', new URL(import.meta.url).pathname], { env: { ...process.env, KEYS_GC_CHILD: '1' }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return;
  }
  for (const alg of ['ES256', 'ES384', 'ES512']) {
    for (let i = 0; i < 50; i++) {
      const { privateKey, publicKey } = generateEcKeyPair(alg);
      globalThis.gc();
      const data = Buffer.from(`msg-${i}`);
      const sig = sign(alg === 'ES256' ? 'sha256' : alg === 'ES384' ? 'sha384' : 'sha512', data, privateKey);
      assert.ok(verify(alg === 'ES256' ? 'sha256' : alg === 'ES384' ? 'sha384' : 'sha512', data, publicKey, sig));
    }
  }
  for (let i = 0; i < 50; i++) {
    const iss = await createIssuer('https://as.gallery.example'); globalThis.gc();
    assert.equal((await verifyAccessToken(await iss.mint({ sub: 'u' }), iss)).sub, 'u');
  }
});
