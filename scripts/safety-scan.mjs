// The payload scan used by live-check.mjs. Pattern: hostile-mcp safety.js (host scan), adapted.
// Findings: a compact JWT, a hostname outside .example/.invalid/example.com|net|org (IP literals must be reserved or private),
// or secret-shaped material.
import net from 'node:net';
import { isPublicAddress } from '../server/src/ipguard.js';

const okHost = (h) => /\.(example|invalid)$/.test(h) || /^example\.(com|net|org)$/.test(h) || (net.isIP(h) && (!isPublicAddress(h).public || h.startsWith('93.184.216.')));

export function scanText(text) {
  const out = [];
  if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) out.push('compact JWT');
  if (/BEGIN (RSA |EC )?PRIVATE KEY|AKIA[0-9A-Z]{16}|auth\.pingone\.|pingidentity\.com/.test(text)) out.push('secret-shaped or product-tenant material');
  const bad = new Set();
  for (const m of text.matchAll(/https?:\/\/(?:[^@/"\s]+@)?(\[[0-9a-f:.]+\]|[^/:"\s\\?#]+)/gi)) { const h = m[1].replace(/^\[|\]$/g, '').toLowerCase(); if (!okHost(h)) bad.add(h); }
  for (const h of bad) out.push(`non-reserved host ${h}`);
  return out;
}
