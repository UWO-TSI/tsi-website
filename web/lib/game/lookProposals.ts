/**
 * Look changes waiting on David's eye (audit 2026-10 world items 1 and 10). They touch the approved look (rows
 * 236–239), so they ship behind a dev comparison and the default stays as approved until he picks them:
 *
 * - `autumn`: autumn grass an olive gold, clearly apart from the paths and the beach in value and hue.
 * - `overcast`: rain under an overcast sky with a softened sun and shadows and a wet sheen on the ground (snow a
 *   lighter overcast), eased with the weather.
 *
 * `?proposal=autumn,overcast` (or `?proposal=all`) turns them on outside production. Approving one means folding its
 * values into the defaults (the autumn palette row and its fallback; WEATHER_MOD) and deleting it here.
 */
export type LookProposal = "autumn" | "overcast";
export const LOOK_PROPOSALS: readonly LookProposal[] = ["autumn", "overcast"];
export const NO_PROPOSALS: ReadonlySet<LookProposal> = new Set();

/** The autumn `island_grass` proposed for the seasonal palette (now #C6B46D, a few lightness steps off the paths). */
export const PROPOSED_AUTUMN_GRASS = "#A2A44A";

/** `?proposal=autumn,overcast`, `?proposal=all`. */
export function parseProposals(search: string): ReadonlySet<LookProposal> {
  const value = new URLSearchParams(search).get("proposal");
  if (!value) return NO_PROPOSALS;
  const names = value.split(",").map(s => s.trim());
  return new Set(LOOK_PROPOSALS.filter(p => names.includes(p) || names.includes("all")));
}

const DEV = process.env.NODE_ENV !== "production";
let cached: { search: string; set: ReadonlySet<LookProposal> } | null = null;
/** The proposals the URL asks for (dev only; none in production or outside a browser). */
export function activeProposals(): ReadonlySet<LookProposal> {
  if (!DEV || typeof window === "undefined") return NO_PROPOSALS;
  const search = window.location.search;
  if (cached?.search !== search) cached = { search, set: parseProposals(search) };
  return cached.set;
}
