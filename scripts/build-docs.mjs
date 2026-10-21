#!/usr/bin/env node
// Generates docs/attack-catalog.md and docs/controls.md from the catalog data (server/src/catalog.js, policy.js,
// web/src/data/limits.js). Pattern: hostile-mcp scripts/build-threat-catalog.mjs. Deterministic; scripts/docs.test.mjs fails
// if the committed files are stale.   node scripts/build-docs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = { catalog: path.join(ROOT, 'docs', 'attack-catalog.md'), controls: path.join(ROOT, 'docs', 'controls.md') };
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)));
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const refLine = (r) => (r.verified ? `[${r.label}](${r.url}): ${r.read}` : `${r.label}: **UNVERIFIED** (${r.read})`);

export async function buildDocs() {
  const { ATTACKS } = await imp('server/src/catalog.js');
  const { CONTROLS } = await imp('server/src/policy.js');
  const { NOT_STOPPED, GENERAL_LIMITS } = await imp('web/src/data/limits.js');
  const ctl = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));
  const catalog = ['# Attack catalog', '', 'Generated from `server/src/catalog.js` by `node scripts/build-docs.mjs`. Do not edit by hand; the same data is served at `GET /api/catalog`.', '',
    '| Attack | Pack | Stopped by | Governed error | Ungoverned result | Governed result |', '| --- | --- | --- | --- | --- | --- |',
    ...ATTACKS.map((a) => `| \`${a.id}\` (${cell(a.name)}) | ${a.pack} | \`${a.control}\` | \`${ctl[a.control].error}\` (${ctl[a.control].status}) | ${cell(a.expected.ungoverned)} | ${cell(a.expected.governed)} |`), ''];
  for (const a of ATTACKS) {
    catalog.push(`## ${a.name} (\`${a.id}\`)`, '', `Pack ${a.pack}. Named control: \`${a.control}\`.`, '', `**Goal.** ${a.goal}`, '', `**Story.** ${a.story}`, '', '**Steps.**', '', ...a.steps.map((s, i) => `${i + 1}. ${s.label}`), '', '**References.**', '', ...a.refs.map((r) => `- ${refLine(r)}`), '');
  }
  const controls = ['# Controls', '', 'Generated from `server/src/policy.js` and `web/src/data/limits.js` by `node scripts/build-docs.mjs`. Do not edit by hand.', '',
    'Each control is a flag in the policy. "Governed" has every flag on; "ungoverned" has every flag off. The tests turn on all but one and show that exactly that control\'s attack succeeds. The controls are mocks of logic. No product claim is made except where a seed file is cited.', '',
    '| Control | Error | Stops | What it does |', '| --- | --- | --- | --- |',
    ...CONTROLS.map((c) => `| \`${c.id}\` (${cell(c.name)}) | \`${c.error}\` (${c.status}) | ${ATTACKS.filter((a) => a.control === c.id).map((a) => `\`${a.id}\``).join(', ')} | ${cell(c.does)} |`), ''];
  for (const c of CONTROLS) {
    controls.push(`## ${c.name} (\`${c.id}\`)`, '', c.message, '', `Product evidence: ${c.seed ? `seed file in the AI-DEMO2 repo, ${c.seed}` : 'none; described as "a gateway control of this kind".'}`, '', '**References.**', '', ...c.refs.map((r) => `- ${refLine(r)}`), '', '**What it does not stop.**', '', ...NOT_STOPPED[c.id].map((x) => `- ${x}`), '');
  }
  controls.push('## Limits that apply to every control', '', ...GENERAL_LIMITS.map((x) => `- ${x}`), '');
  return { catalog: catalog.join('\n'), controls: controls.join('\n') };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildDocs();
  for (const k of Object.keys(DOCS)) fs.writeFileSync(DOCS[k], out[k]);
  console.log('wrote docs/attack-catalog.md, docs/controls.md');
}
