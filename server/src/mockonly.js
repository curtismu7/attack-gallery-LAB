// MOCK_ONLY=1 (or true): the hosted-mock switch. One guard, one place. The gallery already talks only to its own fixtures;
// this makes sure nothing a visitor sends can change that, and nothing shared between visitors can be written.
export const isMockOnly = (env = process.env) => ['1', 'true'].includes(String(env.MOCK_ONLY || '').toLowerCase());

export const MOCK_ONLY_REFUSAL = { error: 'mock_only', message: 'Disabled in the hosted mock.' };

// The only input the hosted mock accepts: POST /api/run with exactly these fields. Anything else (a URL, host, token,
// key, credential, live-mode flag) is refused, not ignored. /api/reset rotates the one process-wide keyring, so it is refused too.
const RUN_FIELDS = ['attackId', 'mode', 'controlsOff'];

export function mockOnlyGuard(req, res, next) {
  const refuse = () => res.status(403).json(MOCK_ONLY_REFUSAL);
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (!(req.method === 'POST' && req.path === '/api/run')) return refuse();
    const body = req.body;
    if (body && typeof body === 'object' && Object.keys(body).some((k) => !RUN_FIELDS.includes(k))) return refuse();
  }
  if (req.path.startsWith('/api/') && Object.keys(req.query).length) return refuse();
  next();
}

// ---- Bounds for the hosted mock (only wired when MOCK_ONLY is set) ----
// A global in-flight cap and a per-source token bucket on the two routes that cost CPU, plus a cached matrix.
// /api/health is never throttled: the k8s probes must keep answering while a visitor hammers the rest.
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export function limitsFromEnv(env = process.env) {
  return {
    maxInflight: num(env.GALLERY_MAX_INFLIGHT, 8),
    burst: num(env.GALLERY_RATE_BURST, 20),
    perSecond: num(env.GALLERY_RATE_PER_SEC, 5),
    trustProxy: ['1', 'true'].includes(String(env.GALLERY_TRUST_PROXY || '').toLowerCase()),
    maxSources: 10000,
  };
}

// Source key: the TCP peer by default. X-Forwarded-For is honoured only with an explicit trust-proxy setting, and then only
// its LAST entry (the one the trusted proxy appended); earlier entries are client-controlled and ignored.
export function sourceKey(req, trustProxy) {
  if (trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function createLimiter({ maxInflight, burst, perSecond, trustProxy, maxSources }, now = Date.now) {
  let inflight = 0;
  const buckets = new Map(); // key -> { tokens, at }; Map keeps insertion order, so the oldest is evicted first
  return function limit(req, res, next) {
    const t = now(); const key = sourceKey(req, trustProxy);
    let b = buckets.get(key);
    if (b) { buckets.delete(key); b.tokens = Math.min(burst, b.tokens + ((t - b.at) / 1000) * perSecond); b.at = t; }
    else b = { tokens: burst, at: t };
    buckets.set(key, b);
    if (buckets.size > maxSources) buckets.delete(buckets.keys().next().value);
    if (b.tokens < 1) { res.set('Retry-After', String(Math.max(1, Math.ceil((1 - b.tokens) / perSecond)))); return res.status(429).json({ error: 'rate_limited', message: 'Too many requests from this source. Slow down.' }); }
    if (inflight >= maxInflight) { res.set('Retry-After', '1'); return res.status(503).json({ error: 'busy', message: 'The hosted mock is busy. Retry shortly.' }); }
    b.tokens -= 1; inflight += 1;
    let done = false; const release = () => { if (!done) { done = true; inflight -= 1; } };
    res.on('finish', release); res.on('close', release);
    next();
  };
}

// DNS-rebinding defence: exact match on the Host header name (port stripped, case-folded) against GALLERY_ALLOWED_HOSTS.
export const parseAllowedHosts = (v) => String(v ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
export function hostGuard(allowedHosts) {
  return (req, res, next) => {
    const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
    if (!allowedHosts.includes(host)) return res.status(403).json({ error: 'host_not_allowed' });
    next();
  };
}
