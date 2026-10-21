import { getCatalog } from '../api.js';
import { GENERAL_LIMITS, NOT_STOPPED } from '../data/limits.js';
import { Loading, RefBadge, useLoad } from '../components/bits.jsx';

export default function LimitsPage({ controls }) {
  const cat = useLoad(getCatalog);
  return (
    <>
      <h1>Honest limits</h1>
      <p className="lede">What this gallery is, and what it is not.</p>
      <section aria-labelledby="lim-general"><h2 id="lim-general">What this is</h2>
        <ul>{GENERAL_LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
      <section aria-labelledby="lim-ctrl"><h2 id="lim-ctrl">What each control does not stop</h2>
        {controls.map((c) => (
          <div key={c.id} data-testid={`limit-${c.id}`}><h3>{c.name}</h3><ul>{(NOT_STOPPED[c.id] || []).map((l) => <li key={l}>{l}</li>)}</ul></div>
        ))}
      </section>
      <section aria-labelledby="lim-unv"><h2 id="lim-unv">Unverified claims</h2>
        <p>Only pages fetched and read while building this are cited as verified. These were not, and are labelled UNVERIFIED wherever they appear.</p>
        <Loading state={cat}>
          {({ attacks }) => {
            const all = new Map();
            for (const a of attacks) for (const r of a.references) if (!r.verified) all.set(r.id, { r, attack: a.name });
            return <ul data-testid="unverified-list">{[...all.values()].map(({ r, attack }) => <li key={r.id}><RefBadge r={r} /> {r.read} Used by: {attack}.</li>)}</ul>;
          }}
        </Loading>
        <ul>
          <li>Any claim that a specific Ping product ships a given control. Only two controls cite a seed file showing the behaviour (the actor allow-list and the impersonation block); every other control is described as a gateway control of this kind.</li>
          <li>RFC 8414 authorization server metadata issuer matching, which this app does not rely on.</li>
        </ul>
      </section>
    </>
  );
}
