import { useEffect, useState } from 'react';

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
