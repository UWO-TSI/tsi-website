/**
 * The HQ visit with Alice as data (row 312, specs/hq-onboarding.md; reworked for t-hq, specs/launch/v1-gameplay.md, and
 * David's v2 review): you report to Alice at HQ and she runs the visit. A beat at a time: she says its lines (by key,
 * lines.ts WREN_LINES) in the dialogue box, a card or overlay may open, then the beat waits for what you do. Order: the
 * lore (an overlay: the island, the Founder, the gatherings), your island ID (she asks, prints and stamps it), coins and
 * gems (each icon flies to its place on screen), the gatherings' check-in, the menu, mail and minimap (the same), the
 * keyboard tour (press along), then Esc for real. Moving it, cutting a beat or adding one is a change here only.
 *
 * Beats wait for one thing each (HqEvent):
 *   wren     E at the front desk (Alice behind it)
 *   lore     the lore overlay closed
 *   signed   the ID printed, stamped and Done
 *   flown    an icon has flown to its place (a `fly:` card)
 *   checkin  the check-in card closed
 *   tour     the keyboard tour finished (or skipped; a touch screen skips it)
 *   esc      the Esc menu (the UI view) opened
 */
import type { FlyTarget } from "./lines";

export type HqEvent = "wren" | "lore" | "signed" | "flown" | "checkin" | "tour" | "esc";
export type HqCard = "lore" | "id" | "checkin" | "tour" | `fly:${FlyTarget}`;

export interface HqBeat {
  /** Its tracker step (lines.ts HQ_TRACKER). */
  id: string;
  /** Alice's lines (WREN_LINES keys) said as the beat starts, in order. */
  say?: readonly string[];
  /** A card that opens once she has said them. */
  card?: HqCard;
  /** What moves the visit on. */
  wait: HqEvent;
}

export const HQ_SCRIPT: readonly HqBeat[] = [
  // Bram sent you up; she's behind the front desk.
  { id: "report", wait: "wren" },
  // Where you've washed up: the island, the Founder, everyone welcome, the gatherings.
  { id: "lore", say: ["welcome"], card: "lore", wait: "lore" },
  // Your island ID: she asks, prints it, stamps it; Edit or Done.
  { id: "id", say: ["idAsk"], card: "id", wait: "signed" },
  // Coins, then gems: what each is for, its icon flying to its place.
  { id: "coins", say: ["idDone", "coins"], card: "fly:coins", wait: "flown" },
  { id: "gems", say: ["gems"], card: "fly:gems", wait: "flown" },
  // The gatherings' check-in code.
  { id: "events", say: ["events"], card: "checkin", wait: "checkin" },
  // The menu, mail and the minimap, each flying to its place.
  { id: "menuFly", say: ["menuFly"], card: "fly:menu", wait: "flown" },
  { id: "mail", say: ["mail"], card: "fly:mail", wait: "flown" },
  { id: "minimap", say: ["minimap"], card: "fly:minimap", wait: "flown" },
  // The keys, on a keyboard you press along on.
  { id: "tour", say: ["tour"], card: "tour", wait: "tour" },
  // Esc for real.
  { id: "esc", say: ["menu"], wait: "esc" },
];

/** Said once the last beat is done: she sends you off (to the museum with your first find). */
export const HQ_END: readonly string[] = ["farewell"];
/** The same while Bram's tour is still on (HQ first, the new world's route): he's waiting outside. */
export const HQ_END_TOUR: readonly string[] = ["farewellTour"];
