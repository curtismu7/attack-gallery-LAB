import { selfCheck } from './checks.js';
import { resolveBind } from './bind.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function runDoctor(env = process.env) {
  const { checks } = await selfCheck();
  const add = (id, ok, detail, warn = false) => checks.push({ id, ok, detail, warn });
  add('node', Number(process.versions.node.split('.')[0]) >= 20, `node ${process.versions.node}`);
  try { const b = resolveBind(env); add('bind', true, `${b.host}:${b.port}`); } catch (e) { add('bind', false, e.message); }
  add('web-build', existsSync(fileURLToPath(new URL('../../web/dist/index.html', import.meta.url))), 'web/dist present (run npm run build)', true);
  return { ok: checks.every((c) => c.ok || c.warn), checks };
}
export const formatReport = (r) => r.checks.map((c) => `${c.ok ? 'ok  ' : c.warn ? 'warn' : 'FAIL'} ${c.id}: ${c.detail}`).join('\n') + `\n${r.ok ? 'doctor: ok' : 'doctor: FAILED'}`;
