/**
 * Alice's keyboard tour (David's v2 review: "make 2d model of the qwerty keyboard and use it as overlay, have people
 * click the button, teach things that are not learned ... user has to actually follow along instead of pressing
 * next"). A step at a time, the key lights up on a drawn keyboard and you press it, or hold it, to go on. Only what
 * the rest of the tutorial doesn't teach (walking, jump, dash and E are Bram's on the dock; Esc is Alice's last beat).
 * The keys are the player's own bindings (lib/game/movement/keys.ts, lib/identity/settings.ts), as KeyboardEvent keys
 * in lower case. Each press also brings in its part of your screen, in its real place (David's v3 review: "pressing it
 * the mini map, the back pack stuff like that begins popping in the ui one by one"): `piece`. DRAFTS for David.
 */

/** The bindings the tour teaches, as `KeyboardEvent.key` in lower case ("tab", "g", "enter"). */
export interface TourKeys { wheel: string; emote: string; hud: string; bag: string; collection: string; quests: string; map: string; mail: string }
/** A part of your screen a key brings in (DefaultIslandWorld shows it from that press until the tour ends). */
export type HudPiece = "hud" | "chat" | "bag" | "collection" | "quests" | "map" | "mail";
export interface TourStep {
  id: string;
  /** What pressing it brings onto your screen (the wheels open only out in the world: none). */
  piece?: HudPiece;
  /** The key to press (`KeyboardEvent.key`, lower case). */
  key: string;
  /** Held (the wheels, the HUD) rather than pressed. */
  hold: boolean;
  /** What it's for, in a word or two (David's v4 review: "less uncessary text"). */
  title: string;
}

/** How long a hold has to last (ms). */
export const HOLD_MS = 650;

export function tourSteps(k: TourKeys): TourStep[] {
  return [
    { id: "wheel", key: k.wheel, hold: true, title: "Tools" },
    { id: "emote", key: k.emote, hold: true, title: "Emotes" },
    { id: "hud", piece: "hud", key: k.hud, hold: true, title: "At a glance" },
    { id: "chat", piece: "chat", key: "enter", hold: false, title: "Chat" },
    { id: "bag", piece: "bag", key: k.bag, hold: false, title: "Bag" },
    { id: "collection", piece: "collection", key: k.collection, hold: false, title: "Collection" },
    { id: "quests", piece: "quests", key: k.quests, hold: false, title: "Quests" },
    { id: "map", piece: "map", key: k.map, hold: false, title: "Map" },
    { id: "mail", piece: "mail", key: k.mail, hold: false, title: "Mail" },
  ];
}

/**
 * One key event against the step showing: what it does to the tour. A press step moves on at the key's press; a hold
 * step starts at the press and moves on once it has been held HOLD_MS (`held`), and a let-go too soon starts it again.
 */
export type TourInput = { type: "down" | "up"; key: string; repeat?: boolean; at: number };
export interface TourProgress { step: number; holdFrom: number | null }
export function tourInput(p: TourProgress, steps: readonly TourStep[], e: TourInput): TourProgress {
  const step = steps[p.step];
  if (!step || e.key.toLowerCase() !== step.key) return p;
  if (e.type === "down") {
    if (e.repeat) return p;
    return step.hold ? { ...p, holdFrom: e.at } : { step: p.step + 1, holdFrom: null };
  }
  return { ...p, holdFrom: null };
}
/** A hold that has lasted long enough moves on (checked each frame while it's down). */
export function tourTick(p: TourProgress, now: number): TourProgress {
  return p.holdFrom !== null && now - p.holdFrom >= HOLD_MS ? { step: p.step + 1, holdFrom: null } : p;
}

export const UI_TOUR = { eyebrow: "Alice's keys", press: "Press", hold: "Hold", skip: "Skip", done: "All done" } as const;
