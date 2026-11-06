import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import App from '../App.jsx';
import { PageGuard } from '../components/bits.jsx';
import { CLAIM_LABEL as WEB_CLAIM_LABEL, NO_CLAIM_ROUTES, hasClaim } from '../data/claim.js';
import { startApi } from './helpers.js';
import { ATTACKS, attackById } from '../../../server/src/catalog.js';
import { ASI_IDS, CLAIM_LABEL, FIELD_TAGS, WHY, asiForAttack, asiTable } from '../../../server/src/asi.js';

let api;
beforeAll(() => { api = startApi(); });
afterAll(() => api.stop());
const go = (hash) => { window.location.hash = hash; return render(<App />); };
beforeEach(() => { window.location.hash = ''; try { localStorage.clear(); } catch { /* none */ } delete document.documentElement.dataset.present; });
const withFetch = async (wrap, fn) => { const real = globalThis.fetch; globalThis.fetch = wrap(real); try { await fn(); } finally { globalThis.fetch = real; } };
const table = asiTable();

describe('the release-claim label', () => {
  it('is the same string on the server and in the web bundle, and says what it must', () => {
    expect(WEB_CLAIM_LABEL).toBe(CLAIM_LABEL); expect(CLAIM_LABEL).toBe('Ping release claim, UNVERIFIED on our tenant');
    expect(NO_CLAIM_ROUTES.sort()).toEqual(['compare', 'controls', 'diagram', 'stories']);
    for (const r of ['gallery', 'attack', 'asi', 'limits', 'anything-else']) expect(hasClaim(r)).toBe(true);
  });
  it.each([['#/gallery', true], ['#/attack/wrong-scope', true], ['#/asi', true], ['#/limits', true], ['#/controls', false], ['#/compare', false], ['#/stories', false], ['#/diagram', false]])('%s: claim banner present = %s, next to (not instead of) the simulation banner', async (hash, claim) => {
    go(hash); await screen.findByRole('heading', { level: 1 });
    expect(screen.getByTestId('banner')).toHaveTextContent(/mocks/i);
    if (claim) { expect(screen.getByTestId('claim-banner')).toHaveTextContent(CLAIM_LABEL); expect(screen.getByTestId('claim-banner')).toHaveTextContent(/not Ping features/); } else expect(screen.queryByTestId('claim-banner')).toBeNull();
  });
  it('is also there beside the hosted-mock banner', async () => {
    await withFetch((real) => (url, init) => (url === '/api/health' ? Promise.resolve(new Response(JSON.stringify({ mode: 'mock-only' }))) : real(url, init)), async () => {
      go('#/asi'); expect(await screen.findByTestId('mock-only-banner')).toBeInTheDocument(); expect(screen.getByTestId('claim-banner')).toBeInTheDocument();
    });
  });
  it('stays on screen in presenter mode: in the bar on claim pages, absent on the others', async () => {
    go('#/asi'); await screen.findByTestId('asi-table');
    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    expect(await screen.findByTestId('present-claim')).toHaveTextContent(CLAIM_LABEL); expect(screen.getByTestId('claim-banner')).toBeVisible();
    window.location.hash = '#/controls'; await screen.findByTestId('control-scope_check'); await waitFor(() => expect(screen.queryByTestId('present-claim')).toBeNull());
    window.location.hash = '#/attack/ssrf-metadata'; await screen.findByTestId('asi-panel'); expect(screen.getByTestId('present-claim')).toBeInTheDocument(); expect(screen.getByTestId('asi-panel')).toBeVisible();
  });
});

describe('ASI page', () => {
  it('shows ASI01 to ASI10, in order, with the deck text, status, and the tag for each column', async () => {
    go('#/asi'); const t = await screen.findByTestId('asi-table');
    expect(within(t).getAllByRole('row')).toHaveLength(11);
    expect(ASI_IDS.map((id) => screen.getByTestId(`asi-${id}`))).toEqual([...t.querySelectorAll('tbody tr')]);
    for (const r of table.rows) { const tr = screen.getByTestId(`asi-${r.id}`); expect(tr).toHaveTextContent(r.name); expect(tr).toHaveTextContent(r.deck); expect(screen.getByTestId(`status-${r.id}`)).toHaveTextContent(r.statusLabel); }
    const tags = [...t.querySelectorAll('thead .claim-tag')].map((x) => x.textContent);
    expect(tags).toEqual([FIELD_TAGS.name, FIELD_TAGS.deck, FIELD_TAGS.status, FIELD_TAGS.attacks, FIELD_TAGS.gallery]);
    expect(screen.getByTestId('qualifier-ASI04')).toHaveTextContent(FIELD_TAGS.qualifier); expect(screen.getByTestId('reading-ASI04')).toHaveTextContent(FIELD_TAGS.labReading);
  });
  it('keeps the deck\'s own gaps: ASI04 pending, ASI06 in progress, ASI08-10 noted; the five unqualified rows have no qualifier', async () => {
    go('#/asi'); await screen.findByTestId('asi-table');
    expect(screen.getByTestId('status-ASI04')).toHaveTextContent('PENDING part'); expect(screen.getByTestId('qualifier-ASI04')).toHaveTextContent(/Fingerprint pinning is PENDING/); expect(screen.getByTestId('reading-ASI04')).toHaveTextContent(/Do not present this row as full coverage/);
    expect(screen.getByTestId('status-ASI06')).toHaveTextContent('IN PROGRESS'); expect(screen.getByTestId('qualifier-ASI06')).toHaveTextContent(/IN PROGRESS/);
    for (const id of ['ASI08', 'ASI09', 'ASI10']) { expect(screen.getByTestId(`status-${id}`)).toHaveTextContent('deck adds a note'); expect(screen.getByTestId(`qualifier-${id}`)).toBeInTheDocument(); }
    for (const id of ['ASI01', 'ASI02', 'ASI03', 'ASI05', 'ASI07']) expect(screen.queryByTestId(`qualifier-${id}`)).toBeNull();
    expect(screen.getByTestId('asi-note')).toHaveTextContent(/5 of 10 rows carry a qualification/); expect(screen.getByTestId('asi-note')).toHaveTextContent(/6 of 10 rows have no gallery attack/);
    expect(document.body.textContent).not.toMatch(/full coverage\.(?! )/);
  });
  it('lists, per row, exactly the attacks the engine maps (links to the attack), and "None" where there is no attack', async () => {
    go('#/asi'); await screen.findByTestId('asi-table');
    for (const r of table.rows) {
      const cell = screen.getByTestId(`attacks-${r.id}`);
      if (!r.attacks.length) { expect(cell).toHaveTextContent('None'); expect(within(cell).queryAllByRole('link')).toHaveLength(0); continue; }
      const links = within(cell).getAllByRole('link');
      expect(links.map((l) => l.getAttribute('href'))).toEqual(r.attacks.map((a) => `#/attack/${a.id}`));
      expect(links.map((l) => l.textContent)).toEqual(r.attacks.map((a) => a.name));
      r.attacks.forEach((a, i) => expect(links[i].parentElement).toHaveTextContent(`(${a.role})`));
    }
  });
  it('shows Why it matters from the deck\'s value panel, marked as a Ping claim', async () => {
    go('#/asi'); const w = await screen.findByTestId('asi-why');
    for (const k of ['challenge', 'technical', 'business']) expect(w).toHaveTextContent(WHY[k]);
    expect(w).toHaveTextContent(/Ping claims, unverified on our tenant/); expect(w.querySelector('.claim-tag')).toHaveTextContent('deck claim');
  });
  it('renders API strings as text, never as HTML', async () => {
    await withFetch((real) => (url, init) => (url === '/api/asi' ? real(url, init).then(async (r) => { const j = await r.json(); j.rows[0].name = '<img src=x onerror=alert(1)>'; j.rows[0].deck = '<b id="evil">deck</b>'; return new Response(JSON.stringify(j)); }) : real(url, init)), async () => {
      go('#/asi'); await screen.findByTestId('asi-table');
      expect(document.querySelector('img[src="x"]')).toBeNull(); expect(document.getElementById('evil')).toBeNull(); expect(screen.getByTestId('asi-ASI01')).toHaveTextContent('<img src=x onerror=alert(1)>');
    });
  });
  it('an API failure shows an error in the page, not a blank page, and the nav still works', async () => {
    await withFetch((real) => (url, init) => (url === '/api/asi' ? Promise.resolve(new Response('{}', { status: 500 })) : real(url, init)), async () => {
      go('#/asi'); expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the API/); expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      expect(screen.getByTestId('claim-banner')).toBeInTheDocument();
    });
  });
});

describe('gallery cards and attack pages carry the mapping', () => {
  it('every card shows the attack\'s ASI chips in table order, primary and related marked', async () => {
    go('#/gallery'); await screen.findByTestId('card-wrong-scope');
    for (const a of ATTACKS) {
      const chips = [...within(screen.getByTestId(`card-${a.id}`)).getByTestId('asi-chips').querySelectorAll('a')];
      expect(chips.map((c) => c.dataset.role)).toEqual(asiForAttack(a.id).map((m) => m.role));
      expect(chips.map((c) => c.textContent)).toEqual(asiForAttack(a.id).map((m) => `${m.id}${m.role === 'related' ? ' (related)' : ''}`));
      expect(chips.every((c) => c.getAttribute('href') === '#/asi')).toBe(true);
    }
  });
  it.each(ATTACKS.map((a) => [a.id]))('%s: the panel lists each mapped row with its role, the deck text, any qualifier, and the mock control (not a Privilege feature)', async (id) => {
    go(`#/attack/${id}`); const panel = await screen.findByTestId('asi-panel'); await within(panel).findByTestId(`asi-map-${asiForAttack(id)[0].id}`);
    const ours = asiForAttack(id);
    expect([...panel.querySelectorAll('[data-testid^="asi-map-"]')].map((e) => e.dataset.testid)).toEqual(ours.map((m) => `asi-map-${m.id}`));
    for (const m of ours) {
      const row = table.rows.find((r) => r.id === m.id); const item = within(panel).getByTestId(`asi-map-${m.id}`);
      expect(within(item).getByTestId(`asi-role-${m.id}`)).toHaveTextContent(m.role); expect(item).toHaveTextContent(row.name); expect(item).toHaveTextContent(row.deck);
      if (row.qualifier) expect(within(item).getByTestId(`asi-qualifier-${m.id}`)).toHaveTextContent(row.qualifier); else expect(within(item).queryByTestId(`asi-qualifier-${m.id}`)).toBeNull();
      expect(item).toHaveTextContent(`flag ${attackById(id).control}`);
    }
    expect(panel).toHaveTextContent(/not a Privilege feature/); expect(panel).toHaveTextContent(/UNVERIFIED on our tenant/);
  });
  it('the ASI04 gap travels with the attacks that map to it', async () => {
    for (const id of ['issuer-mixup', 'ssrf-metadata']) {
      const { unmount } = go(`#/attack/${id}`); const panel = await screen.findByTestId('asi-panel'); const q = await within(panel).findByTestId('asi-qualifier-ASI04');
      expect(q).toHaveTextContent(/PENDING/); expect(within(panel).getByTestId('asi-role-ASI04')).toHaveTextContent('related'); unmount();
    }
  });
  it('moving from one attack to another shows only the new attack\'s rows (no stale panel)', async () => {
    go('#/attack/ssrf-metadata'); const panel = await screen.findByTestId('asi-panel'); await within(panel).findByTestId('asi-map-ASI04');
    window.location.hash = '#/attack/bad-client'; await screen.findByRole('heading', { name: 'Bad client' });
    await waitFor(() => expect([...screen.getByTestId('asi-panel').querySelectorAll('[data-testid^="asi-map-"]')].map((e) => e.dataset.testid)).toEqual(['asi-map-ASI03']));
    expect(screen.queryByTestId('asi-map-ASI04')).toBeNull(); expect(screen.queryByTestId('asi-map-ASI02')).toBeNull();
  });
  it('if the ASI table cannot load, the attack page still draws (panel shows the error)', async () => {
    await withFetch((real) => (url, init) => (url === '/api/asi' ? Promise.reject(new Error('down')) : real(url, init)), async () => {
      go('#/attack/wrong-scope'); await screen.findByRole('heading', { name: 'Wrong scope' });
      await waitFor(() => expect(within(screen.getByTestId('asi-panel')).getByRole('alert')).toHaveTextContent(/Could not load the ASI table/)); expect(screen.getByRole('button', { name: 'Launch both' })).toBeInTheDocument();
    });
  });
});

describe('switching vertical, story path, launch mode and theme on every tab never blanks the page', () => {
  const ROUTES = ['#/gallery', ...ATTACKS.map((a) => `#/attack/${a.id}`), '#/controls', '#/compare', '#/asi', '#/stories', '#/diagram', '#/limits'];
  const drawn = () => { const m = document.getElementById('main'); expect(m.textContent.trim().length).toBeGreaterThan(40); expect(screen.queryByTestId('page-error')).toBeNull(); };
  it('walks every tab in one session, flipping theme and presenter mode on each, and the main region always has content', async () => {
    go('#/gallery'); await screen.findByTestId('card-wrong-scope');
    for (const h of ROUTES) {
      window.location.hash = h; await waitFor(drawn);
      await waitFor(() => expect(within(document.getElementById('main')).queryByText('Loading...')).toBeNull());
      fireEvent.change(screen.getByTestId('theme'), { target: { value: 'dark' } }); drawn();
      fireEvent.click(screen.getByRole('button', { name: 'Present' })); drawn(); fireEvent.keyDown(window, { key: 'Escape' }); drawn();
    }
  });
  it.each([['#/stories'], ['#/attack/audience-confusion'], ['#/attack/issuer-mixup']])('%s: every vertical x both story paths keeps the story and the page', async (h) => {
    go(h); await screen.findByTestId('story-panel');
    for (const v of ['generic', 'airlines', 'banking']) for (const p of ['Attack succeeds', 'Control blocks']) {
      fireEvent.change(screen.getByLabelText('Vertical'), { target: { value: v } }); fireEvent.click(screen.getByRole('button', { name: p }));
      drawn(); expect(screen.getByTestId('story-panel').textContent).not.toMatch(/\{\{/);
    }
    if (h.startsWith('#/attack')) { expect(screen.getByTestId('asi-panel')).toBeInTheDocument(); expect(screen.getByTestId('claim-banner')).toBeInTheDocument(); }
  });
  it('launching each mode on an attack page keeps the ASI panel and the claim banner', async () => {
    go('#/attack/rogue-actor'); await screen.findByTestId('asi-map-ASI10');
    for (const b of ['Launch ungoverned', 'Launch governed', 'Launch both']) { fireEvent.click(screen.getByRole('button', { name: b })); await waitFor(() => expect(screen.getByRole('button', { name: b })).toBeEnabled()); expect(screen.getByTestId('asi-map-ASI10')).toBeInTheDocument(); expect(screen.getByTestId('claim-banner')).toBeInTheDocument(); }
  });
});

describe('page guard', () => {
  const Boom = () => { throw new Error('boom'); };
  it('shows a message instead of a blank app when a page throws, and recovers when the route changes', () => {
    const quiet = console.error; console.error = () => {};
    try {
      const { rerender } = render(<PageGuard resetKey="a"><Boom /></PageGuard>);
      expect(screen.getByTestId('page-error')).toHaveTextContent(/could not be drawn/);
      rerender(<PageGuard resetKey="b"><p>fine</p></PageGuard>);
      expect(screen.queryByTestId('page-error')).toBeNull(); expect(screen.getByText('fine')).toBeInTheDocument();
    } finally { console.error = quiet; }
  });
  it('App: a page that throws keeps the header, the nav and both banners', async () => {
    const quiet = console.error; console.error = () => {};
    await withFetch((real) => (url, init) => (url === '/api/asi' ? real(url, init).then(async (r) => { const j = await r.json(); j.rows = null; return new Response(JSON.stringify(j)); }) : real(url, init)), async () => {
      try {
        go('#/asi'); expect(await screen.findByTestId('page-error')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument(); expect(screen.getByTestId('banner')).toBeInTheDocument(); expect(screen.getByTestId('claim-banner')).toBeInTheDocument();
        window.location.hash = '#/controls'; await screen.findByTestId('control-scope_check'); expect(screen.queryByTestId('page-error')).toBeNull();
      } finally { console.error = quiet; }
    });
  });
});
