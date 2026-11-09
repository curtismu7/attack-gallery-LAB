import { createApp } from './app.js';
import { resolveBind } from './bind.js';

const { host, port, allowedHosts, labHosts } = resolveBind();
const { app } = await createApp({ allowedHosts, labHosts, port });
const server = app.listen(port, host, () => console.log(`Agent Attack Gallery listening on http://${host.includes(':') ? `[${host}]` : host}:${server.address().port} (mock parties only; no outbound requests)`));
