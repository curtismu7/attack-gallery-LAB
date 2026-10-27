import { useState } from 'react';
import { getCatalog, getMatrix, runAttack } from '../api.js';
import WirePanel from '../components/WirePanel.jsx';
import { Loading, attackHref, useLoad } from '../components/bits.jsx';

// The last step of a run is where the control decides (or where the run halted).
const decisive = (run) => run.trace.at(-1);

function WireCompare({ attacks }) {
  const [id, setId] = useState(attacks[0].id);
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const attack = attacks.find((a) => a.id === id);
  const show = async () => {
    setError(null);
    try { const j = await runAttack(id, 'both'); setRuns({ id, by: Object.fromEntries(j.runs.map((r) => [r.config, r])) }); } catch (e) { setError(String(e.message || e)); }
  };
  return (
    <section aria-labelledby="wire-compare">
      <h2 id="wire-compare">On the wire: without and with the control</h2>
      <p className="muted">Pick an attack to see the exact request the attacker sends and the reply, once with the flaw present and once with the control on. The highlighted field is the one that decides.</p>
      <div className="actions">
        <label className="field">Attack <select value={id} onChange={(e) => { setId(e.target.value); setRuns(null); }}>{attacks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <button type="button" className="btn btn--primary" onClick={show} data-testid="wire-compare-go">Show both on the wire</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {runs && runs.id === id && (
        <div className="sides" data-testid="wire-compare-sides">
          {[['ungoverned', 'Without the control: the flaw is present'], ['governed', 'With the control on']].map(([k, title], i) => (
            <section key={k} className="side" aria-label={title}><h3>{title}</h3><WirePanel attack={attack} entry={decisive(runs.by[k])} jargon={i === 0} /></section>
          ))}
        </div>
      )}
    </section>
  );
}

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
      <Loading state={cat}>{({ attacks }) => <WireCompare attacks={attacks} />}</Loading>
      <p className="muted small">One control per attack in this set; other cells show no overlap, which is a property of these mocks and not a claim about real systems.</p>
    </>
  );
}
