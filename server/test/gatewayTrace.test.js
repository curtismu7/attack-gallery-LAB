// Rule 25, "What Privilege did": the gallery's gateway is a simulation, so every trace is 'mock' and every decision 'checked'.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS } from '../src/catalog.js';
import { runAttack } from '../src/runner.js';
import { createKeyring, createWorld } from '../src/parties.js';
import { governed, ungoverned } from '../src/policy.js';
import { URLS } from '../src/world.js';
import { assertTrace } from '../src/gatewayTrace.js';
import { gatewayExchange } from '../src/galleryTrace.js';

let keys; before(async () => { keys = await createKeyring(); });
const GATEWAY_FREE = ['confused-deputy-dcr', 'ssrf-metadata']; // decided by the proxy and the client's fetch guard, never by the gateway
const gatewayCalls = (run) => run.trace.filter((t) => t.gateway);
const decision = (t, id) => t.gateway.decisions.find((d) => d.id === id);

test('every gateway call of every attack, both sides, is a valid mock trace of checked decisions', async () => {
  for (const a of ATTACKS) {
    for (const [side, policy] of [['ungoverned', ungoverned()], ['governed', governed()]]) {
      const run = await runAttack(a, policy, keys);
      for (const e of gatewayCalls(run)) {
        assert.deepEqual(assertTrace(e.gateway), [], `${a.id} ${side} step ${e.n}`);
        assert.equal(e.gateway.source, 'mock');
        assert.equal(e.gateway.request.url, URLS.gateway);
        assert.ok(e.gateway.decisions.length >= 7, `${a.id} ${side}`);
        assert.ok(e.gateway.decisions.every((d) => d.basis === 'checked'), `${a.id} ${side}`);
        assert.equal(e.gateway.response.status, e.response.status);
      }
      if (GATEWAY_FREE.includes(a.id)) assert.equal(gatewayCalls(run).length, 0, a.id);
      else if (side === 'ungoverned') assert.ok(gatewayCalls(run).length >= 1, a.id);
    }
  }
});

test('an ungoverned run shows every control that is OFF as information, never as passed', async () => {
  const run = await runAttack(ATTACKS.find((a) => a.id === 'wrong-scope'), ungoverned(), keys);
  const t = gatewayCalls(run).at(-1);
  for (const id of ['audience_binding', 'client_allowlist', 'act_validation', 'scope_check', 'ownership_check']) {
    assert.equal(decision(t, id).outcome, 'info', id); assert.match(decision(t, id).evidence, /^OFF in this run, so not checked/);
  }
  assert.equal(decision(t, 'authenticated').outcome, 'pass'); // the baseline check is never off
  assert.equal(t.gateway.response.status, 200);
});

test('governed: the named control fails, later checks are not reached, earlier ones passed', async () => {
  const run = await runAttack(ATTACKS.find((a) => a.id === 'wrong-scope'), governed(), keys);
  const t = gatewayCalls(run).at(-1);
  assert.equal(decision(t, 'scope_check').outcome, 'fail');
  assert.match(decision(t, 'scope_check').evidence, /needs accounts:write, the token has accounts:read/);
  assert.equal(decision(t, 'audience_binding').outcome, 'pass');
  assert.equal(decision(t, 'ownership_check').outcome, 'skipped');
  assert.equal(t.gateway.response.status, 403);
  assert.deepEqual(t.gateway.response.body.error, 'insufficient_scope');
});

test('governed: the control that stops each gateway-decided attack is the failing decision, and the only one', async () => {
  for (const id of ['wrong-scope', 'other-account', 'bad-client', 'rogue-actor', 'impersonation', 'audience-confusion']) {
    const run = await runAttack(ATTACKS.find((a) => a.id === id), governed(), keys);
    const t = gatewayCalls(run).at(-1);
    const failed = t.gateway.decisions.filter((d) => d.outcome === 'fail').map((d) => d.id);
    assert.deepEqual(failed, [run.refusal.control], id);
  }
});

test('raw-forwarding governed: the token exchange is a passed check, and the replay finds nothing to replay', async () => {
  const run = await runAttack(ATTACKS.find((a) => a.id === 'raw-forwarding'), governed(), keys);
  const sync = gatewayCalls(run)[0];
  assert.equal(decision(sync, 'no_token_forwarding').outcome, 'pass');
  assert.equal(gatewayCalls(run).length, 1); // the replay step found a different token and made no gateway call
  const raw = await runAttack(ATTACKS.find((a) => a.id === 'raw-forwarding'), ungoverned(), keys);
  assert.equal(decision(gatewayCalls(raw)[0], 'no_token_forwarding').outcome, 'info');
  assert.equal(gatewayCalls(raw).length, 2); // sync_statement, then the replay with the captured token
});

test('rogue-actor ungoverned: the caller-supplied header is shown as what decided the actor', async () => {
  const run = await runAttack(ATTACKS.find((a) => a.id === 'rogue-actor'), ungoverned(), keys);
  const t = gatewayCalls(run).at(-1);
  assert.match(decision(t, 'act_validation').evidence, /unsigned X-Actor-Client=agent-ok header/);
  assert.equal(t.gateway.request.headers['x-actor-client'], 'agent-ok');
});

test('no bearer, a forged token and an unknown tool each stop at the right check, the rest not reached', async () => {
  const w = await createWorld(keys, governed());
  const none = await w.gateway.handle({ tool: 'list_accounts', headers: {} });
  assert.equal(none.decisions[0].outcome, 'fail'); assert.ok(none.decisions.slice(1).every((d) => d.outcome === 'skipped'));
  const forged = await w.evil.forgeTokenClaimingGoodIssuer({ sub: 'user-mark', aud: URLS.gateway, scope: 'accounts:read', azp: 'client-legit' });
  const bad = await w.gateway.handle({ tool: 'list_accounts', headers: { authorization: `Bearer ${forged}` } });
  assert.equal(bad.decisions.find((d) => d.id === 'authenticated').outcome, 'fail');
  assert.ok(bad.decisions.filter((d) => d.id !== 'authenticated').every((d) => d.outcome === 'skipped'));
  const good = await w.good.issue({ sub: 'user-mark', client: 'client-legit', aud: URLS.gateway, scope: 'accounts:read' });
  const unknown = await w.gateway.handle({ tool: 'no_such_tool', headers: { authorization: `Bearer ${good}` } });
  assert.deepEqual(unknown.decisions.map((d) => [d.id, d.outcome]).slice(0, 2), [['authenticated', 'pass'], ['tool', 'fail']]);
  for (const r of [none, bad, unknown]) assert.deepEqual(assertTrace(gatewayExchange({ tool: 'list_accounts', bearer: 'x'.repeat(10), r })), []);
});

test('a call that passes (or skips) every check but the tool answers an error shows a failed tool result', async () => {
  const w = await createWorld(keys, ungoverned());
  const token = await w.good.issue({ sub: 'user-mark', client: 'client-legit', aud: URLS.gateway, scope: 'accounts:read' });
  const r = await w.gateway.handle({ tool: 'get_account', args: { accountId: 'acc-nope' }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 404);
  assert.deepEqual(r.decisions.filter((d) => d.outcome === 'fail').map((d) => d.id), ['result']);
  assert.deepEqual(assertTrace(gatewayExchange({ tool: 'get_account', bearer: token, r })), []);
});

test('no secret in a trace: a token minted at runtime appears nowhere, only its length', async () => {
  const w = await createWorld(keys, governed());
  const token = await w.good.issue({ sub: 'user-mark', client: 'client-legit', aud: URLS.gateway, scope: 'accounts:read' });
  const r = await w.gateway.handle({ tool: 'list_accounts', headers: { authorization: `Bearer ${token}` } });
  const trace = gatewayExchange({ tool: 'list_accounts', bearer: token, r });
  assert.deepEqual(assertTrace(trace), []);
  const text = JSON.stringify(trace);
  assert.ok(!text.includes(token)); assert.ok(!text.includes(token.split('.')[2])); assert.ok(!/eyJ/.test(text));
  assert.equal(trace.request.headers.authorization, `Bearer <token, ${token.length} characters, kept on the server>`);
  // and the whole API reply of a run carries no compact token either
  const run = await runAttack(ATTACKS.find((a) => a.id === 'audience-confusion'), ungoverned(), keys);
  assert.ok(!/eyJ[\w-]{10,}\.[\w-]{10,}/.test(JSON.stringify(run)));
});

test('the check can fail: a real trace with a checked decision, or a full bearer, is refused by assertTrace', async () => {
  const run = await runAttack(ATTACKS.find((a) => a.id === 'wrong-scope'), governed(), keys);
  const t = gatewayCalls(run).at(-1).gateway;
  assert.notDeepEqual(assertTrace({ ...t, source: 'real' }), []);
  assert.notDeepEqual(assertTrace({ ...t, decisions: [{ ...t.decisions[0], outcome: 'maybe' }] }), []);
});
