import { useEffect, useRef, useState } from 'react';
import { getControls, getHealth, getInfo, resetKeys, setMode } from './api.js';
import TopMenu, { applyFontSize } from './top-menu/TopMenu.jsx';
import { ClaimBanner, Loading, PageGuard, useLoad } from './components/bits.jsx';
import { CLAIM_LABEL, hasClaim } from './data/claim.js';
import { PresentBar, PresentProvider, PresentToggle, usePresent } from './present/PresentMode.jsx';
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
const FONT_KEY = 'gallery.font';
const readFont = () => { try { const f = localStorage.getItem(FONT_KEY); return ['S', 'M', 'L'].includes(f) ? f : 'M'; } catch { return 'M'; } };
const saveFont = (f) => { try { localStorage.setItem(FONT_KEY, f); } catch { /* not remembered */ } };

function MenuTools({ modeInfo, selectMode, theme, setThemePersist, fontStep, setFontStep, onReset }) {
  const { present, set: setPresent } = usePresent();
  return (
    <TopMenu
      mode={{ value: modeInfo?.source || 'mock', onChange: selectMode, realAvailable: modeInfo ? modeInfo.realAvailable : null, realHint: modeInfo?.hosted ? 'The hosted build is Mock only.' : 'This gallery has no live version: every party is a mock inside this app and nothing leaves the machine.' }}
      theme={{ value: theme, onChange: setThemePersist }}
      fontSize={{ value: fontStep, onChange: setFontStep }}
      present={{ active: present, onToggle: () => setPresent(!present), label: 'Present' }}
      help={{ href: 'https://github.com/curtismu7/attack-gallery-LAB#readme' }}
      onReset={onReset}
    >
      <ShelfLink />
    </TopMenu>
  );
}

export default function App() {
  const { name, arg } = useRoute();
  const [theme, setThemePersist] = useTheme();
  const [fontStep, setFontStep] = useState(readFont);
  const ctl = useLoad(getControls);
  const [mockOnly, setMockOnly] = useState(false);
  const [modeInfo, setModeInfo] = useState(null);
  useEffect(() => { getHealth().then((h) => setMockOnly(h.mode === 'mock-only')).catch(() => {}); }, []);
  useEffect(() => { getInfo().then(setModeInfo).catch(() => {}); }, []);
  useEffect(() => { applyFontSize(fontStep); saveFont(fontStep); }, [fontStep]);
  // Rule 19: the toggle asks the server; a refusal keeps the current mode on screen.
  const selectMode = async (source) => { try { setModeInfo(await setMode(source)); } catch { /* keep showing the current mode */ } };
  // Reset (rule 3): the server mints a fresh keyring; the next run uses the new keys.
  const [resetNote, setResetNote] = useState('');
  const reset = async () => { try { await resetKeys(); setResetNote('Reset: the mock keyring is fresh; the next attack run is signed with the new keys.'); } catch { setResetNote('Reset failed.'); } };
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
            <MenuTools modeInfo={modeInfo} selectMode={selectMode} theme={theme} setThemePersist={setThemePersist} fontStep={fontStep} setFontStep={setFontStep} onReset={reset} />
          </div>
      </header>
      {mockOnly
        ? <div className="banner" role="note" data-testid="mock-only-banner">Hosted, simulated: all parties are mocks and the data is sample data. Nothing leaves this server: no real server, token, tenant or network address is contacted.</div>
        : <div className="banner" role="note" data-testid="banner">All parties here are mocks running inside this app. Nothing leaves this machine: no real server, token, tenant or network address is contacted.</div>}
      {resetNote && <p className="muted small" role="status" data-testid="reset-note">{resetNote}</p>}
      {hasClaim(name) && <ClaimBanner />}
      <main id="main" tabIndex={-1} className="page">
        <PageGuard resetKey={`${name}/${arg}`}><Loading state={ctl}>{() => page()}</Loading></PageGuard>
      </main>
    </PresentProvider>
  );
}
