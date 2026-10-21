// Self-check shared by /api/health and the doctor. Never reports counts or message text to the public health endpoint.
import { ATTACKS } from './catalog.js';
import { CONTROLS } from './policy.js';
import { createKeyring } from './parties.js';

export async function selfCheck() {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok, detail });
  add('catalog-size', ATTACKS.length === 10, `${ATTACKS.length} attacks`);
  const ctrl = new Set(CONTROLS.map((c) => c.id));
  add('catalog-shape', ATTACKS.every((a) => a.id && a.name && a.goal && a.steps?.length && ctrl.has(a.control) && a.refs && a.expected?.ungoverned && a.expected?.governed), 'every attack has id, goal, steps, a known control, references and expected results');
  add('one-control-per-attack', new Set(ATTACKS.map((a) => a.control)).size === ATTACKS.length, 'each attack is stopped by its own control');
  add('refs-labelled', ATTACKS.every((a) => a.refs.every((r) => r.verified === true || r.verified === false)), 'every reference is labelled verified or UNVERIFIED');
  try { const k = await createKeyring(); add('keys', Boolean(k.good.kid && k.evil.kid), 'demo signing keys generated'); } catch (e) { add('keys', false, String(e.message)); }
  return { ok: checks.every((c) => c.ok), checks };
}
