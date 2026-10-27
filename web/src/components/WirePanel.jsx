// "On the wire": the request, the response and the decoded token for one step. Example data from the simulated parties only.
// Every value is rendered as React text (inert); highlights are <mark> elements, never parsed HTML.
import { CLAIM_NOTES, HEADER_NOTES, JARGON, SIGNATURE, compact, wireFor } from '../wire/wire.js';

const when = (v) => new Date(v * 1000).toISOString().replace('.000Z', 'Z');
const show = (k, v) => (typeof v === 'object' ? JSON.stringify(v) : (k === 'exp' || k === 'iat') ? `${v} (${when(v)})` : String(v));

function Line({ text, marks }) {
  const hit = marks.find((m) => text.includes(m));
  if (!hit) return <>{text}</>;
  const i = text.indexOf(hit);
  return <>{text.slice(0, i)}<mark className="wire__hl" title="This is what decides the outcome">{hit}</mark>{text.slice(i + hit.length)}</>;
}
function Message({ title, msg, marks, id }) {
  if (!msg) return null;
  if (msg.none) return <div className="wire__msg"><h4>{title}</h4><p className="muted" data-testid={`${id}-none`}>{msg.none}</p></div>;
  const lines = [msg.start ?? msg.status.line, ...msg.headers.map(([k, v]) => `${k}: ${v}`), ...(msg.body ? ['', ...msg.body.split('\n')] : [])];
  return (
    <div className="wire__msg">
      <h4>{title}</h4>
      <pre className={`code wire__pre${msg.status ? (msg.status.ok ? ' wire__pre--ok' : ' wire__pre--bad') : ''}`} data-testid={id}>
        {lines.map((l, i) => <span key={i} className="wire__line"><Line text={l} marks={marks} />{'\n'}</span>)}
      </pre>
    </div>
  );
}

function TokenBlock({ token, label, key_ }) {
  const [h, p] = compact(token).slice(0, 2);
  const rows = [...Object.entries(token.header).filter(([, v]) => v !== undefined).map(([k, v]) => ['header.' + k, v, HEADER_NOTES[k] || '', false]),
    ...Object.entries(token.claims).map(([k, v]) => [k, v, CLAIM_NOTES[k] || '', (key_.claims || []).includes(k)]),
    ...(key_.missing || []).filter((k) => !(k in token.claims)).map((k) => [k, '(not present)', `${CLAIM_NOTES[k]} This token has none, and that is the point.`, true])];
  return (
    <div className="wire__token">
      <h4>Token: {label}</h4>
      <p className="wire__jwt" data-testid="wire-jwt"><span className="wire__p wire__p--h">{h}</span>.<span className="wire__p wire__p--p">{p}</span>.<span className="wire__p wire__p--s">{SIGNATURE}</span></p>
      <p className="small muted">Three parts joined by dots: header (how it was signed), payload (the claims, the facts it states), signature. The first two are only encoded, not secret, so anyone can read them. The signature here is the fixed text <code>{SIGNATURE}</code>.</p>
      <div className="table-wrap"><table className="table wire__table" data-testid="wire-claims">
        <thead><tr><th scope="col">Field</th><th scope="col">Value</th><th scope="col">What this means</th></tr></thead>
        <tbody>{rows.map(([k, v, note, hot]) => <tr key={k} className={hot ? 'wire__row--hot' : undefined} data-hot={hot ? 'true' : undefined}><td><code>{k}</code></td><td><code>{show(k, v)}</code></td><td>{note}{hot ? <strong> This decides the outcome.</strong> : null}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

/** props: attack (catalog entry), entry (one trace item), jargon (show the glossary box). */
export default function WirePanel({ attack, entry, jargon = true }) {
  const w = wireFor(attack, entry);
  const marks = w.key.marks || [];
  const terms = ['bearer', 'jwt', 'mcp', ...Object.keys(w.token?.claims || {}).concat(w.key.missing || [])].filter((k, i, a) => JARGON[k] && a.indexOf(k) === i);
  const usesGateway = w.req?.start?.includes('gw.gallery.example');
  return (
    <section className="wire" aria-label={`On the wire: ${w.title}`} data-testid="wire-panel">
      <h3>On the wire <span className="badge badge--info">Example data</span></h3>
      <p className="small muted">{w.title}. Hosts end in <code>.example</code> or <code>.invalid</code> and never resolve; ids and signatures are fake.</p>
      {w.none && !w.req ? <p className="wire__none" data-testid="wire-none">{w.none}</p> : (
        <div className="wire__cols">
          <Message id="wire-request" title="Request" msg={w.req} marks={marks} />
          <Message id="wire-response" title="Response" msg={w.res} marks={marks} />
        </div>
      )}
      {w.token && <TokenBlock token={w.token} label={w.tokenLabel || 'the token in play'} key_={w.key} />}
      {w.notice && <p className="wire__notice" data-testid="wire-notice"><strong>What to notice.</strong> {w.notice}</p>}
      {w.hops && <p className="small muted">The request passed through: {w.hops.map((h) => h.address).join(' then ')}.</p>}
      {jargon && terms.length > 0 && (
        <details><summary>Jargon on this step</summary>
          <dl className="facts">{terms.filter((t) => t !== 'mcp' || usesGateway).map((t) => <div key={t} style={{ display: 'contents' }}><dt>{JARGON[t][0]}</dt><dd>{JARGON[t][1]}</dd></div>)}</dl>
        </details>
      )}
    </section>
  );
}
