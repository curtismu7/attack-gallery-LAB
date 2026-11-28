// The default world is Meridian Air, a fictional airline (spec: AI-DEMO-Standalone docs/specs/2026-11-28-airline-default-fleet.md).
// What an attack run SHOWS (names, labels, balances, gains) must read as an airline; attack ids, controls and refusal errors do not change.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACKS } from '../src/catalog.js';
import { CONTROLS, governed, ungoverned } from '../src/policy.js';
import { runAttack } from '../src/runner.js';
import { createKeyring } from '../src/parties.js';
import { TOOLS, USERS, freshAccounts } from '../src/world.js';

let keys; before(async () => { keys = await createKeyring(); });
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

// Wording from the retired bank world, and the brands the fleet is retiring. `funds` and `payee` are bank words; `Mark`/`Mary` are the old cast.
const OLD = /\b(bank|banking|checking|savings|payee|funds|money|Mark|Mary|Fabrikam|Northwind|Contoso|Harbor|Vellum|Skyline|Tessera)\b|transfer_funds|crew-payroll/i;

test('the mock world is Meridian Air: SkyMiles accounts in miles, Emma and Noah, a miles-transfer tool', () => {
  assert.deepEqual(Object.values(USERS).map((u) => u.name), ['Emma', 'Noah']);
  const accounts = Object.values(freshAccounts());
  assert.deepEqual(accounts.map((a) => a.id), ['acc-1001', 'acc-1002', 'acc-2001', 'acc-9000'], 'the object ids the attacks name are unchanged');
  assert.deepEqual(accounts.map((a) => a.label), ['Emma SkyMiles', 'Emma bonus miles', 'Noah SkyMiles', 'Partner member (external)']);
  assert.ok(TOOLS.transfer_miles && !TOOLS.transfer_funds, 'the write tool is transfer_miles');
  assert.equal(TOOLS.transfer_miles.scope, 'accounts:write', 'the scope names stay');
});

test('the attack ids, controls and refusal errors are exactly the ones before the re-skin', () => {
  assert.deepEqual(ATTACKS.map((a) => `${a.id}:${a.control}`), ['wrong-scope:scope_check', 'other-account:ownership_check', 'bad-client:client_allowlist', 'rogue-actor:act_validation', 'impersonation:require_delegation', 'raw-forwarding:no_token_forwarding', 'issuer-mixup:iss_check', 'audience-confusion:audience_binding', 'confused-deputy-dcr:consent_check', 'ssrf-metadata:ssrf_guard']);
  assert.deepEqual(CONTROLS.map((c) => c.error), ['insufficient_scope', 'forbidden_object', 'unauthorized_client', 'unauthorized_actor', 'delegation_required', 'invalid_token', 'token_forwarding_blocked', 'iss_mismatch', 'consent_required', 'ssrf_blocked']);
});

test('no bank wording, old brand or old cast name anywhere in what an attack run shows (catalog, controls, every run governed and ungoverned)', async () => {
  const shown = [ATTACKS.map(({ id, name, goal, story, steps, expected }) => ({ id, name, goal, story, steps, expected })), CONTROLS.map((c) => [c.name, c.message, c.does])];
  for (const a of ATTACKS) for (const p of [ungoverned(), governed()]) { const r = await runAttack(a, p, keys); shown.push({ gain: r.gain, refusal: r.refusal, trace: r.trace, audit: r.audit }); }
  const text = JSON.stringify(shown);
  const hit = text.match(OLD);
  assert.equal(hit, null, `old wording in the airline run: ${hit?.[0]} ...${hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 60) : ''}`);
  assert.match(text, /SkyMiles/); assert.match(text, /Emma/);
});

test('the gains read in miles', async () => {
  const gain = async (id) => (await runAttack(ATTACKS.find((a) => a.id === id), ungoverned(), keys)).gain;
  assert.match(await gain('wrong-scope'), /2500 miles/); assert.match(await gain('other-account'), /18450 miles/); assert.match(await gain('rogue-actor'), /4000 miles/);
});

test('the pages and diagram text the run is read beside are Meridian Air too', () => {
  for (const f of ['web/src/data/diagram.js', 'web/src/wire/wire.js', 'web/src/pages/GalleryPage.jsx']) assert.doesNotMatch(read(f), OLD, f);
  assert.match(read('web/src/pages/GalleryPage.jsx'), /Meridian Air, a fictional airline/);
});
