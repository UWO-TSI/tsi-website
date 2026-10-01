/**
 * Device key maps (rows 49, 220; specs/movement.md "Controls"): the movement
 * keys (Space jump, Q dash, Shift sprint, crouch/slide and WASD) and the ruins'
 * ability keys (slots 1–4 and the weapon swap R). The menu keys are the
 * account's (lib/identity/settings). Taking another key of the same map swaps
 * the two; the fixed keys (FIXED_KEYS) and the other maps' keys are refused.
 * A remap announces itself so the avatar, the HUD and the hints follow.
 *
 * Crouch/slide (row 274, specs/movement-slide.md) is Ctrl on macOS and C
 * elsewhere: there Ctrl+W closes the tab and a page cannot stop it, so Ctrl
 * only crouches in fullscreen with the keyboard locked (`playFullscreenWithCtrl`),
 * and C stands in for it outside.
 */
import { useEffect, useState } from "react";
import { FIXED_KEYS, normalizeKey } from "@/lib/identity/settings";
import { menuKeys } from "@/lib/game/identity";
import type { AbilityId } from "@/lib/game/combat/runtime";

export const keyName = (k: string) => (k === " " ? "Space" : k === "control" ? "Ctrl" : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
/** macOS (Cmd holds the browser's shortcuts, so Ctrl is free) or an iPad with a keyboard. */
export const IS_MAC = typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

type Remap<A extends string> = { ok: true; keys: Record<A, string> } | { ok: false; error: string };

/**
 * A key map kept on this device: `read` (stored, else the defaults), `remap`
 * (refusing the fixed keys, `taken()` and `extra`) and `use` (follows remaps).
 * `readTaken` are keys a stored value may not hold (set before a key moved).
 */
function keyStore<A extends string>(storageKey: string, defaults: Record<A, string>, opts: { valid: (k: string, id: A) => boolean; taken: () => readonly string[]; readTaken?: () => readonly string[] }) {
  const event = `tsi:keys:${storageKey}`;
  const usable = (k: string, id: A, taken: readonly string[]) => opts.valid(k, id) && !FIXED_KEYS.includes(k) && !taken.includes(k);
  const read = (): Record<A, string> => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (raw && typeof raw === "object") {
        const out = { ...defaults }, taken = opts.readTaken?.() ?? [];
        for (const a of Object.keys(out) as A[]) if (typeof raw[a] === "string" && raw[a] && usable(raw[a], a, taken)) out[a] = raw[a];
        if (new Set(Object.values(out)).size === Object.keys(out).length) return out;
      }
    } catch { /* defaults */ }
    return { ...defaults };
  };
  const remap = (keys: Record<A, string>, id: A, raw: string, extra: readonly string[] = []): Remap<A> => {
    const k = normalizeKey(raw);
    if (!opts.valid(k, id)) return { ok: false, error: `${keyName(k)} can't be bound to that.` };
    if (!usable(k, id, [...opts.taken(), ...extra])) return { ok: false, error: `${keyName(k)} is already used.` };
    const other = (Object.keys(keys) as A[]).find(a => a !== id && keys[a] === k);
    if (other && !opts.valid(keys[id], other)) return { ok: false, error: `${keyName(k)} is already used.` }; // the swap can't take this key (Ctrl is only ever crouch)
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

export type MoveAction = "forward" | "left" | "back" | "right" | "jump" | "dash" | "sprint" | "crouch";
export const MOVE_ACTIONS: { id: MoveAction; name: string }[] = [
  { id: "forward", name: "Forward" }, { id: "left", name: "Left" }, { id: "back", name: "Back" }, { id: "right", name: "Right" },
  { id: "jump", name: "Jump" }, { id: "dash", name: "Dash" }, { id: "sprint", name: "Sprint" }, { id: "crouch", name: "Crouch / slide" },
];
/** The movement defaults on a platform: crouch/slide is Ctrl on macOS, C elsewhere (it replaces the old C sneak). */
export const moveDefaults = (mac: boolean): Record<MoveAction, string> => ({ forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift", crouch: mac ? "control" : "c" });
export const DEFAULT_MOVE_KEYS = moveDefaults(IS_MAC);
// Q is the dash, and the dodge in the ruins (specs/movement.md), so the swap moved from Q to R.
export const DEFAULT_ABILITY_KEYS: Record<AbilityId, string> = { slot1: "1", slot2: "2", slot3: "3", slot4: "4", swap: "r" };

const move = keyStore<MoveAction>("tsi.moveKeys.v1", DEFAULT_MOVE_KEYS, {
  valid: (k, id) => !/^(meta|alt|capslock|dead|unidentified)$/.test(k) && (k !== "control" || id === "crouch"),
  taken: (): string[] => [...Object.values(readAbilityKeys()), ...menuKeys()],
});
const ability = keyStore<AbilityId>("tsi.combatKeys.v2", DEFAULT_ABILITY_KEYS, { // v1 bound the prototype runes, not slots
  valid: k => k.length === 1,
  taken: (): string[] => [...Object.values(readMoveKeys()), ...menuKeys()],
  readTaken: (): string[] => Object.values(readMoveKeys()),
});
export const { read: readMoveKeys, remap: remapMove, use: useMoveKeys } = move;
export const { read: readAbilityKeys, remap: remapAbility, use: useAbilityKeys } = ability;

// ── Ctrl outside macOS: fullscreen with the keyboard locked ──────────
type KeyboardLock = { lock?: (codes?: string[]) => Promise<void>; unlock?: () => void };
let locked = false;
const LOCK_EVENT = "tsi:keys:lock";
const setLocked = (on: boolean) => { if (on !== locked) { locked = on; window.dispatchEvent(new Event(LOCK_EVENT)); } };
/** The browser can lock the keyboard (Chromium): offer Ctrl in fullscreen there. */
export const canLockKeyboard = () => typeof navigator !== "undefined" && !!(navigator as Navigator & { keyboard?: KeyboardLock }).keyboard?.lock;
/**
 * Fullscreen with the keyboard locked, where Ctrl+W and the like reach the game instead of the browser (Esc held
 * leaves), and bind crouch to Ctrl. Leaving fullscreen unlocks it and C crouches again (`crouchKey`).
 */
export async function playFullscreenWithCtrl(keys: Record<MoveAction, string>): Promise<string | null> {
  try {
    await document.documentElement.requestFullscreen();
    await (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard!.lock!();
  } catch { return "This browser can't lock the keyboard in fullscreen, so Ctrl stays off (it would close the tab)."; }
  const off = () => { if (!document.fullscreenElement) { setLocked(false); document.removeEventListener("fullscreenchange", off); } };
  document.addEventListener("fullscreenchange", off);
  setLocked(true);
  const r = keys.crouch === "control" ? null : remapMove(keys, "crouch", "control");
  return r && !r.ok ? r.error : null;
}
/** The key that crouches now: the bound one, except Ctrl outside macOS without the fullscreen lock, which falls back to C (none if C is taken). */
export function crouchKey(keys: Record<MoveAction, string>, keyboardLocked: boolean, mac = IS_MAC): string {
  if (keys.crouch !== "control" || mac || keyboardLocked) return keys.crouch;
  return Object.values(keys).includes("c") ? "" : "c";
}
/** Whether the keyboard is locked in fullscreen now (follows `playFullscreenWithCtrl` and leaving fullscreen). */
export function useKeyboardLocked() {
  const [on, setOn] = useState(locked);
  useEffect(() => {
    const sync = () => setOn(locked);
    window.addEventListener(LOCK_EVENT, sync);
    return () => window.removeEventListener(LOCK_EVENT, sync);
  }, []);
  return on;
}

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
