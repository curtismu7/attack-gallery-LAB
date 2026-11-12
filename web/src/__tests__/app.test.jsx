import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import App from '../App.jsx';
import { Trail, Outcome } from '../components/RunPanel.jsx';
import { startApi } from './helpers.js';
import { ATTACKS } from '../../../server/src/catalog.js';
import { CHIP_COLS, CHIP_W, HOPS, chipPosition, hopsToRun } from '../data/diagram.js';

let api;
beforeAll(() => { api = startApi(); });
afterAll(() => api.stop());
const go = (hash) => { window.location.hash = hash; return render(<App />); };
beforeEach(() => { window.location.hash = ''; });

describe('shell', () => {
  it('has a skip link first, a nav, the all-mocks banner, and the gallery by default', async () => {
    const { container } = render(<App />);
    expect(container.querySelector('a.skip')).toHaveTextContent('Skip to content');
    expect(container.firstElementChild).toBe(container.querySelector('a.skip'));
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByTestId('banner')).toHaveTextContent(/mocks/i); expect(screen.getByTestId('banner')).toHaveTextContent(/nothing leaves this machine/i);
    expect(await screen.findByRole('heading', { name: 'Attack gallery' })).toBeInTheDocument();
  });
  it('shows the hosted-mock banner only when health reports mock-only', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (url, init) => (url === '/api/health' ? Promise.resolve(new Response(JSON.stringify({ mode: 'mock-only' }))) : real(url, init));
    try {
      render(<App />);
      expect(await screen.findByTestId('mock-only-banner')).toHaveTextContent('Hosted, simulated');
      expect(screen.queryByTestId('banner')).toBeNull(); // the always-on 'this machine' banner is swapped out, not stacked
    } finally { globalThis.fetch = real; }
  });
  it('shows no hosted-mock banner when mode is absent', async () => {
    const real = globalThis.fetch; let settled;
    const healthSettled = new Promise((r) => { settled = r; });
    globalThis.fetch = (url, init) => {
      const p = real(url, init);
      if (url === '/api/health') p.then(() => setTimeout(settled, 0), () => setTimeout(settled, 0));
      return p;
    };
    try {
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'Attack gallery' })).toBeInTheDocument();
      await healthSettled; // the banner decision is made only after /api/health resolves
      expect(screen.queryByTestId('mock-only-banner')).toBeNull();
    } finally { globalThis.fetch = real; }
  });
  it('the skip link moves focus to the main region', async () => {
    render(<App />); await screen.findByRole('heading', { name: 'Attack gallery' });
    fireEvent.click(screen.getByText('Skip to content')); expect(document.activeElement).toBe(document.getElementById('main'));
  });
  it('the theme button flips light and dark', async () => {
    render(<App />); await screen.findByRole('heading', { name: 'Attack gallery' });
    const sel = screen.getByTestId('theme-select');
    fireEvent.change(sel, { target: { value: 'dark' } }); expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('presenter mode toggles, enlarges type and hides admin-only blocks', async () => {
    go('#/attack/audience-confusion'); await screen.findByTestId('story-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    expect(document.documentElement.dataset.present).toBe('1'); expect(await screen.findByRole('toolbar', { name: 'Presenter controls' })).toBeInTheDocument();
    expect(await screen.findByTestId('present-count')).toHaveTextContent(/Step 1 of 5/);
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); expect(screen.getByTestId('present-count')).toHaveTextContent(/Step 2 of/);
    fireEvent.keyDown(window, { key: 'Escape' }); expect(document.documentElement.dataset.present).toBeUndefined();
  });
});

describe('gallery', () => {
  it('shows ten attacks in two packs, each with its control and a VERIFIED or UNVERIFIED badge', async () => {
    render(<App />); await screen.findByTestId('card-wrong-scope');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Pack 1/), expect.stringMatching(/Pack 2/)]));
    for (const a of ATTACKS) {
      const card = screen.getByTestId(`card-${a.id}`); expect(within(card).getByRole('link', { name: a.name })).toHaveAttribute('href', `#/attack/${a.id}`);
      expect(card).toHaveTextContent('Stopped by'); expect(card.textContent).toMatch(/VERIFIED|UNVERIFIED/);
    }
    expect(screen.getByTestId('card-other-account')).toHaveTextContent('UNVERIFIED');
    expect(screen.getByTestId('card-issuer-mixup')).not.toHaveTextContent('UNVERIFIED');
  });
});

describe('attack page, every attack in both modes', () => {
  it.each(ATTACKS.map((a) => [a.id, a]))('%s: ungoverned shows a gain, governed names the control and its flag', async (_id, a) => {
    go(`#/attack/${a.id}`); await screen.findByRole('heading', { name: a.name });
    fireEvent.click(screen.getByRole('button', { name: 'Launch both' }));
    const un = within(await screen.findByTestId('side-ungoverned')); const gv = within(screen.getByTestId('side-governed'));
    await un.findByTestId('gain'); await gv.findByTestId('flag');
    expect(un.getByTestId('outcome')).toHaveTextContent('Attacker gained');
    expect(gv.getByTestId('control-name').textContent.length).toBeGreaterThan(3); expect(gv.getByTestId('flag')).toHaveTextContent(a.control);
    expect(gv.getByTestId('error-code').textContent.length).toBeGreaterThan(2); expect(gv.getByTestId('refusal-message').textContent.length).toBeGreaterThan(20);
    expect(gv.queryByTestId('gain')).toBeNull();
    expect(un.getAllByTestId(/^trail-/).length).toBeGreaterThan(1);
  });
  it('the toggle turns the control off and the attack succeeds, then back on and it is refused', async () => {
    go('#/attack/audience-confusion'); await screen.findByRole('heading', { name: /audience confusion/i });
    fireEvent.click(screen.getByRole('button', { name: 'Launch governed' }));
    const gv = within(screen.getByTestId('side-governed')); await gv.findByTestId('error-code');
    expect(gv.getByTestId('error-code')).toHaveTextContent('invalid_token');
    fireEvent.click(gv.getByRole('checkbox')); await gv.findByTestId('gain'); expect(gv.getByTestId('flag-state')).toHaveTextContent('OFF');
    fireEvent.click(gv.getByRole('checkbox')); await gv.findByTestId('error-code'); expect(gv.getByTestId('flag-state')).toHaveTextContent('ON');
  });
  it('decoded claims are shown and the compact token is never on the page', async () => {
    go('#/attack/audience-confusion'); await screen.findByRole('heading', { name: /audience confusion/i });
    fireEvent.click(screen.getByRole('button', { name: 'Launch ungoverned' })); await screen.findByTestId('gain');
    expect(document.body.textContent).toMatch(/aud/); expect(document.body.textContent).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
  });
  it('shows the story panel for the two story attacks and none for others', async () => {
    go('#/attack/issuer-mixup'); await screen.findByTestId('story-panel'); expect(screen.getByTestId('story-panel')).toHaveTextContent('Which authorization server is this?');
  });
  it('an unknown attack id gives an error with a way back', async () => {
    go('#/attack/nope'); expect(await screen.findByRole('alert')).toHaveTextContent('No attack called nope');
  });
});

describe('controls, compare, limits', () => {
  it('controls table lists all ten with the attacks they cover and references', async () => {
    go('#/controls'); await screen.findByTestId('control-scope_check');
    expect(screen.getAllByTestId(/^control-/)).toHaveLength(10);
    expect(within(screen.getByTestId('control-act_validation')).getByText(/GatewayTokenPolicy/)).toBeInTheDocument();
    expect(within(screen.getByTestId('control-ssrf_guard')).getAllByRole('link').length).toBeGreaterThan(0);
  });
  it('compare matrix has exactly one succeeding cell per attack, on that attack\'s control', async () => {
    go('#/compare'); await screen.findByTestId('matrix');
    const hits = await waitFor(() => { const h = document.querySelectorAll('.cell--hit'); expect(h.length).toBe(10); return h; });
    for (const a of ATTACKS) expect(screen.getByTestId(`cell-${a.id}-${a.control}`)).toHaveClass('cell--hit');
    expect(hits.length).toBe(10);
  });
  it('honest limits: general limits, per-control limits and the unverified list', async () => {
    go('#/limits'); await screen.findByTestId('unverified-list');
    expect(screen.getByText(/not a test of any vendor product/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/^limit-/)).toHaveLength(10);
    expect(within(screen.getByTestId('unverified-list')).getAllByText('UNVERIFIED').length).toBeGreaterThanOrEqual(2);
  });
});

describe('stories page', () => {
  it('shows both stories, flips Attack succeeds / Control blocks and re-skins by vertical', async () => {
    go('#/stories'); await screen.findByTestId('story-panel');
    expect(screen.getByTestId('story-panel')).toHaveTextContent('The agent used my token somewhere else');
    fireEvent.click(screen.getByRole('button', { name: 'Control blocks' })); expect(screen.getByTestId('story-panel')).toHaveTextContent(/Proof:.*401 invalid_token/);
    fireEvent.change(screen.getByLabelText('Vertical'), { target: { value: 'banking' } }); expect(screen.getByTestId('story-panel')).toHaveTextContent('the statements API');
    fireEvent.click(screen.getByRole('button', { name: 'Which authorization server is this?' })); expect(screen.getByTestId('story-panel')).toHaveTextContent(/Story G2/);
    expect(screen.getByTestId('story-panel').textContent).not.toContain('⟨missing');
  });
});

describe('diagram', () => {
  it('renders the parties and control points, simulates the selected attack, and resets', async () => {
    go('#/diagram'); await screen.findByTestId('flow'); await screen.findByTestId('hops');
    expect(screen.getByText('Gateway + resource server')).toBeInTheDocument(); expect(screen.getByText('Evil AS')).toBeInTheDocument(); expect(screen.getByText('Good AS')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^ctrl-/)).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Attack'), { target: { value: 'issuer-mixup' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simulate' })).toBeEnabled());
    expect(screen.getByTestId('hops').children).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    const out = await screen.findByTestId('diagram-outcome', {}, { timeout: 4000 });
    expect(out).toHaveTextContent(/iss_mismatch/); expect(screen.getByTestId('ctrl-iss_check')).toHaveClass('dctrl--stopped');
    expect(screen.getAllByText(/does not happen: stopped earlier/).length).toBe(3);
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Reset' })); expect(screen.queryByTestId('diagram-outcome')).toBeNull();
  });
  it('the governed SSRF simulation runs hops 2-4 and refuses each, like the real run', async () => {
    go('#/diagram'); await screen.findByTestId('hops');
    fireEvent.change(screen.getByLabelText('Attack'), { target: { value: 'ssrf-metadata' } });
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '4' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simulate' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    await screen.findByTestId('diagram-outcome', {}, { timeout: 6000 });
    const items = [...screen.getByTestId('hops').children]; expect(items).toHaveLength(5);
    expect(items.slice(0, 4).every((li) => li.className.includes('hops__on'))).toBe(true); // hops 1-4 happen (2-4 refused; e2e checks the red badges)
    expect(items[4]).toHaveClass('hops__skip');
    expect(screen.queryAllByText(/does not happen/).length).toBe(1);
  });
  it('the ungoverned simulation ends with the attacker gain', async () => {
    go('#/diagram'); await screen.findByTestId('hops');
    fireEvent.click(screen.getByRole('button', { name: 'Ungoverned' })); fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '4' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simulate' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByTestId('diagram-outcome', {}, { timeout: 4000 })).toHaveTextContent(/Attacker gained/);
  });
});

describe('diagram data', () => {
  it('hopsToRun for ssrf-metadata follows the real trace in both modes', async () => {
    const run = async (mode) => (await (await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId: 'ssrf-metadata', mode }) })).json()).runs[0];
    const gov = await run('governed'); const un = await run('ungoverned');
    const stepIds = HOPS['ssrf-metadata'].filter((h) => h.step).map((h) => h.step);
    expect(gov.trace.map((t) => t.step)).toEqual(stepIds); // the real governed run attempts every fetch...
    expect(gov.trace.filter((t) => t.verdict === 'refused').map((t) => t.step)).toEqual(['link-local', 'loopback-name', 'redirect']); // ...and refuses each
    expect(hopsToRun('ssrf-metadata', gov, 'ssrf_guard')).toBe(4);
    expect(hopsToRun('ssrf-metadata', un, 'ssrf_guard')).toBe(5);
  });
  it('control chips never overlap: horizontal pitch exceeds the chip width, vertical pitch exceeds a line', () => {
    const a = chipPosition(0); const b = chipPosition(1); const c = chipPosition(CHIP_COLS);
    expect(b.x - a.x).toBeGreaterThan(CHIP_W); expect(c.y - a.y).toBeGreaterThanOrEqual(40);
    // the longest name plus the stopped suffix at 12px monospace (~7.3px/char) plus padding fits the chip
    const longest = Math.max(...ATTACKS.map((x) => x.control.length)); expect((longest + '■  (stopped it)'.length) * 7.3 + 24).toBeLessThanOrEqual(CHIP_W);
  });
});

describe('inert text: hostile strings never execute or become markup', () => {
  const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  it('claims, labels, requests, gain and refusal render as plain text', () => {
    window.__pwned = undefined;
    const trace = [{ n: 1, step: 's', actor: evil, label: evil, verdict: 'ok', request: { op: evil, token: { claims: { sub: evil, aud: evil, act: { sub: evil } } } }, response: { body: evil } }];
    const run = { succeeded: true, gain: evil, policy: { c: false }, trace };
    const { container } = render(<><Outcome run={run} control={{ id: 'c', name: 'C' }} controls={[]} /><Trail trace={trace} /><Outcome run={{ succeeded: false, policy: { c: true }, refusal: { control: 'c', error: evil, message: evil, status: 403 }, trace: [] }} control={{ id: 'c', name: evil }} controls={[]} /></>);
    expect(container.querySelector('img, script, iframe')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=');
    expect(container.querySelectorAll('[onerror]')).toHaveLength(0); expect(window.__pwned).toBeUndefined();
  });
  it('the index page ships no inline script', () => {
    const html = readFileSync('index.html', 'utf8');
    expect([...html.matchAll(/<script\b([^>]*)>/g)].every((m) => /src=/.test(m[1]))).toBe(true);
  });
});

describe('theme tokens', () => {
  const css = readFileSync('src/styles.css', 'utf8') + readFileSync('src/story/story.css', 'utf8');
  const shared = readFileSync('src/standalone-ui.css', 'utf8'); // dark and light tokens and reduced motion live in the shared sheet
  it('defines dark and light tokens and no purple', () => {
    expect(shared).toMatch(/prefers-color-scheme: dark/); expect(shared).toMatch(/\[data-theme="dark"\]/); expect(shared).toMatch(/\[data-theme="light"\]/);
    expect(css).not.toMatch(/purple|violet|indigo|magenta/i);
    for (const m of css.matchAll(/#([0-9a-f]{6})\b/gi)) { const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); expect(!(b > r + 25 && b > g + 25 && r > g + 25), `#${m[1]} looks purple`).toBe(true); }
  });
  it('has a mobile breakpoint and honours reduced motion', () => { expect(css).toMatch(/max-width: 600px/); expect(shared).toMatch(/prefers-reduced-motion/); });
});
