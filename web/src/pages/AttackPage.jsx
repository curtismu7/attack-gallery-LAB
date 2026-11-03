import { useCallback, useEffect, useState } from 'react';
import { getAsi, getCatalog, runAttack } from '../api.js';
import { ClaimTag, Loading, RefList, roleText, useLoad } from '../components/bits.jsx';
import { Outcome, Trail } from '../components/RunPanel.jsx';
import StoryPanel from '../story/StoryPanel.jsx';
import { storyForAttack } from '../story/stories.js';

// The ASI rows this attack maps to (lab reading), each with what the deck says about the row. The gallery's own control is a mock.
function AsiPanel({ attack, control, asi }) {
  const rows = asi.data?.rows || [];
  return (
    <section aria-labelledby="asi-map" data-testid="asi-panel">
      <h2 id="asi-map">OWASP ASI mapping <ClaimTag label={asi.data?.fieldTags.attacks ?? 'lab reading'} /></h2>
      <p className="muted small">The deck does not map attacks to ASI rows; this mapping is the lab's reading. What the deck says about each row is a Ping claim, UNVERIFIED on our tenant. The control below is a mock of this app, not a Privilege feature.</p>
      {asi.error ? <p role="alert" className="error">Could not load the ASI table: {asi.error}</p> : !asi.data ? <p className="muted" role="status">Loading...</p> : (
        <ul className="plain">
          {attack.asi.map((m) => {
            const r = rows.find((x) => x.id === m.id);
            return (
              <li key={m.id} className="asi-item" data-testid={`asi-map-${m.id}`}>
                <h3><a href="#/asi">{m.id}</a> {r?.name} <span className="badge" data-testid={`asi-role-${m.id}`}>{roleText(m.role)}</span></h3>
                {r && (<dl className="facts">
                  <dt>The deck says <ClaimTag label={asi.data.fieldTags.deck} /></dt>
                  <dd>{r.deck}{r.qualifier && <> <b data-testid={`asi-qualifier-${m.id}`}>{r.qualifier}</b></>}{r.labReading && <> <span className="small">{r.labReading}</span></>}</dd>
                  <dt>In this gallery <ClaimTag label={asi.data.fieldTags.gallery} /></dt>
                  <dd>Mock control: {control?.name} (flag <code>{attack.control}</code>).</dd>
                </dl>)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Side({ title, run, control, controls, children, id, attack }) {
  return (
    <section className="side" aria-labelledby={id} data-testid={`side-${id}`}>
      <h3 id={id}>{title}</h3>
      {children}
      {run ? (<><Outcome run={run} control={control} controls={controls} /><h4>Trail</h4><Trail trace={run.trace} attack={attack} /></>) : <p className="muted">Not launched yet.</p>}
    </section>
  );
}

export default function AttackPage({ id, controls }) {
  const state = useLoad(getCatalog);
  const asi = useLoad(getAsi);
  const [runs, setRuns] = useState({ ungoverned: null, governed: null });
  const [controlOff, setControlOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setRuns({ ungoverned: null, governed: null }); setControlOff(false); setError(null); }, [id]);
  const attack = state.data?.attacks.find((a) => a.id === id);
  const control = controls.find((c) => c.id === attack?.control);

  const launch = useCallback(async (mode, off = controlOff) => {
    setBusy(true); setError(null);
    try {
      const j = await runAttack(id, mode, off && attack ? [attack.control] : undefined);
      setRuns((old) => ({ ...old, ...Object.fromEntries(j.runs.map((r) => [r.config === 'ungoverned' ? 'ungoverned' : 'governed', r])) }));
    } catch (e) { setError(String(e.message || e)); } finally { setBusy(false); }
  }, [id, attack, controlOff]);
  const toggle = (e) => { setControlOff(e.target.checked); if (runs.governed) launch('governed', e.target.checked); };
  const story = storyForAttack(id);

  return (
    <Loading state={state}>
      {() => !attack ? <p role="alert" className="error">No attack called {id}. <a href="#/gallery">Back to the gallery</a>.</p> : (
        <>
          <p className="small"><a href="#/gallery">Gallery</a> / Pack {attack.pack}</p>
          <h1>{attack.name}</h1>
          <p className="lede">{attack.goal}</p>
          <p>{attack.story}</p>
          <dl className="facts">
            <dt>Stopped by</dt><dd>{control?.name} (flag <code>{attack.control}</code>)</dd>
            <dt>Ungoverned</dt><dd>{attack.expected.ungoverned}</dd>
            <dt>Governed</dt><dd>{attack.expected.governed}</dd>
            <dt>References</dt><dd><RefList refs={attack.references} /></dd>
          </dl>
          <AsiPanel attack={attack} control={control} asi={asi} />
          <div className="actions" role="group" aria-label="Launch">
            <button type="button" disabled={busy} onClick={() => launch('ungoverned')}>Launch ungoverned</button>
            <button type="button" disabled={busy} onClick={() => launch('governed')}>Launch governed</button>
            <button type="button" className="primary" disabled={busy} onClick={() => launch('both')}>Launch both</button>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <div className="sides">
            <Side id="ungoverned" title="Ungoverned: the flaw is present" run={runs.ungoverned} control={control} controls={controls} attack={attack} />
            <Side id="governed" title="Governed: the control is on" run={runs.governed} control={control} controls={controls} attack={attack}>
              <label className="toggle">
                <input type="checkbox" checked={controlOff} onChange={toggle} />
                Turn this control off ({control?.name}) to prove it is what stops the attack
              </label>
              <p className="small" data-testid="flag-state">Flag <code>{attack.control}</code> is <strong>{controlOff ? 'OFF' : 'ON'}</strong> on this side. All other controls stay on.</p>
            </Side>
          </div>
          {story && <StoryPanel key={story.id} story={story} />}
        </>
      )}
    </Loading>
  );
}
