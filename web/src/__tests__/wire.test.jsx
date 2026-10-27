import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import App from '../App.jsx';
import WirePanel from '../components/WirePanel.jsx';
import { startApi } from './helpers.js';
import { ATTACKS } from '../../../server/src/catalog.js';
import { SIGNATURE, compact } from '../wire/wire.js';

let api;
beforeAll(() => { api = startApi(); });
afterAll(() => api.stop());
beforeEach(() => { window.location.hash = ''; });
const post = (attackId, mode) => fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId, mode }) }).then((r) => r.json());

describe('On the wire panel', () => {
  it('every step of every attack, with and without the control, renders example-only text', async () => {
    for (const attack of ATTACKS) {
      const { runs } = await post(attack.id, 'both');
      for (const run of runs) for (const entry of run.trace) {
        const { container, unmount } = render(<WirePanel attack={attack} entry={entry} />);
        const text = container.textContent;
        expect(text, `${attack.id}/${entry.step}`).toContain('Example data');
        expect(text).toMatch(/What to notice|No network call|decision a person makes|refused before connecting/);
        const wire = [...container.querySelectorAll('pre')].map((n) => n.textContent).join('\n');
        for (const host of wire.match(/https?:\/\/[a-z0-9.-]+/gi) || []) expect(host, `${attack.id}/${entry.step}`).toMatch(/\.(example|invalid)$|^https?:\/\/(93\.184\.216\.\d+|169\.254\.169\.254|10\.0\.0\.\d+|127\.0\.0\.1)$/);
        for (const jwt of container.querySelectorAll('[data-testid="wire-jwt"]')) expect(jwt.textContent.endsWith(`.${SIGNATURE}`)).toBe(true);
        expect(text).not.toMatch(/PRIVATE KEY|"d":/);
        unmount();
      }
    }
  }, 60000);

  it('audience confusion: the aud row is highlighted, the request carries the bearer token, and the status flips from 200 to 401', async () => {
    const attack = ATTACKS.find((a) => a.id === 'audience-confusion');
    const { runs } = await post('audience-confusion', 'both');
    const [bad, good] = runs.map((r) => render(<WirePanel attack={attack} entry={r.trace.at(-1)} />));
    expect(within(bad.container).getByTestId('wire-request').textContent).toMatch(/^POST https:\/\/gw\.gallery\.example\/mcp[\s\S]*Authorization: Bearer eyJ[\w-]+\.[\w-]+\.sig-not-real/);
    expect(within(bad.container).getByTestId('wire-response').textContent).toContain('HTTP/1.1 200 OK');
    expect(within(good.container).getByTestId('wire-response').textContent).toContain('HTTP/1.1 401 Unauthorized');
    expect(within(good.container).getByTestId('wire-response').textContent).toContain('invalid_token');
    const hot = good.container.querySelectorAll('tr[data-hot="true"]');
    expect([...hot].map((r) => r.querySelector('code').textContent)).toEqual(['aud']);
    expect(hot[0].textContent).toContain('This decides the outcome');
    expect(within(good.container).getByTestId('wire-notice').textContent).toMatch(/What to notice.*aud/);
  });

  it('impersonation: the missing act claim is shown as the deciding row', async () => {
    const attack = ATTACKS.find((a) => a.id === 'impersonation');
    const { runs } = await post('impersonation', 'ungoverned');
    const { container } = render(<WirePanel attack={attack} entry={runs[0].trace.at(-1)} />);
    const row = container.querySelector('tr[data-hot="true"]');
    expect(row.textContent).toContain('(not present)');
  });

  it('rogue actor: the forged X-Actor-Client header is highlighted in the request', async () => {
    const attack = ATTACKS.find((a) => a.id === 'rogue-actor');
    const { runs } = await post('rogue-actor', 'ungoverned');
    const { container } = render(<WirePanel attack={attack} entry={runs[0].trace.at(-1)} />);
    expect(container.querySelector('mark').textContent).toBe('X-Actor-Client: agent-ok');
  });

  it('a step with no traffic says so plainly', async () => {
    const attack = ATTACKS.find((a) => a.id === 'confused-deputy-dcr');
    const { runs } = await post('confused-deputy-dcr', 'ungoverned');
    const { container } = render(<WirePanel attack={attack} entry={runs[0].trace[0]} />);
    expect(screen.getByTestId('wire-none').textContent).toMatch(/^No network call here: this is a decision a person makes/);
    expect(container.querySelector('[data-testid="wire-request"]')).toBeNull();
  });

  it('compact() never uses a real signature and the payload decodes back to the claims', () => {
    const t = { header: { alg: 'ES256' }, claims: { aud: 'x', exp: 1 } };
    const [h, p, s] = compact(t);
    expect(s).toBe('sig-not-real');
    expect(JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))).toEqual(t.claims);
    expect(JSON.parse(atob(h))).toEqual(t.header);
  });
});

describe('wire view in the pages', () => {
  it('the attack page opens a step on the wire from its trail', async () => {
    window.location.hash = '#/attack/audience-confusion'; render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Launch both' }));
    const side = await screen.findByTestId('side-governed'); await waitFor(() => within(side).getByTestId('wire-btn-2'));
    expect(within(side).queryByTestId('wire-panel')).toBeNull();
    fireEvent.click(within(side).getByTestId('wire-btn-2'));
    expect(within(side).getByTestId('wire-panel')).toBeInTheDocument();
    expect(within(side).getByTestId('wire-response').textContent).toContain('401 Unauthorized');
  });

  it('the compare page shows both requests and responses side by side', async () => {
    window.location.hash = '#/compare'; render(<App />);
    fireEvent.change(await screen.findByLabelText('Attack'), { target: { value: 'wrong-scope' } });
    fireEvent.click(screen.getByTestId('wire-compare-go'));
    const sides = await screen.findByTestId('wire-compare-sides');
    const responses = within(sides).getAllByTestId('wire-response').map((n) => n.textContent);
    expect(responses[0]).toContain('HTTP/1.1 200 OK');
    expect(responses[1]).toContain('HTTP/1.1 403 Forbidden');
    expect(responses[1]).toContain('insufficient_scope');
    expect(within(sides).getAllByTestId('wire-request')).toHaveLength(2);
  });
});
