/**
 * Device key maps (rows 49, 220; specs/movement.md "Controls"): the movement
 * keys (Space jump, Q dash, Shift sprint, C sneak and WASD) and the ruins'
 * ability keys (slots 1–4 and the weapon swap R). The menu keys are the
 * account's (lib/identity/settings). Taking another key of the same map swaps
 * the two; the fixed keys (FIXED_KEYS) and the other maps' keys are refused.
 * A remap announces itself so the avatar, the HUD and the hints follow.
 */
import { useEffect, useState } from "react";
import { FIXED_KEYS, normalizeKey } from "@/lib/identity/settings";
import { menuKeys } from "@/lib/game/identity";
import type { AbilityId } from "@/lib/game/combat/runtime";

export const keyName = (k: string) => (k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

type Remap<A extends string> = { ok: true; keys: Record<A, string> } | { ok: false; error: string };

/**
 * A key map kept on this device: `read` (stored, else the defaults), `remap`
 * (refusing the fixed keys, `taken()` and `extra`) and `use` (follows remaps).
 * `readTaken` are keys a stored value may not hold (set before a key moved).
 */
function keyStore<A extends string>(storageKey: string, defaults: Record<A, string>, opts: { valid: (k: string) => boolean; taken: () => readonly string[]; readTaken?: () => readonly string[] }) {
  const event = `tsi:keys:${storageKey}`;
  const usable = (k: string, taken: readonly string[]) => opts.valid(k) && !FIXED_KEYS.includes(k) && !taken.includes(k);
  const read = (): Record<A, string> => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (raw && typeof raw === "object") {
        const out = { ...defaults }, taken = opts.readTaken?.() ?? [];
        for (const a of Object.keys(out) as A[]) if (typeof raw[a] === "string" && raw[a] && usable(raw[a], taken)) out[a] = raw[a];
        if (new Set(Object.values(out)).size === Object.keys(out).length) return out;
      }
    } catch { /* defaults */ }
    return { ...defaults };
  };
  const remap = (keys: Record<A, string>, id: A, raw: string, extra: readonly string[] = []): Remap<A> => {
    const k = normalizeKey(raw);
    if (!usable(k, [...opts.taken(), ...extra])) return { ok: false, error: `${keyName(k)} is already used.` };
    const other = (Object.keys(keys) as A[]).find(a => a !== id && keys[a] === k);
    const next: Record<A, string> = { ...keys, [id]: k };
    if (other) next[other] = keys[id];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* session only */ }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
    return { ok: true, keys: next };
  };
  const use = (): Record<A, string> => {
    const [keys, setKeys] = useState(read);
    useEffect(() => {
      const on = () => setKeys(read());
      window.addEventListener(event, on);
      return () => window.removeEventListener(event, on);
    }, []);
    return keys;
  };
  return { read, remap, use };
}

export type MoveAction = "forward" | "left" | "back" | "right" | "jump" | "dash" | "sprint" | "sneak";
export const MOVE_ACTIONS: { id: MoveAction; name: string }[] = [
  { id: "forward", name: "Forward" }, { id: "left", name: "Left" }, { id: "back", name: "Back" }, { id: "right", name: "Right" },
  { id: "jump", name: "Jump" }, { id: "dash", name: "Dash" }, { id: "sprint", name: "Sprint" }, { id: "sneak", name: "Sneak" },
];
export const DEFAULT_MOVE_KEYS: Record<MoveAction, string> = { forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift", sneak: "c" };
// Q is the dash, and the dodge in the ruins (specs/movement.md), so the swap moved from Q to R.
export const DEFAULT_ABILITY_KEYS: Record<AbilityId, string> = { slot1: "1", slot2: "2", slot3: "3", slot4: "4", swap: "r" };

const move = keyStore("tsi.moveKeys.v1", DEFAULT_MOVE_KEYS, {
  valid: k => !/^(meta|control|alt|capslock|dead|unidentified)$/.test(k),
  taken: (): string[] => [...Object.values(readAbilityKeys()), ...menuKeys()],
});
const ability = keyStore("tsi.combatKeys.v2", DEFAULT_ABILITY_KEYS, { // v1 bound the prototype runes, not slots
  valid: k => k.length === 1,
  taken: (): string[] => [...Object.values(readMoveKeys()), ...menuKeys()],
  readTaken: (): string[] => Object.values(readMoveKeys()),
});
export const { read: readMoveKeys, remap: remapMove, use: useMoveKeys } = move;
export const { read: readAbilityKeys, remap: remapAbility, use: useAbilityKeys } = ability;

/** While `active`, the next key press goes to `onKey` (Escape calls `onCancel`) and nothing else sees it. */
export function useNextKey(active: boolean, onKey: (key: string) => void, onCancel: () => void) {
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") onCancel(); else onKey(e.key);
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [active, onKey, onCancel]);
}
