import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS } from '../src/catalog.js';
import { ASI_IDS, ASI_ROWS, ATTACK_ASI, CLAIM_LABEL, FIELD_TAGS, ROLES, STATUS_LABEL, WHY, asiForAttack, asiTable } from '../src/asi.js';
import { createApp } from '../src/app.js';

const row = (id) => ASI_ROWS.find((r) => r.id === id);
const TAGS = ['deck claim', 'console swagger name (schema only)', 'lab reading', 'lab-invented', 'measured (our note)'];

test('ASI01 to ASI10 in order, each with the deck name, the deck control text, a status and a statement of what this gallery shows', () => {
  assert.deepEqual(ASI_IDS, Array.from({ length: 10 }, (_, i) => `ASI${String(i + 1).padStart(2, '0')}`));
  for (const r of ASI_ROWS) { assert.ok(r.name && r.deck && r.gallery, r.id); assert.ok(Object.hasOwn(STATUS_LABEL, r.status), r.id); }
  assert.equal(row('ASI03').name, 'Identity & Privilege Abuse'); assert.equal(row('ASI07').name, 'Insecure Inter-Agent Comm');
});

test('the deck\'s own stated gaps are kept as qualified, never rounded up to full coverage', () => {
  assert.equal(row('ASI04').status, 'pending'); assert.match(row('ASI04').deck, /fingerprint pinning pending/); assert.match(row('ASI04').qualifier, /PENDING/); assert.match(row('ASI04').labReading, /Do not present this row as full coverage/);
  assert.equal(row('ASI06').status, 'in-progress'); assert.match(row('ASI06').deck, /memory-write inspection shipped; gateway integration in progress/); assert.match(row('ASI06').qualifier, /IN PROGRESS/); assert.match(row('ASI06').labReading, /Do not present this row as full coverage/);
  for (const id of ['ASI08', 'ASI09', 'ASI10']) { assert.equal(row(id).status, 'noted', id); assert.ok(row(id).qualifier.length > 40, id); assert.ok(row(id).labReading.length > 20, id); }
  assert.match(row('ASI08').qualifier, /in-gateway behaviour scoring now supplements it/); assert.match(row('ASI10').qualifier, /rogue-agent access scoring supplements/); assert.match(row('ASI09').labReading, /no dedicated ASI09 detector/);
  assert.deepEqual(ASI_ROWS.filter((r) => r.status === 'stated').map((r) => r.id), ['ASI01', 'ASI02', 'ASI03', 'ASI05', 'ASI07'], 'only these rows carry no qualification in the deck');
  for (const r of ASI_ROWS.filter((x) => x.status === 'stated')) assert.equal(r.qualifier, '', r.id);
  for (const r of ASI_ROWS.filter((x) => x.status !== 'stated')) assert.ok(r.qualifier, r.id);
  for (const r of ASI_ROWS) assert.ok(!/fully covered|full coverage\./i.test(`${r.deck} ${r.qualifier} ${r.gallery}`), r.id);
});

test('what the gallery shows is stated honestly: rows it cannot show say so, and no row claims a product control is built here', () => {
  for (const id of ['ASI01', 'ASI05', 'ASI06', 'ASI07', 'ASI08', 'ASI09']) assert.match(row(id).gallery, /^No gallery attack maps here\./, id);
  for (const id of ['ASI03', 'ASI04', 'ASI10']) assert.match(row(id).gallery, /not built/, id);
  assert.match(row('ASI04').gallery, /fingerprint pinning are not built/);
  assert.match(row('ASI02').gallery, /not the AIGuard detection/);
});

test('every attack maps to at least one valid row, exactly one primary, and the mapping table has no orphan key', () => {
  assert.deepEqual(Object.keys(ATTACK_ASI).sort(), ATTACKS.map((a) => a.id).sort());
  for (const a of ATTACKS) {
    const m = asiForAttack(a.id);
    assert.ok(m.length >= 1 && m.length <= 3, a.id);
    assert.equal(m.filter((x) => x.role === 'primary').length, 1, `${a.id}: one primary`);
    assert.equal(new Set(m.map((x) => x.id)).size, m.length, `${a.id}: no duplicate row`);
    for (const x of m) { assert.ok(ASI_IDS.includes(x.id), `${a.id}: ${x.id}`); assert.ok(ROLES.includes(x.role), `${a.id}: ${x.role}`); }
  }
});

test('the lab reading, pinned per attack (primary row, and the related rows it adds)', () => {
  const pin = { 'wrong-scope': ['ASI03', ['ASI02']], 'other-account': ['ASI03', []], 'bad-client': ['ASI03', []], 'rogue-actor': ['ASI03', ['ASI10']], impersonation: ['ASI03', []], 'raw-forwarding': ['ASI03', []], 'issuer-mixup': ['ASI03', ['ASI04']], 'audience-confusion': ['ASI03', []], 'confused-deputy-dcr': ['ASI03', []], 'ssrf-metadata': ['ASI02', ['ASI04']] };
  for (const a of ATTACKS) {
    const m = asiForAttack(a.id); const [primary, related] = pin[a.id];
    assert.equal(m.find((x) => x.role === 'primary').id, primary, a.id);
    assert.deepEqual(m.filter((x) => x.role === 'related').map((x) => x.id), related, a.id);
  }
});

test('asiForAttack is hostile-input safe: only own string keys of the table answer', () => {
  for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'nope', '', undefined, null, 7, {}, ['wrong-scope']]) assert.deepEqual(asiForAttack(bad), [], String(bad));
});

test('the served table derives each row\'s attacks from the mapping and the catalog, so the two views cannot disagree', () => {
  const t = asiTable();
  assert.deepEqual(t.rows.map((r) => r.id), ASI_IDS);
  for (const r of t.rows) {
    const expected = ATTACKS.filter((a) => asiForAttack(a.id).some((m) => m.id === r.id)).map((a) => a.id);
    assert.deepEqual(r.attacks.map((x) => x.id), expected, r.id);
    for (const x of r.attacks) { const a = ATTACKS.find((y) => y.id === x.id); assert.equal(x.name, a.name); assert.equal(x.control, a.control); assert.equal(x.role, asiForAttack(x.id).find((m) => m.id === r.id).role); }
    assert.equal(r.statusLabel, STATUS_LABEL[r.status]);
  }
  assert.deepEqual(t.rows.filter((r) => r.attacks.length === 0).map((r) => r.id), ['ASI01', 'ASI05', 'ASI06', 'ASI07', 'ASI08', 'ASI09']);
  assert.deepEqual(t.rows.find((r) => r.id === 'ASI03').attacks.map((x) => x.id), ATTACKS.map((a) => a.id).filter((id) => id !== 'ssrf-metadata'));
});

test('every field of the table carries a tag from the allowed set; nothing is tagged measured or swagger (no such data here)', () => {
  assert.deepEqual(Object.keys(FIELD_TAGS).sort(), ['attacks', 'deck', 'gallery', 'labReading', 'name', 'qualifier', 'status']);
  for (const [k, v] of Object.entries(FIELD_TAGS)) { assert.ok(TAGS.includes(v), k); assert.ok(!/measured|swagger/.test(v), k); }
  assert.equal(FIELD_TAGS.deck, 'deck claim'); assert.equal(FIELD_TAGS.attacks, 'lab reading'); assert.equal(FIELD_TAGS.gallery, 'lab-invented'); assert.equal(FIELD_TAGS.labReading, 'lab reading');
  assert.equal(asiTable().claimLabel, 'Ping release claim, UNVERIFIED on our tenant'); assert.equal(CLAIM_LABEL, asiTable().claimLabel);
});

test('Why it matters is the deck\'s value panel, paraphrased, with challenge, technical and business lines and no Ping number presented as ours', () => {
  assert.match(WHY.title, /slide 55/); for (const k of ['challenge', 'technical', 'business']) assert.ok(WHY[k].length > 40, k);
  assert.match(WHY.technical, /ASI08, ASI09 and ASI10/);
  assert.ok(!/\d+ ?%/.test(JSON.stringify(WHY)), 'the deck\'s market percentages are not quoted');
});

let server, base, health;
before(async () => {
  const { app, health: h } = await createApp(); health = h; await h.ready;
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { health.stop(); server.close(); });

test('GET /api/asi is 200 JSON equal to the generated table, and /api/catalog carries each attack\'s mapping', async () => {
  const r = await fetch(`${base}/api/asi`); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /json/);
  assert.deepEqual(await r.json(), JSON.parse(JSON.stringify(asiTable())));
  const c = await (await fetch(`${base}/api/catalog`)).json();
  for (const a of c.attacks) assert.deepEqual(a.asi, asiForAttack(a.id), a.id);
});
test('/api/asi is read-only: other methods get the fixed JSON 404', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) { const r = await fetch(`${base}/api/asi`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId: 'wrong-scope' }) }); assert.equal(r.status, 404, method); const t = await r.text(); assert.deepEqual(JSON.parse(t), { error: 'not_found' }); }
});

test('the hosted-mock variant serves the table too (GET), and still refuses a query string', async () => {
  const { app, health: h } = await createApp({ mockOnly: true, allowedHosts: [] });
  const s = await new Promise((r) => { const x = app.listen(0, '127.0.0.1', () => r(x)); }); const b = `http://127.0.0.1:${s.address().port}`;
  try {
    const ok = await fetch(`${b}/api/asi`); assert.equal(ok.status, 200); assert.equal((await ok.json()).rows.length, 10);
    assert.equal((await fetch(`${b}/api/asi?x=1`)).status, 403);
    assert.equal((await fetch(`${b}/api/asi`, { method: 'POST' })).status, 403);
  } finally { h.stop(); s.close(); }
});
