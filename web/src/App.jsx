import React, { useEffect, useState } from 'react';

// Skeleton only (step GA0). The gallery UI, the ReactFlow diagram and the run views arrive in later steps.
export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch('/api/catalog').then((r) => r.json()).then(setCatalog).catch((e) => setError(String(e.message || e)));
  }, []);
  return (
    <main className="page">
      <h1>Agent Attack Gallery</h1>
      <p className="muted">Skeleton build. The engine and API work; the gallery UI is not built yet.</p>
      {error && <p role="alert" className="error">Could not reach the API: {error}</p>}
      {catalog && (
        <ul className="list">
          {catalog.attacks.map((a) => (
            <li key={a.id}><strong>{a.name}</strong> <span className="muted">Pack {a.pack}</span></li>
          ))}
        </ul>
      )}
    </main>
  );
}
