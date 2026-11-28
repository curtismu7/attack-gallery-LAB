// What the Help dialog says. Plain, and as hedged as the rest of the lab (rule 2): what was measured, what is simulated, what is UNVERIFIED.
export const HELP_SECTIONS = [
  {
    heading: "What this lab is",
    body: [
      "A gallery where an SE launches NAMED attacks against a mock MCP-style stack and sees each one refused, with the reason and the named control. Every attack runs twice: UNGOVERNED (the mock stack has the flaw, so the attack succeeds and you see what the attacker gets) and GOVERNED (the named control refuses with an educational error).",
      "The mock world is Meridian Air, a fictional airline: the agents act on SkyMiles loyalty accounts, and the Stories tab opens on its wording (the Vertical menu still offers Generic and Banking). Every party — good AS, evil AS, gateway, resource server, DCR proxy — is a mock inside this app. Nothing leaves this machine: no real server, token, tenant or network address is contacted."
    ]
  },
  {
    heading: "What was measured, and what is UNVERIFIED",
    body: [
      "What was measured: the ten attacks and ten controls in this app's own engine — with all controls on except one, only that control's attack succeeds. The tests prove it, and Reset mints a fresh mock keyring.",
      "The OWASP ASI tab shows the table from Ping's 'ID4AI Workforce - H2 2026' deck (slide 55, release 2026-11-02). Every control named there is a Ping claim, UNVERIFIED on our tenant — it was never run on a Ping environment. The deck does not map attacks to ASI rows; that mapping is the lab's reading.",
      "The controls are mocks of this app, not Privilege features. Nothing here says anything about real product behaviour."
    ]
  },
  {
    heading: "How to use the page",
    body: [
      "Tabs across the top: Gallery, Controls, Compare, OWASP ASI, Stories, Diagram, Honest limits. On Gallery, pick an attack to open its page.",
      "On an attack page, press Launch ungoverned, Launch governed or Launch both. A control toggle lets you turn that attack's own control off and re-run, so you can see the attack succeed.",
      "The header has Mock/Real (Mock only here — the hosted build is Mock only), theme, font size, Present, Talk track and Reset (fresh mock keyring)."
    ]
  },
  {
    heading: "Mock and Real",
    body: "The mode toggle answers the server before anything changes. There is no live version of this gallery: every party is a mock inside the app and nothing leaves the machine, in either position of the toggle. The banner on the page says which you are in."
  },
  {
    heading: "Where to read more",
    body: "The repository README covers the attack catalog, the control list, the ASI mapping and the honest-limits page; docs/ holds safety, architecture, attack-catalog, controls and ASI-mapping notes."
  }
];
