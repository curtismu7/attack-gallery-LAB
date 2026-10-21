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
