import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, attackById } from '../src/catalog.js';
import { runAttack } from '../src/runner.js';
import { createKeyring, createWorld } from '../src/parties.js';
import { CONTROLS, CONTROL_IDS, controlById, governed, ungoverned, governedExcept } from '../src/policy.js';
import { URLS } from '../src/world.js';

let keys; before(async () => { keys = await createKeyring(); });

const GAIN = {
  'wrong-scope': /moved 25 from acc-1001 with a read-only token/, 'other-account': /read Mary's account acc-2001, balance 18450/,
  'bad-client': /unregistered client read Mark's accounts \(acc-1001, acc-1002\)/, 'rogue-actor': /audit record names the actor "agent-ok" although the signed token names agent-rogue/,
  impersonation: /no agent in the audit record \(actor: null\)/, 'raw-forwarding': /backend's log held Mark's live token/, 'issuer-mixup': /evil AS redeemed Mark's code/,
  'audience-confusion': /issued for the billing API listed Mark's accounts/, 'confused-deputy-dcr': /code for Mark was delivered to https:\/\/attacker\.example\/cb without consent/,
  'ssrf-metadata': /reached 3 internal fake service\(s\): 169\.254\.169\.254, 127\.0\.0\.1, 10\.0\.0\.5/,
};

test('the catalog has the ten attacks, two packs, one control each, and labelled references', () => {
  assert.equal(ATTACKS.length, 10);
  assert.equal(ATTACKS.filter((a) => a.pack === 1).length, 6); assert.equal(ATTACKS.filter((a) => a.pack === 2).length, 4);
  assert.equal(new Set(ATTACKS.map((a) => a.control)).size, 10); assert.equal(CONTROLS.length, 10);
  for (const a of ATTACKS) { assert.ok(controlById(a.control)); assert.ok(a.refs.length); for (const r of a.refs) assert.ok(r.verified ? r.url && r.read : r.url === null, `${a.id} ${r.id}`); }
});

for (const a of ATTACKS) {
  test(`${a.id}: succeeds ungoverned (attacker gain asserted)`, async () => {
    const r = await runAttack(a, ungoverned(), keys);
    assert.equal(r.succeeded, true); assert.match(r.gain, GAIN[a.id]); assert.equal(r.refusal, null); assert.ok(r.trace.length >= 2);
  });
  test(`${a.id}: refused governed, by its named control with its educational error`, async () => {
    const r = await runAttack(a, governed(), keys); const c = controlById(a.control);
    assert.equal(r.succeeded, false); assert.equal(r.gain, null);
    assert.equal(r.refusal.control, a.control); assert.equal(r.refusal.error, c.error); assert.ok(r.refusal.message.length > 40);
    assert.equal(r.refusal.kind, a.id === 'raw-forwarding' ? 'neutralised' : 'refused');
  });
}

test('mutation proof: with one control off and the rest on, exactly that control\'s attack succeeds', async () => {
  for (const off of CONTROL_IDS) {
    for (const a of ATTACKS) {
      const r = await runAttack(a, governedExcept(off), keys);
      assert.equal(r.succeeded, a.control === off, `control ${off} off, attack ${a.id}: succeeded=${r.succeeded}`);
      if (!r.succeeded) assert.equal(r.refusal.control, a.control);
    }
  }
});
test('dual: with one control on and the rest off, that control stops its attack', async () => {
  for (const on of CONTROL_IDS) {
    const a = ATTACKS.find((x) => x.control === on);
    const r = await runAttack(a, { ...ungoverned(), [on]: true }, keys);
    assert.equal(r.succeeded, false, on);
  }
});

test('actor injection: a caller-supplied header cannot create or replace an act claim', async () => {
  for (const [label, claims] of [['no act at all', { act: undefined }], ['rogue act', { act: { sub: 'agent-rogue' } }]]) {
    const w = await createWorld(keys, governed());
    const token = await w.good.issue({ sub: 'user-mark', client: 'client-legit', aud: URLS.gateway, scope: 'accounts:write', ...claims });
    const r = await w.gateway.handle({ tool: 'transfer_funds', args: { fromAccountId: 'acc-1001', toAccountId: 'acc-9000', amount: 1 }, headers: { authorization: `Bearer ${token}`, 'x-actor-client': 'agent-ok' } });
    assert.equal(r.ok, false, label); assert.equal(w.audit.length, 0, label);
    assert.equal(r.control, claims.act ? 'act_validation' : 'require_delegation', label);
  }
});
test('a nested act chain does not launder a rogue outermost actor (outermost act is the current actor)', async () => {
  const w = await createWorld(keys, governed());
  const token = await w.good.issue({ sub: 'user-mark', client: 'client-legit', aud: URLS.gateway, scope: 'accounts:write', act: { sub: 'agent-rogue', act: { sub: 'agent-ok' } } });
  const r = await w.gateway.handle({ tool: 'transfer_funds', args: { fromAccountId: 'acc-1001', toAccountId: 'acc-9000', amount: 1 }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.control, 'act_validation');
});

test('mix-up: tokens an evil AS signs while claiming the good issuer are rejected before any policy', async () => {
  const w = await createWorld(keys, ungoverned());
  const forged = await w.evil.forgeTokenClaimingGoodIssuer({ sub: 'user-mark', aud: URLS.gateway, scope: 'accounts:read', azp: 'client-legit' });
  const r = await w.gateway.handle({ tool: 'list_accounts', headers: { authorization: `Bearer ${forged}` } });
  assert.equal(r.status, 401); assert.equal(r.baseline, true);
  const evilOwn = await keys.evil.mint({ sub: 'user-mark', aud: URLS.gateway, scope: 'accounts:read' });
  assert.equal((await w.gateway.handle({ tool: 'list_accounts', headers: { authorization: `Bearer ${evilOwn}` } })).status, 401);
});
test('mix-up: the evil AS bouncing to the good AS is caught by iss; a response with iss missing from an advertising server is also refused', async () => {
  const w = await createWorld(keys, governed());
  const sess = await w.client.beginAuth(URLS.goodAs); assert.equal(sess.meta.authorization_response_iss_parameter_supported, true);
  const out = w.good.authorize({ user: 'user-mark', client_id: 'client-legit', redirect_uri: URLS.legitCallback, state: sess.state, code_challenge: sess.code_challenge, resource: URLS.gateway, scope: 'accounts:read' });
  const noIss = { ...out.params }; delete noIss.iss;
  assert.equal((await w.client.handleCallback(sess, noIss)).error, 'iss_mismatch');
  const good = await w.client.handleCallback(sess, out.params); assert.equal(good.ok, true); // honest single-AS flow still works
});
test('wrong-state callbacks are rejected', async () => {
  const w = await createWorld(keys, governed()); const sess = await w.client.beginAuth(URLS.goodAs);
  assert.equal((await w.client.handleCallback(sess, { state: 'x', code: 'c', iss: URLS.goodAs })).error, 'invalid_state');
});
test('DCR proxy: redirect_uri must match exactly even with every control off (baseline)', async () => {
  const w = await createWorld(keys, ungoverned()); const reg = w.proxy.register({ client_name: 'x', redirect_uris: ['https://attacker.example/cb'] });
  const r = w.proxy.authorize({ client_id: reg.client_id, redirect_uri: 'https://attacker.example/other', state: 's', browser: { user: 'user-mark', cookies: new Set() } });
  assert.equal(r.status, 400);
});
test('trace shows decoded claims only, never a compact JWT', async () => {
  for (const a of ATTACKS) for (const p of [ungoverned(), governed()]) {
    const s = JSON.stringify(await runAttack(a, p, keys)); assert.ok(!/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/.test(s), a.id);
  }
});
