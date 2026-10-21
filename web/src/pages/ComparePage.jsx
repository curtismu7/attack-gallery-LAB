import { getCatalog, getMatrix } from '../api.js';
import { Loading, attackHref, useLoad } from '../components/bits.jsx';

export default function ComparePage({ controls }) {
  const cat = useLoad(getCatalog);
  const mx = useLoad(getMatrix);
  const state = { data: cat.data && mx.data ? { cat: cat.data, mx: mx.data } : null, error: cat.error || mx.error };
  return (
    <>
      <h1>Compare</h1>
      <p className="lede">Attacks across, controls down. Each cell is a live run: every control on except the one in the column. A cell reading <strong>succeeds</strong> means that control was the one stopping that attack.</p>
      <Loading state={state}>
        {({ cat: { attacks }, mx }) => (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Attack by control matrix">
            <table className="table matrix" data-testid="matrix">
              <thead><tr><th scope="col">Attack</th>{controls.map((c) => <th scope="col" key={c.id} className="matrix__col"><span>{c.name}</span></th>)}</tr></thead>
              <tbody>
                {attacks.map((a) => (
                  <tr key={a.id}>
                    <th scope="row"><a href={attackHref(a.id)}>{a.name}</a></th>
                    {controls.map((c) => {
                      const hit = mx.cells[a.id][c.id];
                      return <td key={c.id} className={hit ? 'cell cell--hit' : 'cell'} data-testid={`cell-${a.id}-${c.id}`}>{hit ? <span title="With this control off, the attack succeeds">succeeds</span> : <span className="muted" aria-label="still refused">-</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loading>
      <p className="muted small">One control per attack in this set; other cells show no overlap, which is a property of these mocks and not a claim about real systems.</p>
    </>
  );
}
