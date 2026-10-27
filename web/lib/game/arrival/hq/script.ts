/**
 * The HQ visit with Alice as data (row 312, specs/hq-onboarding.md; reworked for t-hq, specs/launch/v1-gameplay.md):
 * you report to Alice at HQ and she runs the visit. A beat at a time: she says its lines (by key, lines.ts
 * WREN_LINES) in the dialogue box, a card or overlay may open, then the beat waits for what you do. Order: the lore
 * (an overlay: Tethos, the island, what counts), the island register, the real club (events are how you earn, the
 * check-in QR), coins and gems for real merch, the UI tour (what to press and hold, the mailbox, the chat, every
 * button), then Esc for real. Moving it, cutting a beat or adding one is a change here only.
 *
 * Beats wait for one thing each (HqEvent):
 *   wren     E at the front desk (Alice behind it)
 *   lore     the lore overlay closed
 *   signed   the register signed and its card closed
 *   checkin  the check-in card closed
 *   merch    the coins-and-merch card closed
 *   tour     the UI tour finished (or skipped)
 *   esc      the Esc menu (the UI view) opened
 */
export type HqEvent = "wren" | "lore" | "signed" | "checkin" | "merch" | "tour" | "esc";
export type HqCard = "lore" | "register" | "checkin" | "merch" | "tour";

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
  // Where you've washed up: Tethos, the island, what counts.
  { id: "lore", say: ["welcome"], card: "lore", wait: "lore" },
  // The island register (your world name), then the friend code and the mailbox on its card.
  { id: "register", say: ["register"], card: "register", wait: "signed" },
  // The real club: events are how you earn coins, gems and experience; the check-in QR at the door.
  { id: "checkin", say: ["registered", "club"], card: "checkin", wait: "checkin" },
  // Coins and gems trade for real TSI merch.
  { id: "merch", say: ["merch"], card: "merch", wait: "merch" },
  // Where everything is: what to press and hold, the mailbox, the chat, every button.
  { id: "tour", say: ["tour"], card: "tour", wait: "tour" },
  // Esc for real.
  { id: "esc", say: ["menu"], wait: "esc" },
];

/** Said once the last beat is done: she sends you off (to the museum with your first find). */
export const HQ_END: readonly string[] = ["farewell"];
/** The same while Bram's tour is still on (HQ first, the new world's route): he's waiting outside. */
export const HQ_END_TOUR: readonly string[] = ["farewellTour"];
