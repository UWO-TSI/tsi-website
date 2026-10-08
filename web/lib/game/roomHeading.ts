/**
 * The place heading under the top cluster: its name and a line about it (audit-2026-10-ui item 5). Each room has its
 * own line; the island's is the village's. The room lines are proposals until David OKs them
 * (specs/polish/audit-2026-10-ui-questions.md).
 */
export type HeadingRoom = "hq" | "house" | "museum" | "oracle" | "cafe" | "shop";
export interface HeadingPlace { site: "village" | "home" | "ruins"; inside: HeadingRoom | null; atHome: boolean; event: string | null }

const ROOMS: Record<HeadingRoom, { title: string; subtitle: string }> = {
  hq: { title: "HQ", subtitle: "Where the club meets. Notices, missions and the trophy case." },
  oracle: { title: "Oracle temple", subtitle: "Quiet. The crystal is listening." },
  museum: { title: "Museum", subtitle: "Everything the island has found." },
  shop: { title: "Shop", subtitle: "Buy and sell at the counter." },
  cafe: { title: "Café", subtitle: "Warm drinks and quiet tables. Find a seat to study." },
  house: { title: "Your house", subtitle: "Yours to decorate." },
};
const ISLAND = "A little space to make our own.";

export function roomHeading({ site, inside, atHome, event }: HeadingPlace): { title: string; subtitle: string } {
  if (site === "ruins") return { title: "The ruins", subtitle: "Stay close to the light." };
  if (inside) return ROOMS[inside];
  if (atHome) return { title: "Your island", subtitle: ISLAND };
  return { title: "Tethos Island", subtitle: site === "village" && event ? `${event} is on.` : ISLAND };
}
