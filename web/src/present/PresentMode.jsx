// Copied from the id-jag-standalone kit (web/src/present/PresentMode.jsx), adapted: steps are the talk-track steps
// (elements with id gal-step-N), and the active one is highlighted itself. Pattern, not an import.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import './present.css';

// Presenter mode: bigger type, clutter hidden by CSS (anything tagged data-admin-only), a Step N of M bar.
const KEY = 'gallery.present';
const STEP_ID = /^gal-step-(\d+)$/;

export const PresentCtx = createContext(null);
export const usePresent = () => useContext(PresentCtx);

const initialPresent = () => {
  try { if (new URLSearchParams(window.location.search).get('present') === '1') return true; } catch { /* no URL */ }
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};
const inField = (t) => !!t?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable=false])');
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const readSteps = () => [...document.querySelectorAll("[id^='gal-step-']")].map((el) => ({ n: Number((STEP_ID.exec(el.id) || [])[1]), title: el.textContent.trim() })).filter((s) => s.n);

export function PresentProvider({ children }) {
  const [present, setPresent] = useState(initialPresent);
  const [steps, setSteps] = useState([]);
  const [active, setActive] = useState(null);
  const [announce, setAnnounce] = useState('');

  const set = useCallback((on) => {
    setPresent(on);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* not remembered */ }
    if (!on && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
  }, []);
  useEffect(() => { if (present) document.documentElement.dataset.present = '1'; else delete document.documentElement.dataset.present; }, [present]);
  useEffect(() => {
    if (!present) return undefined;
    const sync = () => setSteps((old) => { const next = readSteps(); return JSON.stringify(old) === JSON.stringify(next) ? old : next; });
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [present]);

  const current = steps.some((s) => s.n === active) ? active : steps[0]?.n ?? null;
  useEffect(() => {
    document.querySelectorAll('[data-step-active]').forEach((el) => el.removeAttribute('data-step-active'));
    if (present && current != null) document.getElementById(`gal-step-${current}`)?.setAttribute('data-step-active', '1');
  }, [present, current, steps]);

  const goTo = useCallback((n) => {
    setActive(n);
    document.getElementById(`gal-step-${n}`)?.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    const s = readSteps(); const i = s.findIndex((x) => x.n === n);
    if (i >= 0) setAnnounce(`Step ${i + 1} of ${s.length}: ${s[i].title}`);
  }, []);
  const move = useCallback((d) => {
    const i = steps.findIndex((s) => s.n === current);
    const next = steps[Math.min(steps.length - 1, Math.max(0, i + d))];
    if (next && next.n !== current) goTo(next.n);
  }, [steps, current, goTo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { if (present) set(false); return; }
      if (inField(e.target)) return;
      if (e.key === 'p' || e.key === 'P') set(!present);
      else if (present && e.key === 'ArrowRight') move(1);
      else if (present && e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present, set, move]);

  const value = useMemo(() => ({ present, set, steps, active: current, goTo, move, announce }), [present, set, steps, current, goTo, move, announce]);
  return <PresentCtx.Provider value={value}>{children}</PresentCtx.Provider>;
}

export function PresentToggle() {
  const { present, set } = usePresent();
  return <button type="button" className="btn" aria-pressed={present} onClick={() => set(!present)} title="Presenter mode (p)">Present</button>;
}

export function PresentBar() {
  const { present, set, steps, active, move, announce } = usePresent();
  if (!present) return null;
  const i = steps.findIndex((s) => s.n === active);
  return (
    <div className="present-bar" role="toolbar" aria-label="Presenter controls">
      {steps.length > 0 && (
        <>
          <button type="button" className="btn" onClick={() => move(-1)} disabled={i <= 0}>Previous</button>
          <span className="present-bar__count" data-testid="present-count">Step {i + 1} of {steps.length}</span>
          <button type="button" className="btn" onClick={() => move(1)} disabled={i >= steps.length - 1}>Next</button>
        </>
      )}
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      <button type="button" className="btn present-bar__end" onClick={() => set(false)}>Exit (Esc)</button>
    </div>
  );
}
