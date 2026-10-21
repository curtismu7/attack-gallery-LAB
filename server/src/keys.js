// Demo signing keys, generated at startup. Nothing here is a real secret and no key is ever written to disk or printed.
import { generateKeyPair, exportJWK, SignJWT, jwtVerify, createLocalJWKSet, decodeJwt, decodeProtectedHeader } from 'jose';
import { randomUUID, createECDH, createPrivateKey, createPublicKey } from 'node:crypto';

// EC keys are built from ECDH + a JWK import, never generateKeyPair: on Node 20.20.2 the keygen job's GC finalizer can abort the
// whole process (SIGABRT). RSA and other non-EC algorithms still use jose's generateKeyPair.
const EC_CURVES = { ES256: ['prime256v1', 'P-256', 32], ES384: ['secp384r1', 'P-384', 48], ES512: ['secp521r1', 'P-521', 66] };
export function generateEcKeyPair(alg = 'ES256') {
  const [name, crv, len] = EC_CURVES[alg];
  const ecdh = createECDH(name); ecdh.generateKeys();
  const point = ecdh.getPublicKey(); // 0x04 || X || Y
  const pub = { kty: 'EC', crv, x: point.subarray(1, 1 + len).toString('base64url'), y: point.subarray(1 + len).toString('base64url') };
  return {
    privateKey: createPrivateKey({ key: { ...pub, d: ecdh.getPrivateKey().toString('base64url') }, format: 'jwk' }),
    publicKey: createPublicKey({ key: pub, format: 'jwk' }),
  };
}

export async function createIssuer(issuer, alg = 'ES256') {
  const { publicKey, privateKey } = alg in EC_CURVES ? generateEcKeyPair(alg) : await generateKeyPair(alg);
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
