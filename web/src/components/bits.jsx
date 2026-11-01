import { Component, useEffect, useState } from 'react';
import { CLAIM_LABEL } from '../data/claim.js';

/** Load once; { data, error }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let live = true;
    fn().then((data) => live && setState({ data, error: null })).catch((e) => live && setState({ data: null, error: String(e.message || e) }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
export const Loading = ({ state, children }) => (state.error ? <p role="alert" className="error">Could not reach the API: {state.error}</p> : !state.data ? <p className="muted" role="status">Loading...</p> : children(state.data));

/** A reference with a VERIFIED / UNVERIFIED badge. Unverified entries have no link: we did not read the page. */
export function RefBadge({ r }) {
  return (
    <span className="ref" data-testid={`ref-${r.id}`}>
      {r.url ? <a href={r.url} target="_blank" rel="noreferrer noopener">{r.label}</a> : <span>{r.label}</span>}{' '}
      <span className={`badge ${r.verified ? 'badge--ok' : 'badge--warn'}`} title={r.read}>{r.verified ? 'VERIFIED' : 'UNVERIFIED'}</span>
    </span>
  );
}
export const RefList = ({ refs }) => <ul className="refs">{refs.map((r) => <li key={r.id}><RefBadge r={r} /></li>)}</ul>;
export const attackHref = (id) => `#/attack/${id}`;

/** Where a field comes from: "deck claim", "lab reading", "lab-invented" (see FIELD_TAGS in server/src/asi.js). */
export const ClaimTag = ({ label }) => <span className="claim-tag" data-testid="claim-tag">{label}</span>;
/** The release-claim banner for pages that show something from the deck. Stays in presenter mode (not data-admin-only). */
export const ClaimBanner = () => (
  <div className="banner banner--claim" role="note" data-testid="claim-banner">
    <strong>{CLAIM_LABEL}.</strong> The OWASP ASI mapping on this page repeats Ping's deck (slide 55, release dated 2026-11-02). Nothing here was run on a Ping tenant, and the gallery's mock controls are not Ping features.
  </div>
);
export const roleText = (role) => (role === 'primary' ? 'primary' : 'related');
/** ASI chips for one attack: [{ id, role }]. Links to the ASI page. */
export const AsiChips = ({ asi }) => (
  <span className="chips" data-testid="asi-chips">{asi.map((m) => <a key={m.id} className="chip" href="#/asi" data-role={m.role} title={`${roleText(m.role)} reading (lab reading)`}>{m.id}{m.role === 'related' ? ' (related)' : ''}</a>)}</span>
);

/** Keeps one throwing page from blanking the whole app: shows a message in main, and resets when the key (route) changes. */
export class PageGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render() { return this.state.failed ? <p role="alert" className="error" data-testid="page-error">This page could not be drawn. Pick another tab or reload.</p> : this.props.children; }
}
