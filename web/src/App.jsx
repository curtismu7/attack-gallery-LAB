import { useEffect, useRef, useState } from 'react';
import { getControls, getHealth, getInfo, setMode } from './api.js';
import { ClaimBanner, Loading, PageGuard, useLoad } from './components/bits.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import { CLAIM_LABEL, hasClaim } from './data/claim.js';
import { PresentBar, PresentProvider, PresentToggle } from './present/PresentMode.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import AttackPage from './pages/AttackPage.jsx';
import ControlsPage from './pages/ControlsPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import LimitsPage from './pages/LimitsPage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import DiagramPage from './pages/DiagramPage.jsx';
import AsiPage from './pages/AsiPage.jsx';
import ShelfLink from "./components/ShelfLink.jsx";

const NAV = [['gallery', 'Gallery'], ['controls', 'Controls'], ['compare', 'Compare'], ['asi', 'OWASP ASI'], ['stories', 'Stories'], ['diagram', 'Diagram'], ['limits', 'Honest limits']];
const THEME_KEY = 'gallery.theme';
const route = () => { const [name = 'gallery', arg] = (window.location.hash.replace(/^#\/?/, '') || 'gallery').split('/'); return { name, arg }; };
const readTheme = () => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } };

function useRoute() {
  const [r, setR] = useState(route);
  useEffect(() => { const on = () => setR(route()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
}
function useTheme() {
  const [theme, setTheme] = useState(() => readTheme() || 'auto'); // 'auto' = follow the system
  useEffect(() => { if (theme && theme !== 'auto') document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme; }, [theme]);
  const setThemePersist = (t) => { setTheme(t); try { if (t && t !== 'auto') localStorage.setItem(THEME_KEY, t); else localStorage.removeItem(THEME_KEY); } catch { /* not remembered */ } };
  return [theme, setThemePersist];
}

export default function App() {
  const { name, arg } = useRoute();
  const [theme, setThemePersist] = useTheme();
  const ctl = useLoad(getControls);
  const [mockOnly, setMockOnly] = useState(false);
  const [modeInfo, setModeInfo] = useState(null);
  useEffect(() => { getHealth().then((h) => setMockOnly(h.mode === 'mock-only')).catch(() => {}); }, []);
  useEffect(() => { getInfo().then(setModeInfo).catch(() => {}); }, []);
  // Rule 19: the toggle asks the server; a refusal keeps the current mode on screen.
  const selectMode = async (source) => { try { setModeInfo(await setMode(source)); } catch { /* keep showing the current mode */ } };
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
      case 'asi': return <AsiPage />;
      case 'stories': return <StoriesPage />;
      case 'diagram': return <DiagramPage controls={controls} />;
      case 'limits': return <LimitsPage controls={controls} />;
      default: return <GalleryPage controlsById={byId} />;
    }
  };
  return (
    <PresentProvider>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <PresentBar claim={hasClaim(name) ? CLAIM_LABEL : null} />
      <header className="top">
        <strong className="brand">Agent Attack Gallery</strong>
        <nav aria-label="Main"><ul>{NAV.map(([id, label]) => <li key={id}><a href={`#/${id}`} aria-current={(name === id || (id === 'gallery' && name === 'attack')) ? 'page' : undefined}>{label}</a></li>)}</ul></nav>
        <div className="top__tools">
            <ShelfLink /><ModeToggle info={modeInfo} onSelect={selectMode} /><PresentToggle />
            <label className="inline">Theme
              <select value={theme} onChange={(e) => setThemePersist(e.target.value)} data-testid="theme">
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label></div>
      </header>
      {mockOnly
        ? <div className="banner" role="note" data-testid="mock-only-banner">Hosted, simulated: all parties are mocks and the data is sample data. Nothing leaves this server: no real server, token, tenant or network address is contacted.</div>
        : <div className="banner" role="note" data-testid="banner">All parties here are mocks running inside this app. Nothing leaves this machine: no real server, token, tenant or network address is contacted.</div>}
      {hasClaim(name) && <ClaimBanner />}
      <main id="main" tabIndex={-1} className="page">
        <PageGuard resetKey={`${name}/${arg}`}><Loading state={ctl}>{() => page()}</Loading></PageGuard>
      </main>
    </PresentProvider>
  );
}
