import { getCatalog } from '../api.js';
import { AsiChips, Loading, RefBadge, attackHref, useLoad } from '../components/bits.jsx';

export default function GalleryPage({ controlsById }) {
  const state = useLoad(getCatalog);
  return (
    <>
      <h1>Attack gallery</h1>
      <p className="lede">Named attacks against a mock MCP-style stack. Each runs twice: against a stack that has the flaw, and against one with the named control on.</p>
      <Loading state={state}>
        {({ packs, attacks }) => packs.map((p) => (
          <section key={p.id} aria-labelledby={`pack-${p.id}`}>
            <h2 id={`pack-${p.id}`}>{p.name}</h2>
            <ul className="cards">
              {attacks.filter((a) => a.pack === p.id).map((a) => (
                <li key={a.id} className="card" data-testid={`card-${a.id}`}>
                  <h3><a href={attackHref(a.id)}>{a.name}</a></h3>
                  <p>{a.goal}</p>
                  <p className="small"><strong>Stopped by:</strong> {controlsById[a.control]?.name || a.control}</p>
                  <p className="small"><strong>OWASP ASI (lab reading):</strong> <AsiChips asi={a.asi} /></p>
                  <p className="small"><strong>Reference:</strong> <RefBadge r={a.references[0]} /></p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Loading>
    </>
  );
}
