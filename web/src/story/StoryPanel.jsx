// Adapted from the id-jag-standalone kit (web/src/story/StoryPanel.jsx): the talk track. Reads one story and re-skins it
// with the chosen vertical. The switch is "Attack succeeds" (ungoverned wording) or "Control blocks" (governed wording).
import { useMemo, useState } from 'react';
import { usePresent } from '../present/PresentMode.jsx';
import { VERTICALS, verticalById } from './stories.js';
import { fillAll } from './fill.js';
import './story.css';

const KEYS = { vertical: 'gallery.story.vertical', path: 'gallery.story.path' };
const read = (k, fallback) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: not remembered */ } };

export default function StoryPanel({ story: raw }) {
  const [verticalId, setVerticalId] = useState(() => read(KEYS.vertical, 'generic'));
  const [path, setPath] = useState(() => (read(KEYS.path, 'happy') === 'blocked' ? 'blocked' : 'happy'));
  const [localActive, setLocalActive] = useState(null);
  const presenter = usePresent();
  const active = presenter?.present ? presenter.active : localActive;
  const vertical = verticalById(verticalId);
  const story = useMemo(() => fillAll(raw, vertical), [raw, vertical]);
  const blocked = path === 'blocked';
  const current = story.steps.find((s) => s.n === active) || story.steps[0];
  const pickVertical = (id) => { setVerticalId(id); write(KEYS.vertical, id); };
  const pickPath = (p) => { setPath(p); write(KEYS.path, p); };
  const pickStep = (n) => { if (presenter?.present) presenter.goTo(n); else setLocalActive(n); };
  const text = (step) => (blocked && step.blocked ? step.blocked : step);
  return (
    <section className="story" aria-label={`Talk track: ${story.title}`} data-testid="story-panel">
      <header className="story__head">
        <div><p className="eyebrow">Story {story.id} · {vertical.displayName}</p><h2 className="story__title">{story.title}</h2></div>
      </header>
      <div className="story__controls">
        <label className="field">Vertical
          <select value={vertical.id} onChange={(e) => pickVertical(e.target.value)}>
            {VERTICALS.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Story path">
          <button type="button" aria-pressed={!blocked} onClick={() => pickPath('happy')}>Attack succeeds</button>
          <button type="button" aria-pressed={blocked} onClick={() => pickPath('blocked')}>Control blocks</button>
        </div>
      </div>
      <p className="muted small">{vertical.tagline}. Wording pack only: the mock stack does not change.</p>
      <dl className="story__summary">
        <dt>Goal</dt><dd>{story.goal}</dd><dt>Obstacle</dt><dd>{story.obstacle}</dd><dt>Control</dt><dd>{story.control}</dd>
      </dl>
      <ol className="story__steps">
        {story.steps.map((s) => (
          <li key={s.n} className={s.n === current.n ? 'is-current' : undefined}>
            <button type="button" id={`gal-step-${s.n}`} className="story__step" aria-current={s.n === current.n ? 'step' : undefined} onClick={() => pickStep(s.n)}>
              <span className="story__n">{s.n}</span>{s.title}{blocked && s.blocked && <span className="story__tag">blocked</span>}
            </button>
            {s.n === current.n && (
              <div className="story__body">
                <p>{text(s).tell}</p>
                <p className="story__say"><strong>Say:</strong> “{text(s).say}”</p>
                <p className="muted"><strong>Why it matters:</strong> {s.why}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="story__proof"><strong>Proof:</strong> {blocked ? story.proof.blocked : story.proof.happy}</p>
      <p className="story__takeaway">“{story.say}”</p>
    </section>
  );
}
