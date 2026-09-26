/**
 * Local home layout store (same pattern as graphicsSettingsStore): one live
 * snapshot for the world and the decorate UI, persisted to localStorage.
 * The systems agent swaps `storage` for Supabase-backed persistence later;
 * the document shape (layout.ts) stays the contract.
 */
import { defaultLayout, parseLayout, serialiseLayout, type HomeLayoutDoc } from "./layout";

export const HOME_LAYOUT_KEY = "tsi.home.layout.v1";
type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createHomeStore(storage: () => LayoutStorage | null) {
  let snapshot: HomeLayoutDoc | null = null;
  const listeners = new Set<() => void>();
  const read = () => {
    try { const raw = storage()?.getItem(HOME_LAYOUT_KEY); return raw ? parseLayout(JSON.parse(raw)) : defaultLayout(); }
    catch { return defaultLayout(); }
  };
  const publish = (next: HomeLayoutDoc) => { snapshot = next; listeners.forEach(l => l()); };
  return {
    getSnapshot(): HomeLayoutDoc { return snapshot ??= read(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: HomeLayoutDoc) {
      try { storage()?.setItem(HOME_LAYOUT_KEY, serialiseLayout(next)); } catch { /* Keep this session's layout. */ }
      publish(next);
    },
    reset() {
      try { storage()?.removeItem(HOME_LAYOUT_KEY); } catch { /* Nothing saved. */ }
      publish(defaultLayout());
    },
  };
}
