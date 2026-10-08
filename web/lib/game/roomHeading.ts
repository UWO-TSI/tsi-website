/**
 * The place heading under the top cluster: its name and a line about it (audit-2026-10-ui item 5). Each room has its
 * 
 * name only (David, 2026-10-08: no room subtitles); the café keeps its study line, the island its own.
 */
export type HeadingRoom = "hq" | "house" | "museum" | "oracle" | "cafe" | "shop";
export interface HeadingPlace { site: "village" | "home" | "ruins"; inside: HeadingRoom | null; atHome: boolean; event: string | null }

const ROOMS: Record<HeadingRoom, { title: string; subtitle: string }> = {
  hq: { title: "HQ", subtitle: "" },
  oracle: { title: "Oracle temple", subtitle: "" },
  museum: { title: "Museum", subtitle: "" },
  shop: { title: "Shop", subtitle: "" },
  cafe: { title: "Café", subtitle: "Warm drinks and quiet tables. Find a seat to study." },
  house: { title: "Your house", subtitle: "" },
};
const ISLAND = "A little space to make our own.";

export function roomHeading({ site, inside, atHome, event }: HeadingPlace): { title: string; subtitle: string } {
  if (site === "ruins") return { title: "The ruins", subtitle: "" };
  if (inside) return ROOMS[inside];
  if (atHome) return { title: "Your island", subtitle: ISLAND };
  return { title: "Tethos Island", subtitle: site === "village" && event ? `${event} is on.` : ISLAND };
}
