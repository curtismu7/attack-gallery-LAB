import { createApp } from './app.js';
import { resolveBind } from './bind.js';

const { host, port } = resolveBind();
const { app } = await createApp();
app.listen(port, host, () => console.log(`Agent Attack Gallery listening on http://${host.includes(':') ? `[${host}]` : host}:${port} (mock parties only; no outbound requests)`));
