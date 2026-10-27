/**
 * The HQ visit with Alice as data (row 312, specs/hq-onboarding.md): after Bram's walk-along hands you off, you report
 * to Alice at HQ and she runs the visit. A beat at a time: she says its lines (by key, lines.ts WREN_LINES) in the
 * dialogue box, a card may open (the register, the check-in card), then the beat waits for what you do. Order:
 * register, the real club and its check-ins, the two lore beats (real life counts; the Founder's desk), the Esc menu
 * and the map, the notice board and the club goals. Moving it, cutting a beat or adding one is a change here only.
 *
 * Beats wait for one thing each (HqEvent):
 *   wren     E at the front desk (Alice behind it)
 *   signed   the register signed and its card closed
 *   checkin  the check-in card closed
 *   founder  the Founder's desk looked at (its plaque card closed)
 *   esc      the Esc menu (the UI view) opened
 *   map      the island map opened
 *   board    the notice board read (its sheet opened at HQ)
 */
export type HqEvent = "wren" | "signed" | "checkin" | "founder" | "esc" | "map" | "board";
export type HqCard = "register" | "checkin";

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
  // Registering: the island register (your world name), then the friend code and the mailbox on its card.
  { id: "register", say: ["welcome"], card: "register", wait: "signed" },
  // The real club: real TSI events level you up; where the check-in code goes.
  { id: "checkin", say: ["registered", "club"], card: "checkin", wait: "checkin" },
  // Lore, light: real life counts; then the Founder's empty desk and its blank plaque.
  { id: "founder", say: ["realLife"], wait: "founder" },
  // The Esc menu and the map.
  { id: "esc", say: ["founder", "menu"], wait: "esc" },
  { id: "map", wait: "map" },
  // The notice board and the club goals.
  { id: "board", say: ["map", "board"], wait: "board" },
];

/** Said once the last beat is done: the club goals, and she sends you off. */
export const HQ_END: readonly string[] = ["goals", "farewell"];
