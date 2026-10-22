import { useEffect, useRef, useState } from 'react';
import { getControls, getHealth } from './api.js';
import { Loading, useLoad } from './components/bits.jsx';
import { PresentBar, PresentProvider, PresentToggle } from './present/PresentMode.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import AttackPage from './pages/AttackPage.jsx';
import ControlsPage from './pages/ControlsPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import LimitsPage from './pages/LimitsPage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import DiagramPage from './pages/DiagramPage.jsx';

const NAV = [['gallery', 'Gallery'], ['controls', 'Controls'], ['compare', 'Compare'], ['stories', 'Stories'], ['diagram', 'Diagram'], ['limits', 'Honest limits']];
const THEME_KEY = 'gallery.theme';
const route = () => { const [name = 'gallery', arg] = (window.location.hash.replace(/^#\/?/, '') || 'gallery').split('/'); return { name, arg }; };
const readTheme = () => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } };

function useRoute() {
  const [r, setR] = useState(route);
  useEffect(() => { const on = () => setR(route()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
}
function useTheme() {
  const [theme, setTheme] = useState(readTheme); // null = follow the system
  useEffect(() => { if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme; }, [theme]);
  const set = (t) => { setTheme(t); try { if (t) localStorage.setItem(THEME_KEY, t); else localStorage.removeItem(THEME_KEY); } catch { /* not remembered */ } };
  const dark = theme ? theme === 'dark' : !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return [dark, () => set(dark ? 'light' : 'dark')];
}

export default function App() {
  const { name, arg } = useRoute();
  const [dark, flip] = useTheme();
  const ctl = useLoad(getControls);
  const [mockOnly, setMockOnly] = useState(false);
  useEffect(() => { getHealth().then((h) => setMockOnly(h.mode === 'mock-only')).catch(() => {}); }, []);
  const first = useRef(true);
  // On a route change (not the first load) move focus to main so keyboard and screen reader users land on the new page.
  useEffect(() => { document.title = 'Agent Attack Gallery'; if (first.current) { first.current = false; return; } document.getElementById('main')?.focus?.({ preventScroll: true }); window.scrollTo?.(0, 0); }, [name, arg]);
  const controls = ctl.data?.controls;
  const byId = Object.fromEntries((controls || []).map((c) => [c.id, c]));
  const page = () => {
    switch (name) {
      case 'attack': return <AttackPage id={arg} controls={controls} />;
      case 'controls': return <ControlsPage controls={controls} />;
      case 'compare': return <ComparePage controls={controls} />;
      case 'stories': return <StoriesPage />;
      case 'diagram': return <DiagramPage controls={controls} />;
      case 'limits': return <LimitsPage controls={controls} />;
      default: return <GalleryPage controlsById={byId} />;
    }
  };
  return (
    <PresentProvider>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <PresentBar />
      <header className="top">
        <strong className="brand">Agent Attack Gallery</strong>
        <nav aria-label="Main"><ul>{NAV.map(([id, label]) => <li key={id}><a href={`#/${id}`} aria-current={(name === id || (id === 'gallery' && name === 'attack')) ? 'page' : undefined}>{label}</a></li>)}</ul></nav>
        <div className="top__tools"><PresentToggle /><button type="button" className="btn" aria-pressed={dark} onClick={flip}>{dark ? 'Light theme' : 'Dark theme'}</button></div>
      </header>
      <div className="banner" role="note" data-testid="banner">All parties here are mocks running inside this app. Nothing leaves this machine: no real server, token, tenant or network address is contacted.</div>
      {mockOnly && <div className="banner" role="note" data-testid="mock-only-banner">Hosted mock: sample data only, nothing leaves this server</div>}
      <main id="main" tabIndex={-1} className="page">
        <Loading state={ctl}>{() => page()}</Loading>
      </main>
    </PresentProvider>
  );
}
