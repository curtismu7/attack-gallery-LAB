// One side of an attack: the numbered request/response trail, what the attacker gained, or the refusal.
// Every string below comes from the API and is rendered as React text children (inert): nothing is ever parsed as HTML.
const CLAIM_ORDER = ['iss', 'sub', 'aud', 'scope', 'azp', 'act', 'exp'];
const show = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));

export function Claims({ token }) {
  if (!token?.claims) return null;
  const keys = [...CLAIM_ORDER.filter((k) => k in token.claims), ...Object.keys(token.claims).filter((k) => !CLAIM_ORDER.includes(k) && !['jti', 'iat', 'client_id'].includes(k))];
  return (
    <dl className="claims" aria-label="Decoded token claims (redacted: the compact token is never shown)">
      {keys.map((k) => <div key={k}><dt>{k}</dt><dd>{show(token.claims[k])}</dd></div>)}
    </dl>
  );
}
const pretty = (o) => JSON.stringify(o, null, 2);
const VERDICT = { ok: 'accepted', refused: 'refused', info: 'info' };

export function Trail({ trace }) {
  return (
    <ol className="trail">
      {trace.map((t) => {
        const token = t.request?.token || t.response?.token;
        return (
          <li key={t.n} className={`trail__item trail__item--${t.verdict}`} data-testid={`trail-${t.n}`}>
            <p className="trail__head"><span className="trail__n">{t.n}</span><strong>{t.actor}</strong><span className={`badge badge--${t.verdict}`}>{VERDICT[t.verdict] || t.verdict}</span></p>
            <p className="trail__label">{t.label}</p>
            <Claims token={token} />
            <details data-admin-only>
              <summary>Request and response (redacted)</summary>
              <pre className="code">{pretty({ request: { ...t.request, token: undefined }, response: { ...t.response, token: undefined } })}</pre>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

export function Outcome({ run, control, controls }) {
  const flag = (id) => (run.policy[id] ? 'ON' : 'OFF');
  if (run.succeeded) {
    return (
      <div className="outcome outcome--gain" role="status" data-testid="outcome">
        <h4>Attacker gained</h4>
        <p data-testid="gain">{run.gain}</p>
        <p className="small">Flag <code>{control.id}</code> = {flag(control.id)}. The mock has this flaw, so nothing stopped it.</p>
      </div>
    );
  }
  const r = run.refusal;
  if (!r) return <div className="outcome" role="status" data-testid="outcome"><h4>No gain</h4><p>The attack ended without the attacker gaining anything.</p></div>;
  const c = controls.find((x) => x.id === r.control) || control;
  return (
    <div className="outcome outcome--stop" role="status" data-testid="outcome">
      <h4>{r.kind === 'neutralised' ? 'Neutralised' : 'Refused'}</h4>
      <dl className="facts">
        <dt>Error code</dt><dd><code data-testid="error-code">{r.error}</code>{r.status ? ` (HTTP ${r.status})` : ''}</dd>
        <dt>Why</dt><dd data-testid="refusal-message">{r.message}</dd>
        <dt>Named control</dt><dd data-testid="control-name">{c.name}</dd>
        <dt>Turned on by</dt><dd><code data-testid="flag">{c.id}</code> = {flag(c.id)}</dd>
      </dl>
    </div>
  );
}
