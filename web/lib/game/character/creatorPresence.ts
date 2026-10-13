/**
 * Whether the character creator (or the wardrobe, its closet mode) covers the screen. It is opaque and full screen,
 * so the island under it stops rendering while it's open (DefaultIslandWorld's frameloop) and its canvas gets the GPU.
 */
import { useSyncExternalStore } from "react";

let holds = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

/** Mark the creator open; the returned function lets go (several holds may overlap). */
export function holdCreatorOpen(): () => void {
  holds++;
  emit();
  let held = true;
  return () => { if (!held) return; held = false; holds--; emit(); };
}
export const creatorOpen = () => holds > 0;
export function useCreatorOpen(): boolean {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, creatorOpen, () => false);
}
