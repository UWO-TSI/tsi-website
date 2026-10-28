"use client";

/**
 * Your friendship with each resident on this screen, in half hearts (d-friends, lib/npc/friendship.ts): loaded once,
 * moved when a talk begins (the server decides whether it is today's first) or a gift is given (POST
 * /api/npc/friendship). Signed out it stays empty and nothing is sent.
 */
import { useSyncExternalStore } from "react";
import { apiCall } from "@/lib/apiClient";
import { loadBag } from "./bagStore";
import type { Taste } from "@/lib/npc/friendship";

export interface FriendMove { resident: string; name: string; was: number; level: number; coins: number; letter: boolean; taste: Taste | null }
let levels: Record<string, number> = {};
let signedIn = true;
const listeners = new Set<() => void>();
const set = (next: Record<string, number>) => { levels = next; listeners.forEach(l => l()); };
const moved = (f: FriendMove) => { if (f.level !== levels[f.resident]) set({ ...levels, [f.resident]: f.level }); return f; };

export function loadFriends(): void {
  apiCall<Record<string, number>>("/api/npc/friendship", "friends").then(set, () => { signedIn = false; });
}
/** A talk with `slug` began: the server's answer, or null (signed out, or not a resident it knows). */
export async function talkedTo(slug: string): Promise<FriendMove | null> {
  if (!signedIn) return null;
  try { return moved(await apiCall<FriendMove>("/api/npc/friendship", "friend", { resident: slug })); } catch { return null; }
}
/** Give `slug` one `item` from the bag; throws ApiError with the server's words (one a day, none left). */
export async function giveGift(slug: string, item: string): Promise<FriendMove> {
  const f = moved(await apiCall<FriendMove>("/api/npc/friendship", "friend", { resident: slug, gift: item }));
  void loadBag();
  return f;
}
export const useFriendLevel = (slug: string) =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => levels[slug] ?? 0, () => 0);
