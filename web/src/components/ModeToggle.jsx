// Rule 19: the Mock / Real toggle. The gallery is mock only: every party is an in-process mock and nothing
// leaves the machine, so Real is always disabled with the reason. The hosted build (MOCK_ONLY=1) refuses
// every switch (403) and the toggle says so.
const NO_REAL = "This gallery has no live version: every party is a mock inside this app and nothing leaves the machine.";
const HOSTED = "The hosted build is Mock only.";

export default function ModeToggle({ info, onSelect }) {
  const loading = !info;
  const source = info?.source;
  const hosted = info?.hosted === true;
  const realOff = loading || hosted || info?.realAvailable !== true;
  const pick = (next) => { if (next !== source) onSelect?.(next); };
  return (
    <div className="mode-toggle" role="group" aria-label="Mode" data-testid="mode">
      <button type="button" aria-pressed={source === "mock"} disabled={loading} onClick={() => pick("mock")} data-testid="mode-mock">Mock</button>
      <button type="button" aria-pressed={source === "real"} disabled={realOff} title={hosted ? HOSTED : realOff && !loading ? NO_REAL : undefined} onClick={() => pick("real")} data-testid="mode-real">Real</button>
    </div>
  );
}
