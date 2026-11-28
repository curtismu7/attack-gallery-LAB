// Rule 25 in the page: every call an attack makes to the gallery's gateway shows up under its Trail, in Mock (the only mode this lab has).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import App from '../App.jsx';
import { setJsonView } from '../components/JsonPane.jsx';
import { startApi } from './helpers.js';

let api;
beforeAll(() => { api = startApi(); });
afterAll(() => api.stop());
beforeEach(() => { window.location.hash = ''; setJsonView('raw'); });
const launch = async (id, button) => {
  window.location.hash = `#/attack/${id}`; render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: button }));
};

describe('What Privilege did on the attack page', () => {
  it('wrong-scope: both sides show the gateway call, its request, its response and the decisions', async () => {
    await launch('wrong-scope', 'Launch both');
    const un = within(await screen.findByTestId('side-ungoverned')); const gv = within(screen.getByTestId('side-governed'));
    const ungoverned = await un.findByTestId('gateway-trace'); const governedSide = await gv.findByTestId('gateway-trace');
    expect(within(governedSide).getByTestId('gateway-trace-basis')).toHaveTextContent(/Simulated: this lab's own in-process gateway \(not a Privilege product\)/);
    const decisions = within(governedSide).getAllByTestId(/-decisions$/).at(-1);
    expect(decisions).toHaveTextContent('Scope check');
    expect(decisions).toHaveTextContent('FAIL');
    expect(decisions).toHaveTextContent(/needs accounts:write, the token has accounts:read/);
    expect(decisions).toHaveTextContent('NOT REACHED');
    expect(within(governedSide).getAllByText(/HTTP 403/).length).toBeGreaterThan(0);
    // ungoverned: the control is off, so it is information and the call went through
    const off = within(ungoverned).getAllByTestId(/-decisions$/).at(-1);
    expect(off).toHaveTextContent(/OFF in this run, so not checked/); expect(off).not.toHaveTextContent('FAIL');
    expect(within(ungoverned).getAllByText(/HTTP 200/).length).toBeGreaterThan(0);
    // the exact request goes through the shared JsonPane, whole, with the token reduced to its length
    const req = within(governedSide).getAllByTestId(/-request-box$/).at(-1);
    expect(req).toHaveTextContent('POST https://gw.gallery.example/mcp'); expect(req).toHaveTextContent('"name": "transfer_miles"');
    expect(req).toHaveTextContent(/Bearer <token, \d+ characters, kept on the server>/);
    expect(document.body.textContent).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
  });
  it('an attack the gateway never decides says so instead of showing an empty panel', async () => {
    await launch('ssrf-metadata', 'Launch governed');
    const gv = within(await screen.findByTestId('side-governed'));
    expect(await gv.findByTestId('gateway-none')).toHaveTextContent(/No call reached the gateway/);
    expect(gv.queryByTestId('gateway-trace')).toBeNull();
  });
  it('before a run there is no panel', async () => {
    window.location.hash = '#/attack/wrong-scope'; render(<App />);
    await screen.findByRole('button', { name: 'Launch both' });
    expect(screen.queryByTestId('gateway-trace')).toBeNull();
  });
});
