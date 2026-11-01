#!/usr/bin/env node
// Generates docs/attack-catalog.md, docs/controls.md, docs/asi-mapping.md and docs/talk-track.md from the catalog data (server/src/catalog.js,
// policy.js, asi.js, web/src/data/limits.js, web/src/data/stories). Pattern: hostile-mcp scripts/build-threat-catalog.mjs. Deterministic; scripts/docs.test.mjs fails
// if the committed files are stale.   node scripts/build-docs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = { catalog: path.join(ROOT, 'docs', 'attack-catalog.md'), controls: path.join(ROOT, 'docs', 'controls.md'), asi: path.join(ROOT, 'docs', 'asi-mapping.md'), talkTrack: path.join(ROOT, 'docs', 'talk-track.md') };
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)));
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const refLine = (r) => (r.verified ? `[${r.label}](${r.url}): ${r.read}` : `${r.label}: **UNVERIFIED** (${r.read})`);

export async function buildDocs() {
  const { ATTACKS } = await imp('server/src/catalog.js');
  const { CONTROLS } = await imp('server/src/policy.js');
  const { NOT_STOPPED, GENERAL_LIMITS } = await imp('web/src/data/limits.js');
  const { ASI_ROWS, CLAIM_LABEL, FIELD_TAGS, WHY, asiForAttack, asiTable } = await imp('server/src/asi.js');
  const ctl = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));
  const catalog = ['# Attack catalog', '', 'Generated from `server/src/catalog.js` by `node scripts/build-docs.mjs`. Do not edit by hand; the same data is served at `GET /api/catalog`.', '',
    '| Attack | Pack | Stopped by | Governed error | Ungoverned result | Governed result |', '| --- | --- | --- | --- | --- | --- |',
    ...ATTACKS.map((a) => `| \`${a.id}\` (${cell(a.name)}) | ${a.pack} | \`${a.control}\` | \`${ctl[a.control].error}\` (${ctl[a.control].status}) | ${cell(a.expected.ungoverned)} | ${cell(a.expected.governed)} |`), ''];
  for (const a of ATTACKS) {
    catalog.push(`## ${a.name} (\`${a.id}\`)`, '', `Pack ${a.pack}. Named control: \`${a.control}\`.`, '', `**Goal.** ${a.goal}`, '', `**Story.** ${a.story}`, '', `**OWASP ASI (${FIELD_TAGS.attacks}).** ${asiForAttack(a.id).map((m) => `${m.id} (${m.role})`).join(', ')}`, '', '**Steps.**', '', ...a.steps.map((s, i) => `${i + 1}. ${s.label}`), '', '**References.**', '', ...a.refs.map((r) => `- ${refLine(r)}`), '');
  }
  const controls = ['# Controls', '', 'Generated from `server/src/policy.js` and `web/src/data/limits.js` by `node scripts/build-docs.mjs`. Do not edit by hand.', '',
    'Each control is a flag in the policy. "Governed" has every flag on; "ungoverned" has every flag off. The tests turn on all but one and show that exactly that control\'s attack succeeds. The controls are mocks of logic. No product claim is made except where a seed file is cited.', '',
    '| Control | Error | Stops | What it does |', '| --- | --- | --- | --- |',
    ...CONTROLS.map((c) => `| \`${c.id}\` (${cell(c.name)}) | \`${c.error}\` (${c.status}) | ${ATTACKS.filter((a) => a.control === c.id).map((a) => `\`${a.id}\``).join(', ')} | ${cell(c.does)} |`), ''];
  for (const c of CONTROLS) {
    controls.push(`## ${c.name} (\`${c.id}\`)`, '', c.message, '', `Product evidence: ${c.seed ? `seed file in the AI-DEMO2 repo, ${c.seed}` : 'none; described as "a gateway control of this kind".'}`, '', '**References.**', '', ...c.refs.map((r) => `- ${refLine(r)}`), '', '**What it does not stop.**', '', ...NOT_STOPPED[c.id].map((x) => `- ${x}`), '');
  }
  controls.push('## Limits that apply to every control', '', ...GENERAL_LIMITS.map((x) => `- ${x}`), '');
  const name = Object.fromEntries(ASI_ROWS.map((r) => [r.id, r.name]));
  const table = asiTable();
  const asi = ['# OWASP ASI mapping', '', `Generated from \`server/src/asi.js\` and \`server/src/catalog.js\` by \`node scripts/build-docs.mjs\`. Do not edit by hand; the same data is served at \`GET /api/asi\`.`, '',
    `**${CLAIM_LABEL}.** The table of ASI01 to ASI10 is slide 55 of Ping's "ID4AI Workforce - H2 2026" deck (release dated 2026-11-02). Which attack touches which row is the lab's own reading (${FIELD_TAGS.attacks}): the deck does not map attacks. The gallery's controls are mocks (${FIELD_TAGS.gallery}), not Privilege features, and nothing here was run on a Ping tenant.`, '',
    '## Attack to row', '', '| Attack | Stopped by (mock control) | Primary row | Related rows |', '| --- | --- | --- | --- |',
    ...ATTACKS.map((a) => { const m = asiForAttack(a.id); return `| \`${a.id}\` (${cell(a.name)}) | \`${a.control}\` | ${m.filter((x) => x.role === 'primary').map((x) => `${x.id} ${name[x.id]}`).join(', ')} | ${m.filter((x) => x.role === 'related').map((x) => `${x.id} ${name[x.id]}`).join(', ') || 'none'} |`; }), '',
    '## Row to attack, with the deck text', '', `Field tags: name, deck text, status and qualifier are a ${FIELD_TAGS.deck}; the attack list is a ${FIELD_TAGS.attacks}; the "in this gallery" text is ${FIELD_TAGS.gallery}.`, '',
    '| Row | The deck says | Status in the deck | Attacks mapped here | In this gallery |', '| --- | --- | --- | --- | --- |',
    ...table.rows.map((r) => `| ${r.id} ${cell(r.name)} | ${cell(r.deck)}${r.qualifier ? ` **${cell(r.qualifier)}**` : ''}${r.labReading ? ` ${cell(r.labReading)}` : ''} | ${r.statusLabel} | ${r.attacks.length ? r.attacks.map((x) => `\`${x.id}\` (${x.role})`).join(', ') : 'none'} | ${cell(r.gallery)} |`), ''];
  const stories = fs.readdirSync(path.join(ROOT, 'web/src/data/stories')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'web/src/data/stories', f), 'utf8')));
  const none = table.rows.filter((r) => r.attacks.length === 0);
  const talk = ['# Talk track', '', 'Generated from `server/src/asi.js`, `server/src/catalog.js` and `web/src/data/stories` by `node scripts/build-docs.mjs`. Do not edit by hand. A test fails if this file is stale.', '',
    '## Start with the label', '', `Say what the banner says: **${CLAIM_LABEL}.** The OWASP table is Ping's deck, slide 55, for a release dated 2026-11-02. The attacks, the mock controls and the refusals are this gallery's own and run offline; they are not a test of any Ping product.`, '',
    '## The OWASP Agentic Top 10, as qualified', '', 'Open the OWASP ASI tab. Each category shows what the deck says addresses it. The deck states its own gaps and the table repeats them rather than rounding up: fingerprint pinning for the supply chain (ASI04) is pending, memory-write inspection (ASI06) is shipped but the gateway integration is in progress, and ASI08, ASI09 and ASI10 carry notes. Do not present those rows as full coverage.', '',
    `Which attack touches which row is our reading, not the deck's. ${none.length} of ${table.rows.length} rows have no gallery attack (${none.map((r) => r.id).join(', ')}): say so rather than stretching an attack over them.`, '',
    '## Walk the attacks', ''];
  for (const a of ATTACKS) {
    const m = asiForAttack(a.id); const c = ctl[a.control];
    const deckSays = m.map((x) => { const r = ASI_ROWS.find((y) => y.id === x.id); return `${x.id}: ${r.deck}${r.qualifier ? ` ${r.qualifier}` : ''}`; }).join(' ');
    talk.push(`### ${a.name}`, '', `Maps to ${m.map((x) => `${x.id} ${name[x.id]} (${x.role})`).join(' and ')}: ${FIELD_TAGS.attacks}. The deck says (${FIELD_TAGS.deck}, unverified on our tenant) ${deckSays}`, '',
      `Run it both ways. Ungoverned: ${a.expected.ungoverned} Governed: ${a.expected.governed} The control is this gallery's mock "${c.name}" (\`${a.control}\`), a control of that kind, not a Privilege feature.`, '');
  }
  talk.push('## The rows with no attack', '', ...none.map((r) => `- **${r.id} ${r.name}.** ${r.gallery}`), '',
    `## Why it matters: ${WHY.title}`, '', `Challenge: ${WHY.challenge} Technical: ${WHY.technical} Business: ${WHY.business} Ping claims, unverified on our tenant.`, '',
    '## What is not proven', '', `Nothing in the OWASP table was run on our tenant: every control and note is Ping's. The attack-to-row mapping is a ${FIELD_TAGS.attacks}; the "in this gallery" statements describe mocks (${FIELD_TAGS.gallery}). No field here comes from the console schema, and nothing is a measurement of a Ping product.`, '',
    '## The two stories', '', 'The Stories tab holds a step-by-step talk track for each, re-skinned for three verticals:', '', ...stories.map((st) => `- **${st.id}: ${st.title}** Runs the attack${st.modes.length > 1 ? 's' : ''} ${st.modes.map((x) => `\`${x}\``).join(', ')}.`), '');
  return { catalog: catalog.join('\n'), controls: controls.join('\n'), asi: asi.join('\n'), talkTrack: talk.join('\n') };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildDocs();
  for (const k of Object.keys(DOCS)) fs.writeFileSync(DOCS[k], out[k]);
  console.log('wrote docs/attack-catalog.md, docs/controls.md, docs/asi-mapping.md, docs/talk-track.md');
}
