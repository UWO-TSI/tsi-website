/**
 * Which people sheet is open: Friends or who's on the island (the Esc Menu's Friends and mail, playtest round 1). An
 * external store, so the Menu opens what NetHud draws without props.
 */
import { useSyncExternalStore } from "react";

export type NetSheet = "friends" | "people" | null;
let open: NetSheet = null;
const listeners = new Set<() => void>();
export function setNetSheet(next: NetSheet) {
  if (open === next) return;
  open = next;
  listeners.forEach(l => l());
}
export const readNetSheet = () => open;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useNetSheet = () => useSyncExternalStore(subscribe, readNetSheet, () => null);
