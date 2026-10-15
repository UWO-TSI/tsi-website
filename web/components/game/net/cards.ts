/**
 * Which player card is open (PlayerCard.tsx): opened from a chat line's name, the people list or (v1 friends) a click
 * on someone in the world. One at a time; an external store, so the 3D click handler and the HUD share it without
 * props.
 */
import { useSyncExternalStore } from "react";
import { setDetailFocus } from "@/lib/game/character/detailFocus";

export interface CardTarget {
  uid: string;
  /** Their world name as last seen. */
  name: string;
  /** Their Player.sid in your view, when they're in it (their level, and a wave toward them). */
  sid?: number;
  /** The chat line it was opened from: Report names that line. */
  lineId?: string;
  member?: boolean;
}

let current: CardTarget | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

/** Open a card; its player draws at Full while it's open (lib/game/character/detailFocus.ts). */
export function openCard(t: CardTarget) { current = t; setDetailFocus(t.uid); emit(); }
export function closeCard() { if (current) { current = null; setDetailFocus(null); emit(); } }
export const readCard = () => current;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useCard(): CardTarget | null {
  return useSyncExternalStore(subscribe, readCard, () => null);
}
