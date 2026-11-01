import { getAsi } from '../api.js';
import { ClaimTag, Loading, attackHref, roleText, useLoad } from '../components/bits.jsx';

// The deck's slide-55 table as qualified, and which gallery attack the lab reads into each row. Every string comes from the API
// and is rendered as React text (inert). A pending, in-progress or noted row is never shown as full coverage.
const STATE = { stated: 'ok', pending: 'bad', 'in-progress': 'warn', noted: 'warn' };

export default function AsiPage() {
  const state = useLoad(getAsi);
  return (
    <>
      <h1>OWASP Agentic Top 10 (ASI)</h1>
      <p className="lede">Each ASI category with the control the deck says addresses it, and the gallery attacks the lab reads into the row. The deck states its own gaps; this table repeats them and never rounds a row up.</p>
      <Loading state={state}>
        {({ rows, fieldTags, why, source }) => {
          const qualified = rows.filter((r) => r.status !== 'stated').length;
          const empty = rows.filter((r) => r.attacks.length === 0).length;
          return (
            <>
              <p className="muted" data-testid="asi-note">Source: {source}. {qualified} of {rows.length} rows carry a qualification in the deck. {empty} of {rows.length} rows have no gallery attack, and the table says so. Attack to row is the lab's reading, because the deck does not map attacks.</p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="OWASP ASI table">
                <table className="table" data-testid="asi-table">
                  <thead><tr>
                    <th scope="col">Category <ClaimTag label={fieldTags.name} /></th>
                    <th scope="col">The deck says <ClaimTag label={fieldTags.deck} /></th>
                    <th scope="col">Status in the deck <ClaimTag label={fieldTags.status} /></th>
                    <th scope="col">Attacks the lab maps here <ClaimTag label={fieldTags.attacks} /></th>
                    <th scope="col">In this gallery <ClaimTag label={fieldTags.gallery} /></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} data-testid={`asi-${r.id}`}>
                        <th scope="row"><b>{r.id}</b> {r.name}</th>
                        <td>
                          {r.deck}
                          {r.qualifier && <p className="qualifier" data-testid={`qualifier-${r.id}`}><b>{r.qualifier}</b> <ClaimTag label={fieldTags.qualifier} /></p>}
                          {r.labReading && <p className="small" data-testid={`reading-${r.id}`}>{r.labReading} <ClaimTag label={fieldTags.labReading} /></p>}
                        </td>
                        <td><span className="badge" data-state={STATE[r.status]} data-testid={`status-${r.id}`}>{r.statusLabel}</span></td>
                        <td data-testid={`attacks-${r.id}`}>
                          {r.attacks.length === 0 ? <span className="muted">None</span> : <ul className="plain">{r.attacks.map((a) => <li key={a.id}><a href={attackHref(a.id)}>{a.name}</a> <span className="small">({roleText(a.role)})</span></li>)}</ul>}
                        </td>
                        <td>{r.gallery}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section aria-labelledby="asi-why" data-testid="asi-why">
                <h2 id="asi-why">Why it matters: {why.title} <ClaimTag label="deck claim" /></h2>
                <dl className="facts">
                  <dt>Challenge</dt><dd>{why.challenge}</dd>
                  <dt>Technical</dt><dd>{why.technical}</dd>
                  <dt>Business</dt><dd>{why.business}</dd>
                </dl>
                <p className="muted small">Paraphrased from the deck's value panel. Ping claims, unverified on our tenant.</p>
              </section>
            </>
          );
        }}
      </Loading>
    </>
  );
}
