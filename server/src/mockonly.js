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
