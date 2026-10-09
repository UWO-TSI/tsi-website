import type { Redirect, Rewrite } from "next/dist/lib/load-custom-routes";

/**
 * Two hosts, one app (David, 2026-10-03): play.tethos.ca is the student portal (the title screen at `/`,
 * the island, onboarding, the companion), www.tethos.ca is everything else (the site, recruitment, admin).
 * Each host sends the other's pages across; shared files (/api, /_next, /public assets) answer on both.
 * Only the production hosts redirect: localhost and *.vercel.app previews serve every page in place.
 * `play.localhost` gets the title screen at `/` for local checks.
 */
export const SITE_ORIGIN = "https://www.tethos.ca";
export const PLAY_ORIGIN = "https://play.tethos.ca";

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
];

/** The title screen is `/` on the play host (it renders /student). */
export const hostRewrites: Rewrite[] = [{ source: "/", has: [{ type: "host", value: "play\\..+" }], destination: "/student" }];

/** Where "Back to tethos.ca" goes from the portal: across to the site from play hosts, `/` elsewhere. */
export function siteHomeFor(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase();
  if (!h.startsWith("play.")) return "/";
  return /(^|\.)tethos\.ca(:\d+)?$/.test(h) ? `${SITE_ORIGIN}/` : `http://${h.slice("play.".length)}/`;
}
