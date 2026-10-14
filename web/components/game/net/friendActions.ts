"use client";

/**
 * What the friends UI does (specs/v1-drop.md §3): keep the friends list fresh (lib/net/friends.ts), ask, answer and
 * remove (/api/world/friends), join a friend's shard (the room's `follow`), wave, and the toasts that say how it went.
 * Shared by the player card, the friends sheet and the HUD. World names only.
 */
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "@/components/gui";
import { friendsStore, type FriendsSnapshot } from "@/lib/net/friends";
import { AREAS, type Area, type FollowRefusal } from "@/lib/net/protocol";
import { answerFriend, askFriend, dropFriend, friendsList } from "@/lib/world/api";
import { activeNet, remoteAt } from "./active";

/** Where a friend is, said plainly. */
export const WHERE: Readonly<Record<Area, string>> = {
  village: "In the village", cafe: "In the café", hq: "At HQ", museum: "In the museum", oracle: "At the Oracle", ruins: "In the ruins", home: "On their island", house: "On their island",
};
export const whereOf = (area: number) => WHERE[AREAS[area] ?? "village"];

/** Read the friends list again (after an action, on a timer, when the sheet opens). */
export async function refreshFriends(): Promise<boolean> {
  const r = await friendsList();
  if (r.ok) friendsStore().setView(r.friends);
  return r.ok;
}

export function useFriends(): FriendsSnapshot {
  const f = friendsStore();
  return useSyncExternalStore(f.subscribe, f.snapshot, f.snapshot);
}

/**
 * The friends list kept fresh while you're on the island (every minute, for new requests), and a toast when a friend
 * comes onto the island.
 */
export function useFriendsSync(on: boolean) {
  useEffect(() => {
    if (!on) return;
    void refreshFriends();
    const t = window.setInterval(() => void refreshFriends(), 60_000);
    const off = friendsStore().onArrive(uids => {
      const f = friendsStore();
      for (const uid of uids.slice(0, 3)) { const name = f.nameOf(uid); if (name) toast(`${name} is on the island`); }
    });
    return () => { window.clearInterval(t); off(); };
  }, [on]);
}

/** Ask someone (by id or code); says how it went. Returns whether it went through. */
export async function addFriend(who: { member_id: string } | { code: string }, name?: string): Promise<boolean> {
  const r = await askFriend(who);
  if (!r.ok) { toast(r.error); return false; }
  friendsStore().setView(r.friends);
  const them = name ?? friendsStore().nameOf(r.member_id) ?? "them";
  toast(r.status === "friends" || r.status === "already_friends" ? `You and ${them} are friends!` : `Friend request sent to ${them}.`);
  return true;
}

export async function answer(memberId: string, name: string, accept: boolean): Promise<void> {
  const r = await answerFriend(memberId, accept);
  if (!r.ok) { toast(r.error); return; }
  friendsStore().setView(r.friends);
  if (accept) toast(`You and ${name} are friends!`);
}

export async function unfriend(memberId: string, name: string, wasRequest = false): Promise<void> {
  const r = await dropFriend(memberId);
  if (!r.ok) { toast(r.error); return; }
  friendsStore().setView(r.friends);
  toast(wasRequest ? "Request taken back." : `You and ${name} aren't friends any more.`);
}

const FOLLOW_SAYS: Record<FollowRefusal, (name: string) => string> = {
  offline: n => `${n} isn't on the island right now.`,
  here: n => `You're already on the same island as ${n}.`,
  full: n => `${n}'s island is full right now. Try again in a bit.`,
  not_friend: n => `You need to be friends with ${n} to join them.`,
  busy: n => `Couldn't join ${n} just now. Try again.`,
};

/** Join a friend's shard (the room reserves you a seat there; even a full-ish one takes friends). */
export async function joinFriend(uid: string, name: string): Promise<void> {
  const net = activeNet();
  if (!net?.follow) { toast("Join works once you're with the others."); return; }
  toast(`Joining ${name}…`);
  const r = await net.follow(uid);
  toast(r.ok ? `You're with ${name} now.` : FOLLOW_SAYS[r.reason](name));
}

/** Wave at someone: turn to them (when they're in view) and wave, an emote everyone in view sees. */
export function waveAt(sid?: number) {
  const at = sid === undefined ? null : remoteAt(sid);
  window.dispatchEvent(new CustomEvent(at ? "tsi:act" : "tsi:emote", { detail: at ? { clip: "Wave", at } : { clip: "Wave" } }));
}
