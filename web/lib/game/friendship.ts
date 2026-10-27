"use client";

/**
 * Your friendship with each resident on this screen (d-friends, lib/npc/friendship.ts): loaded once, raised when a
 * talk ends (POST /api/npc/friendship: the server decides whether today's first talk raised it). Signed out it stays
 * empty and nothing is sent back.
 */
import { useSyncExternalStore } from "react";
import { apiCall } from "@/lib/apiClient";

export interface FriendTalk { resident: string; name: string; level: number; leveled: boolean; coins: number; letter: boolean }
let levels: Record<string, number> = {};
let signedIn = true;
const listeners = new Set<() => void>();
const set = (next: Record<string, number>) => { levels = next; listeners.forEach(l => l()); };

export function loadFriends(): void {
  apiCall<Record<string, number>>("/api/npc/friendship", "friends").then(set, () => { signedIn = false; });
}
/** A talk with `slug` ended: the server's answer, or null (signed out, or not a resident it knows). */
export async function talkedTo(slug: string): Promise<FriendTalk | null> {
  if (!signedIn) return null;
  try {
    const f = await apiCall<FriendTalk>("/api/npc/friendship", "friend", { resident: slug });
    if (f.level !== levels[slug]) set({ ...levels, [slug]: f.level });
    return f;
  } catch { return null; }
}
export const useFriendLevel = (slug: string) =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => levels[slug] ?? 0, () => 0);
