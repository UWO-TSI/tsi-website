import type { Redirect, Rewrite } from "next/dist/lib/load-custom-routes";

/**
 * Three hosts, one app. play.tethos.ca is the student portal (David, 2026-10-03: the title screen at `/`, the island,
 * onboarding, the companion). genesis.tethos.ca is the GENESIS pass (2026-11-19, specs/genesis-pass.md): its pages live
 * under /pass and the host serves them from its root. www.tethos.ca is everything else (the site, recruitment, admin).
 * Each host sends the others' pages across; shared files (/api, /_next, /public assets) answer on all of them. Only the
 * production hosts redirect: localhost and *.vercel.app previews serve every page in place (/pass included).
 * `play.localhost` and `genesis.localhost` behave like their hosts for local checks.
 */
export const SITE_ORIGIN = "https://www.tethos.ca";
export const PLAY_ORIGIN = "https://play.tethos.ca";
export const GENESIS_ORIGIN = "https://genesis.tethos.ca";

const ON_PLAY: Redirect["has"] = [{ type: "host", value: "play\\.tethos\\.ca" }];
const ON_SITE: Redirect["has"] = [{ type: "host", value: "(?:www\\.)?tethos\\.ca" }];
/** /student/<area> pages that belong to the portal. */
const PORTAL = "go|dashboard|onboarding|companion|check-in|reset-password|opening-soon|election|auth";
/** Site pages someone might open on the play host. */
const SITE_PAGES = "npo|genesis|admin|under-construction";

export const hostRedirects: Redirect[] = [
  { source: "/student", has: ON_SITE, destination: `${PLAY_ORIGIN}/`, permanent: false },
  { source: `/student/:area(${PORTAL})/:rest*`, has: ON_SITE, destination: `${PLAY_ORIGIN}/student/:area/:rest*`, permanent: false },
  { source: "/student", has: ON_PLAY, destination: "/", permanent: false },
  { source: "/student/apply/:rest*", has: ON_PLAY, destination: `${SITE_ORIGIN}/student/apply/:rest*`, permanent: false },
  { source: `/:page(${SITE_PAGES})/:rest*`, has: ON_PLAY, destination: `${SITE_ORIGIN}/:page/:rest*`, permanent: false },
  // The GENESIS pass opened on the site or the portal: across to its own host.
  { source: "/pass/:rest*", has: ON_SITE, destination: `${GENESIS_ORIGIN}/:rest*`, permanent: false },
  { source: "/pass/:rest*", has: ON_PLAY, destination: `${GENESIS_ORIGIN}/:rest*`, permanent: false },
];

const GENESIS_HOST: Rewrite["has"] = [{ type: "host", value: "genesis\\..+" }];
/**
 * The title screen is `/` on the play host (it renders /student). On the genesis host every page path is the pass's:
 * `/` is /pass and `/p/ark-aid` is /pass/p/ark-aid; /api, /_next, /pass itself and files (anything with a dot) are not.
 */
export const hostRewrites: Rewrite[] = [
  { source: "/", has: [{ type: "host", value: "play\\..+" }], destination: "/student" },
  { source: "/", has: GENESIS_HOST, destination: "/pass" },
  { source: "/:path((?!api/|_next/|pass(?:/|$))[^.]+)", has: GENESIS_HOST, destination: "/pass/:path" },
];

/** Where "Back to tethos.ca" goes from the portal: across to the site from play hosts, `/` elsewhere. */
export function siteHomeFor(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase();
  if (!h.startsWith("play.")) return "/";
  return /(^|\.)tethos\.ca(:\d+)?$/.test(h) ? `${SITE_ORIGIN}/` : `http://${h.slice("play.".length)}/`;
}
