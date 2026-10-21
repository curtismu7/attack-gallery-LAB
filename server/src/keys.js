// Demo signing keys, generated at startup. Nothing here is a real secret and no key is ever written to disk or printed.
import { generateKeyPair, exportJWK, SignJWT, jwtVerify, createLocalJWKSet, decodeJwt, decodeProtectedHeader } from 'jose';
import { randomUUID } from 'node:crypto';

export async function createIssuer(issuer, alg = 'ES256') {
  const { publicKey, privateKey } = await generateKeyPair(alg);
  const kid = randomUUID().slice(0, 8);
  const jwk = { ...(await exportJWK(publicKey)), kid, alg, use: 'sig' };
  return {
    issuer, alg, kid,
    jwks: { keys: [jwk] },
    async mint(claims, { expiresInSec = 300, now = Math.floor(Date.now() / 1000) } = {}) {
      return new SignJWT({ ...claims })
        .setProtectedHeader({ alg, kid, typ: 'at+jwt' })
        .setIssuer(issuer).setIssuedAt(now).setExpirationTime(now + expiresInSec).setJti(randomUUID())
        .sign(privateKey);
    },
  };
}

// Verifies signature, issuer and expiry against the issuer's own JWKS. Audience is NOT checked here: that is a policy control.
export async function verifyAccessToken(token, issuerObj) {
  const { payload } = await jwtVerify(token, createLocalJWKSet(issuerObj.jwks), { issuer: issuerObj.issuer, algorithms: [issuerObj.alg] });
  return payload;
}

// What the UI may show: decoded header and claims only. The compact JWT string is never returned.
export function describeToken(token) {
  const h = decodeProtectedHeader(token);
  return { header: { alg: h.alg, kid: h.kid, typ: h.typ }, claims: decodeJwt(token) };
}
export const tokenId = (token) => decodeJwt(token).jti;
