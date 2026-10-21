import { getCatalog } from '../api.js';
import { Loading, RefList, attackHref, useLoad } from '../components/bits.jsx';

export default function ControlsPage({ controls }) {
  const state = useLoad(getCatalog);
  return (
    <>
      <h1>Controls</h1>
      <p className="lede">Every control the governed side turns on, what it stops, which attacks it covers and where the idea comes from.</p>
      <Loading state={state}>
        {({ attacks }) => (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Controls table">
            <table className="table">
              <thead><tr><th scope="col">Control (flag)</th><th scope="col">What it stops</th><th scope="col">Refusal</th><th scope="col">Attacks covered</th><th scope="col">Reference</th></tr></thead>
              <tbody>
                {controls.map((c) => (
                  <tr key={c.id} data-testid={`control-${c.id}`}>
                    <th scope="row">{c.name}<br /><code>{c.id}</code></th>
                    <td>{c.does}</td>
                    <td><code>{c.error}</code> (HTTP {c.status})</td>
                    <td>{c.stops.map((s) => <a key={s} href={attackHref(s)}>{attacks.find((a) => a.id === s)?.name}</a>)}</td>
                    <td><RefList refs={c.references} />{c.seed && <p className="small">Seen in a seed file: {c.seed}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loading>
    </>
  );
}
