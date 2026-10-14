/**
 * The Esc layers (David, playtest round 1, decision 3; specs/playtest-round1.md "HUD and Esc, approved"). In the game
 * the mouse is the camera and the HUD is minimal. Esc 1 is the UI view: the world keeps running, the cursor is free and
 * the fuller UI shows (a bigger minimap, coins and level, the chat log, the gear, the menu dock). Esc 2 is the system
 * menu (Resume, Settings, Log out). Esc 3 is the game again. Chrome keeps the Esc that ends mouse-look for itself, so
 * the end of the lock opens the UI view (`pauseGame`, from useOrbitInput), and a keydown only when nothing held the
 * mouse. A sheet opened from a layer closes back to it: the layer stays put underneath.
 */

export type EscLayer = "ui" | "system" | null;

/** Esc from a layer: the game to the UI view, the UI view to the system menu, the system menu back to the game. */
export const nextLayer = (layer: EscLayer): EscLayer => (layer === null ? "ui" : layer === "ui" ? "system" : null);

// ── The pause signal ──────────────────────────────────────────────────
const pauseListeners = new Set<() => void>();
/** Mouse-look ended without the game asking (Esc, the window losing focus): the UI view opens. */
export function pauseGame() { pauseListeners.forEach(l => l()); }
export function subscribePause(listener: () => void) {
  pauseListeners.add(listener);
  return () => { pauseListeners.delete(listener); };
}
