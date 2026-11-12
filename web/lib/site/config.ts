/**
 * One template, one config per site (specs/site/revamp.md). The host picks the config; today only
 * the Tethos umbrella exists, and branch sites (tsi.tethos.ca and others) switch on when a second
 * branch is ready.
 */

export type SiteConfig = {
  key: string;
  name: string;
  /** The single signal colour, light blue on every ground (David, 2026-11-11). */
  accent: string;
  accentOnLight: string;
  contact: string;
  instagram: string;
  github: string;
};

export const TETHOS: SiteConfig = {
  key: "tethos",
  name: "Tethos",
  accent: "#1d9bf0",
  accentOnLight: "#1d9bf0",
  contact: "info@tethos.ca",
  instagram: "https://instagram.com/uwotsi",
  github: "https://github.com/UWO-TSI",
};

const SITES: Record<string, SiteConfig> = { tethos: TETHOS };

/** The config for a request host. Unknown hosts (previews, localhost) get Tethos. */
export function siteFor(host: string | null | undefined): SiteConfig {
  const sub = (host ?? "").toLowerCase().split(".")[0];
  return SITES[sub] ?? TETHOS;
}

/** Dates on the home page and the nav's marquee, in the order a year runs from August. */
export const YEAR = [
  { when: "Aug 10", title: "Nonprofit applications open", detail: "Apply for an 8-month build with a student team." },
  { when: "Aug 31", title: "Nonprofit applications close", detail: "Last day to apply. We choose partners in September." },
  { when: "Sep", title: "Student hiring, round 1", detail: "Project managers and VP roles." },
  { when: "Mar", title: "GENESIS", detail: "The year's projects on stage, in front of the nonprofits, sponsors and students behind them." },
  { when: "May", title: "Leadership hiring", detail: "Next year's executive team." },
] as const;

export const NUMBERS = [
  { value: "$500K+", label: "Value created" },
  { value: "100+", label: "Student developers" },
  { value: "150+", label: "Members" },
  { value: "20+", label: "Projects delivered" },
  { value: "2", label: "Chapters" },
] as const;

/** Words that now and then surface in the page grain, by page; other pages use the home list. */
export const GRAIN_WORDS: Record<string, readonly string[]> = {
  "/": ["SOCIAL IMPACT", "PRO BONO", "NONPROFITS", "BUILT FOR PURPOSE", "TECH FOR SOCIAL IMPACT", "STUDENT-RUN"],
  "/npo": ["PRO BONO", "AT NO COST", "NONPROFITS", "SOCIAL IMPACT"],
  "/genesis": ["GENESIS"],
};

export const GENESIS_2026 = [
  { value: "350+", label: "Attendees" },
  { value: "7", label: "Project demos" },
  { value: "6", label: "Sponsors" },
] as const;
