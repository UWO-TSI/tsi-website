/**
 * Movement keys (rows 49, 220; specs/movement.md "Controls"): Space jump, Q dash,
 * Shift sprint, C sneak and WASD, remappable on this device like the ability
 * keys (combat/runtime.ts). Taking another movement key swaps the two; menu,
 * interact and ability keys are refused.
 */
export type MoveAction = "forward" | "left" | "back" | "right" | "jump" | "dash" | "sprint" | "sneak";
export const MOVE_ACTIONS: { id: MoveAction; name: string }[] = [
  { id: "forward", name: "Forward" }, { id: "left", name: "Left" }, { id: "back", name: "Back" }, { id: "right", name: "Right" },
  { id: "jump", name: "Jump" }, { id: "dash", name: "Dash" }, { id: "sprint", name: "Sprint" }, { id: "sneak", name: "Sneak" },
];
export const DEFAULT_MOVE_KEYS: Record<MoveAction, string> = { forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift", sneak: "c" };
const STORE = "tsi.moveKeys.v1";
/** Interact, escape, tab and the default menu keys (lib/identity/settings). */
const RESERVED = new Set(["e", "escape", "tab", "enter", "b", "i", "m", "k", "l", "[", "]"]);

export const keyName = (k: string) => (k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

export function readMoveKeys(): Record<MoveAction, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (raw && typeof raw === "object") {
      const out = { ...DEFAULT_MOVE_KEYS };
      for (const a of Object.keys(out) as MoveAction[]) if (typeof raw[a] === "string" && raw[a] && !RESERVED.has(raw[a])) out[a] = raw[a];
      if (new Set(Object.values(out)).size === MOVE_ACTIONS.length) return out;
    }
  } catch { /* defaults */ }
  return { ...DEFAULT_MOVE_KEYS };
}

/** Rebind a movement key; `taken` are keys other systems own (the ability keys). */
export function remapMove(keys: Record<MoveAction, string>, id: MoveAction, raw: string, taken: readonly string[] = []): { ok: true; keys: Record<MoveAction, string> } | { ok: false; error: string } {
  const k = raw.toLowerCase() === "spacebar" ? " " : raw.toLowerCase();
  if (RESERVED.has(k) || taken.includes(k) || /^(meta|control|alt|capslock|dead|unidentified)$/.test(k)) return { ok: false, error: `${keyName(k)} is already used.` };
  const other = (Object.keys(keys) as MoveAction[]).find(a => a !== id && keys[a] === k);
  const next = { ...keys, [id]: k };
  if (other) next[other] = keys[id];
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* session only */ }
  return { ok: true, keys: next };
}
