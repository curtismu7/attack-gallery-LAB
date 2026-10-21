const json = async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`); return j; };
export const getCatalog = () => fetch('/api/catalog').then(json);
export const getControls = () => fetch('/api/controls').then(json);
export const getMatrix = () => fetch('/api/matrix').then(json);
export const runAttack = (attackId, mode, controlsOff) => fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId, mode, ...(controlsOff?.length ? { controlsOff } : {}) }) }).then(json);
export const resetKeys = () => fetch('/api/reset', { method: 'POST' }).then(json);
