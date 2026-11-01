// The OWASP Agentic AI Top 10 (ASI) table of the "ID4AI Workforce - H2 2026" deck, slide 55, rendered AS QUALIFIED, plus the lab's
// reading of which gallery attack touches which row. Pattern copied (not imported) from data-protection-LAB server/src/owasp.js.
//
// Whose words are whose (each field carries the tag in FIELD_TAGS, and the UI shows it):
//   deck claim      `name`, `deck`, `status`, `qualifier`: what the deck says about the row. A Ping release claim, UNVERIFIED on our tenant.
//   lab reading     `labReading` and ATTACK_ASI: the lab's own judgement of which attack touches which row. The deck does not map attacks.
//   lab-invented    `gallery`: what this gallery's mock controls do for the row. The mock gateway is not any Ping product.
// Nothing here is a measurement of a Ping product, and no number from the deck is presented as the gallery's own.
import { ATTACKS } from './catalog.js';

export const CLAIM_LABEL = 'Ping release claim, UNVERIFIED on our tenant';
export const FIELD_TAGS = { name: 'deck claim', deck: 'deck claim', status: 'deck claim', qualifier: 'deck claim', labReading: 'lab reading', attacks: 'lab reading', gallery: 'lab-invented' };
export const STATUS_LABEL = { stated: 'stated in the deck', pending: 'PENDING part', 'in-progress': 'IN PROGRESS', noted: 'deck adds a note' };

// `status`: "stated" (no qualification), "pending" (a named part is pending), "in-progress" (a named integration is in progress),
// "noted" (the deck adds a supplementary note). `qualifier` repeats the deck's own gap in words; empty when the deck has none.
export const ASI_ROWS = [
  { id: 'ASI01', name: 'Agent Goal Hijack', status: 'stated', deck: 'AIGuard: injection, jailbreak and hidden-instruction detection on requests and responses.', qualifier: '', labReading: '',
    gallery: 'No gallery attack maps here. The gallery attacks the token and authorization layer, not prompt content. Content inspection is not built.' },
  { id: 'ASI02', name: 'Tool Misuse & Exploitation', status: 'stated', deck: 'AIGuard: path traversal, destructive commands, SSRF and over-broad scope detection.', qualifier: '', labReading: '',
    gallery: 'SSRF via metadata is the attack the deck names here, and the wrong-scope attack is a related reading of over-broad scope. The mock SSRF guard and scope check are controls of that kind, not the AIGuard detection the deck names.' },
  { id: 'ASI03', name: 'Identity & Privilege Abuse', status: 'stated', deck: 'Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.', qualifier: '', labReading: '',
    gallery: 'Most gallery attacks are identity or privilege abuse at the token layer. The mock controls (scope, ownership, client allowlist, actor, delegation, audience, forwarding, consent, issuer) are generic gateway controls of this kind. Virtual keys, RBAC and live revocation are not built.' },
  { id: 'ASI04', name: 'Agentic Supply Chain', status: 'pending', deck: 'AIGuard: description-injection and typosquatting detection on tool definitions; fingerprint pinning pending.',
    qualifier: 'Fingerprint pinning is PENDING in the deck.', labReading: 'Do not present this row as full coverage.',
    gallery: 'Two attacks involve a hostile server in the chain (issuer mix-up, SSRF via metadata) and map here as a related reading. Tool-definition description-injection, typosquatting detection and fingerprint pinning are not built.' },
  { id: 'ASI05', name: 'Unexpected Code Execution', status: 'stated', deck: 'AIGuard: shell metacharacter, template-injection and fetch-and-execute rules.', qualifier: '', labReading: '',
    gallery: 'No gallery attack maps here. There is no code-execution attack in this set.' },
  { id: 'ASI06', name: 'Memory & Context Poisoning', status: 'in-progress', deck: 'AIGuard: memory-write inspection shipped; gateway integration in progress.',
    qualifier: 'Memory-write inspection is shipped, but the gateway integration is IN PROGRESS in the deck.', labReading: 'Do not present this row as full coverage.',
    gallery: 'No gallery attack maps here. There is no memory or context attack in this set.' },
  { id: 'ASI07', name: 'Insecure Inter-Agent Comm', status: 'stated', deck: 'Gateway + AIGuard: A2A chokepoint with a dedicated scope, plus inter-agent abuse rules.', qualifier: '', labReading: '',
    gallery: 'No gallery attack maps here. There is no agent-to-agent attack in this set, and the A2A chokepoint and its scope are not built.' },
  { id: 'ASI08', name: 'Cascading Agent Failures', status: 'noted', deck: 'Gateway: rate and budget ceilings cap blast radius; guardrail circuit breaker; full event stream to your SIEM.',
    qualifier: 'The deck adds: in-gateway behaviour scoring now supplements it.', labReading: 'Treat this as a supplementary note, not full coverage on its own.',
    gallery: 'No gallery attack maps here. Rate and budget ceilings, the circuit breaker and the SIEM stream are not built.' },
  { id: 'ASI09', name: 'Human-Agent Trust Exploit', status: 'noted', deck: 'AIGuard: enforced by the shared jailbreak, exfiltration, prompt-leak and PII rules on every exchange; findings report under their detection category.',
    qualifier: 'The deck says this is enforced by the shared jailbreak, exfiltration, prompt-leak and PII rules and that findings report under their detection category.', labReading: 'That reads as there being no dedicated ASI09 detector.',
    gallery: 'No gallery attack maps here. Content rules are not built.' },
  { id: 'ASI10', name: 'Rogue Agents', status: 'noted', deck: 'Gateway: no agent reaches a model, tool or peer without a valid scoped key; instant revocation; bounded spend.',
    qualifier: 'The deck adds: in-gateway rogue-agent access scoring supplements it.', labReading: 'Treat this as a supplementary note, not full coverage on its own.',
    gallery: 'The rogue-actor attack is the closest reading: an agent that should not be acting holds a token that names it. The mock shows an actor allow-list refusing it, not scoped keys, revocation or spend bounds, which are not built.' },
];
export const ASI_IDS = ASI_ROWS.map((r) => r.id);

// The lab's reading of which row each attack touches. `primary` is the row the attack is mainly an instance of; `related` is a looser fit.
export const ATTACK_ASI = {
  'wrong-scope': [['ASI03', 'primary'], ['ASI02', 'related']],
  'other-account': [['ASI03', 'primary']],
  'bad-client': [['ASI03', 'primary']],
  'rogue-actor': [['ASI03', 'primary'], ['ASI10', 'related']],
  impersonation: [['ASI03', 'primary']],
  'raw-forwarding': [['ASI03', 'primary']],
  'issuer-mixup': [['ASI03', 'primary'], ['ASI04', 'related']],
  'audience-confusion': [['ASI03', 'primary']],
  'confused-deputy-dcr': [['ASI03', 'primary']],
  'ssrf-metadata': [['ASI02', 'primary'], ['ASI04', 'related']],
};
export const ROLES = ['primary', 'related'];

/** The mapping of one attack: [{ id, role }] in table order, or [] for an id that is not an own key of the table. */
export const asiForAttack = (attackId) => (typeof attackId === 'string' && Object.hasOwn(ATTACK_ASI, attackId) ? ATTACK_ASI[attackId].map(([id, role]) => ({ id, role })).sort((a, b) => ASI_IDS.indexOf(a.id) - ASI_IDS.indexOf(b.id)) : []);

/** The table served at GET /api/asi. `attacks` per row is computed from ATTACK_ASI and the catalog, never typed twice. */
export function asiTable() {
  const rows = ASI_ROWS.map((r) => ({
    ...r,
    statusLabel: STATUS_LABEL[r.status],
    attacks: ATTACKS.flatMap((a) => asiForAttack(a.id).filter((m) => m.id === r.id).map((m) => ({ id: a.id, name: a.name, control: a.control, role: m.role }))),
  }));
  return { claimLabel: CLAIM_LABEL, source: 'ID4AI Workforce - H2 2026 deck, slide 55 (a Ping document; every product claim is a release claim)', fieldTags: FIELD_TAGS, why: WHY, rows };
}

// Section 10 of the feature prompt, row "OWASP Agentic AI Top 10 (55)": the deck's value panel, paraphrased. Ping claims.
export const WHY = {
  title: 'OWASP Agentic AI Top 10 (Ping claim, slide 55)',
  challenge: 'Security review now demands precise answers against the OWASP ASI taxonomy, and vague coverage claims stall approval and procurement.',
  technical: 'Each ASI category maps to a named control and mechanism, with the ASI08, ASI09 and ASI10 coverage notes stated plainly.',
  business: 'Framework-mapped answers accelerate security approval and de-risk the purchase.',
};
