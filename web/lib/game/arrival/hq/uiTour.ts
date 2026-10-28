/**
 * Alice's keyboard tour (David's v2 review: "make 2d model of the qwerty keyboard and use it as overlay, have people
 * click the button, teach things that are not learned ... user has to actually follow along instead of pressing
 * next"). A step at a time, the key lights up on a drawn keyboard and you press it, or hold it, to go on. Only what
 * the rest of the tutorial doesn't teach (walking, jump, dash and E are Bram's on the dock; Esc is Alice's last beat).
 * The keys are the player's own bindings (lib/game/movement/keys.ts, lib/identity/settings.ts), as KeyboardEvent keys
 * in lower case. DRAFTS for David.
 */

/** The bindings the tour teaches, as `KeyboardEvent.key` in lower case ("tab", "g", "enter"). */
export interface TourKeys { wheel: string; emote: string; hud: string; bag: string; collection: string; quests: string; map: string; mail: string }
export interface TourStep {
  id: string;
  /** The key to press (`KeyboardEvent.key`, lower case). */
  key: string;
  /** Held (the wheels, the HUD) rather than pressed. */
  hold: boolean;
  title: string;
  text: string;
}

/** How long a hold has to last (ms). */
export const HOLD_MS = 650;

export function tourSteps(k: TourKeys): TourStep[] {
  return [
    { id: "wheel", key: k.wheel, hold: true, title: "Your tools", text: "Hold for your tool wheel. Point at a tool and let go to take it out." },
    { id: "emote", key: k.emote, hold: true, title: "Emotes", text: "Hold for your emote wheel. Wave, dance, sit down." },
    { id: "hud", key: k.hud, hold: true, title: "At a glance", text: "Hold to see your coins, level and gear." },
    { id: "chat", key: "enter", hold: false, title: "Chat", text: "Talk to everyone on the island. Type, then Enter again to send." },
    { id: "bag", key: k.bag, hold: false, title: "Your bag", text: "Everything you're carrying." },
    { id: "collection", key: k.collection, hold: false, title: "Your collection", text: "Every fish and bug you've found." },
    { id: "quests", key: k.quests, hold: false, title: "Quests", text: "Your quests and your journal." },
    { id: "map", key: k.map, hold: false, title: "The map", text: "The whole island, and where you are on it." },
    { id: "mail", key: k.mail, hold: false, title: "Mail", text: "Letters from HQ and your friends." },
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

/** The keyboard as drawn: the rows of a US QWERTY board, each key its `KeyboardEvent.key` and its width in key units. */
export type BoardKey = { key: string; label: string; w?: number };
export const KEYBOARD: readonly (readonly BoardKey[])[] = [
  [{ key: "escape", label: "Esc", w: 1.25 }, ..."1234567890".split("").map(c => ({ key: c, label: c })), { key: "-", label: "-" }, { key: "=", label: "=" }, { key: "backspace", label: "Delete", w: 1.75 }],
  [{ key: "tab", label: "Tab", w: 1.5 }, ..."qwertyuiop".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: "[", label: "[" }, { key: "]", label: "]" }, { key: "\\", label: "\\", w: 1.5 }],
  [{ key: "capslock", label: "Caps", w: 1.75 }, ..."asdfghjkl".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: ";", label: ";" }, { key: "'", label: "'" }, { key: "enter", label: "Enter", w: 2.25 }],
  [{ key: "shift", label: "Shift", w: 2.25 }, ..."zxcvbnm".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: ",", label: "," }, { key: ".", label: "." }, { key: "/", label: "/" }, { key: "shift-r", label: "Shift", w: 2.75 }],
  [{ key: "control", label: "Ctrl", w: 1.5 }, { key: "alt", label: "Alt", w: 1.25 }, { key: "meta", label: "Cmd", w: 1.5 }, { key: " ", label: "", w: 6.25 }, { key: "meta-r", label: "Cmd", w: 1.5 }, { key: "alt-r", label: "Alt", w: 1.25 }, { key: "arrowleft", label: "←" }, { key: "arrowright", label: "→" }],
];

export const UI_TOUR = { eyebrow: "Alice's keys", press: "Press", hold: "Hold", skip: "Skip", done: "All done" } as const;
