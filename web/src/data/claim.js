// The label that sits on every page carrying a Ping release claim. A web test pins it to the server's CLAIM_LABEL (server/src/asi.js).
export const CLAIM_LABEL = 'Ping release claim, UNVERIFIED on our tenant';
// Routes that show nothing from the deck carry no claim banner: the rest (gallery, attack, asi, limits) do.
export const NO_CLAIM_ROUTES = ['controls', 'compare', 'stories', 'diagram'];
export const hasClaim = (routeName) => !NO_CLAIM_ROUTES.includes(routeName);
