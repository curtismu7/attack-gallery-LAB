#!/usr/bin/env node
/**
 * Generates content-pack.json (repo root). Format: docs/content-pack.schema.json (a copy of the ID-JAG kit's schema).
 * Pattern copied from hostile-mcp scripts/build-content-pack.mjs. Glossary from content/terms.json; the two stories from
 * web/src/data/stories (story ids G1/G2 map to the schema's S01/S02). Deterministic: sorted, 2-space JSON, no timestamps.
 *   node scripts/build-content-pack.mjs [--commit=<sha>]
 *
 * Sources: only URLs recorded as fetched in docs/references.md. status "verified" = fetched and read in step GA2;
 * "read" = fetched and read in step GA0 (recorded there).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WHY } from '../server/src/asi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PACK_PATH = path.join(ROOT, 'content-pack.json');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const STORY_IDS = { G1: 'S01', G2: 'S02' };
const src = (id, title, url, use, status, checked) => ({ id, title, url, kind: 'spec', use, status, checked });
const SOURCES = [
  src('mcp-security-best-practices', 'MCP Security Best Practices (2025-11-25)', 'https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices', 'Confused deputy, token passthrough, SSRF, scope minimization', 'verified', '2026-10-21'),
  src('mcp-authorization', 'MCP Authorization (2026-07-28)', 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization', 'Resource parameter, token handling, access token privilege restriction, insufficient scope', 'read', '2026-10-21'),
  src('rfc9207', 'RFC 9207: OAuth 2.0 Authorization Server Issuer Identification', 'https://www.rfc-editor.org/rfc/rfc9207.html', 'iss response parameter and the mix-up attack', 'read', '2026-10-21'),
  src('rfc8707', 'RFC 8707: Resource Indicators for OAuth 2.0', 'https://www.rfc-editor.org/rfc/rfc8707.html', 'resource parameter and audience restriction', 'read', '2026-10-21'),
  src('rfc8693', 'RFC 8693: OAuth 2.0 Token Exchange', 'https://www.rfc-editor.org/rfc/rfc8693.html', 'act claim (section 4.1); impersonation text not read', 'read', '2026-10-21'),
  src('rfc9728', 'RFC 9728: OAuth 2.0 Protected Resource Metadata', 'https://www.rfc-editor.org/rfc/rfc9728.html', 'Audience-restricted tokens (7.4) and SSRF precautions on metadata fetches (7.7)', 'read', '2026-10-21'),
];
const CARDS = [
  { id: 'gallery', label: 'Attack gallery', description: 'Ten named attacks, each run ungoverned and governed.', group: 'try-it', href: '/#/gallery', terms: ['actor-injection', 'object-level-authorization', 'token-passthrough'] },
  { id: 'compare', label: 'Compare matrix', description: 'Attacks against controls: with one control off, only its own attack succeeds.', group: 'try-it', href: '/#/compare', terms: ['audience-binding'] },
  { id: 'story-token-elsewhere', label: 'Story: the agent used my token somewhere else', description: 'Audience confusion: a genuine token for one resource presented at another.', group: 'try-it', href: '/#/stories', terms: ['audience-binding', 'resource-indicator', 'token-passthrough'], story: 'S01' },
  { id: 'story-which-as', label: 'Story: which authorization server is this?', description: 'Issuer mix-up: the client must read iss and compare it with the server it asked.', group: 'try-it', href: '/#/stories', terms: ['mix-up-attack', 'issuer-identification'], story: 'S02' },
  { id: 'ssrf-metadata', label: 'SSRF via metadata', description: 'A hostile server points metadata URLs at internal names; the governed client refuses them. Fake network only.', group: 'try-it', href: '/#/attack/ssrf-metadata', terms: ['ssrf'] },
  { id: 'confused-deputy-dcr', label: 'Confused deputy via static client and DCR', description: 'Why a proxy needs per-client consent.', group: 'try-it', href: '/#/attack/confused-deputy-dcr', terms: ['confused-deputy', 'dynamic-client-registration'] },
  { id: 'asi-mapping', label: 'OWASP ASI mapping (Ping release claim, unverified on our tenant)', description: 'Slide 55 of the H2 2026 deck, ASI01 to ASI10 as qualified, with the gallery attacks the lab reads into each row. The mapping of attacks to rows is the lab\'s reading.', group: 'concept', href: '/#/asi', terms: ['owasp-asi'] },
  { id: 'concept-why-owasp', label: 'Why it matters: OWASP Agentic AI Top 10 (Ping claim, slide 55)', description: `Challenge: ${WHY.challenge} Technical: ${WHY.technical} Business: ${WHY.business} Ping claims, unverified on our tenant.`, group: 'concept', href: '/#/asi', terms: ['owasp-asi'] },
  { id: 'controls', label: 'Controls', description: 'The ten named controls, the error each returns and the attack each stops.', group: 'concept', href: '/#/controls' },
  { id: 'limits', label: 'Honest limits', description: 'What the gallery does not claim, and which citations are UNVERIFIED.', group: 'reference', href: '/#/limits' },
];

export function buildPack({ commit } = {}) {
  const pkg = readJson('package.json');
  const stories = fs.readdirSync(path.join(ROOT, 'web/src/data/stories')).filter((f) => f.endsWith('.json')).map((f) => ({ f, s: readJson(`web/src/data/stories/${f}`) }))
    .map(({ f, s }) => {
      if (!STORY_IDS[s.id]) throw new Error(`story ${s.id} has no pack id in STORY_IDS`);
      return { id: STORY_IDS[s.id], title: s.title, say: s.say, file: `web/src/data/stories/${f}` };
    }).sort(byId);
  const ids = new Set(stories.map((s) => s.id));
  const pack = {
    schema: 'demo-content-pack/1',
    id: 'attack-gallery',
    title: 'Agent attack gallery',
    version: pkg.version,
    ...(commit ? { source: { repo: 'attack-gallery', commit } } : {}),
    demo: { id: 'attack-gallery', name: 'Agent attack gallery', catalog: 'D33', baseUrl: 'http://localhost:5181', doctor: '/api/health', tags: ['mcp', 'authorization', 'attacks', 'mix-up', 'ssrf', 'audience', 'owasp-asi'] },
    glossary: readJson('content/terms.json').sort(byId),
    sources: SOURCES.slice().sort(byId),
    cards: CARDS.map(({ href, ...c }) => ({ ...c, action: { type: 'route', href } })).sort(byId),
    diagrams: [{ id: 'attack-path', label: 'Parties and control points for the selected attack', href: '/#/diagram' }],
    stories,
  };
  for (const c of pack.cards) if (c.story && !ids.has(c.story)) throw new Error(`card ${c.id} names unknown story ${c.story}`);
  return pack;
}
export const serialize = (pack) => `${JSON.stringify(pack, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = process.argv.find((a) => a.startsWith('--commit='))?.slice(9);
  fs.writeFileSync(PACK_PATH, serialize(buildPack({ commit })));
  console.log(`wrote ${path.relative(process.cwd(), PACK_PATH) || PACK_PATH}`);
}
