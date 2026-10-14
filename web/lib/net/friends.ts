/**
 * Your friends on the client (specs/v1-drop.md §3): who they are (the friends list from /api/world/friends) and who is
 * on the island now, with their shard and area (the room's `friends` message, PROTOCOL 2). The HUD, the player card,
 * the name tags and the minimap read it; the net store feeds the presence, the friends sheet the list. `setOnline`
 * returns who just came onto the island (the online toast), never everyone at a join: a connection's first list is
 * quiet.
 */
import type { FriendPresence } from "./protocol";
import type { FriendsView } from "@/lib/world/friends";

export interface FriendsSnapshot {
  view: FriendsView | null;
  /** Friends on the island now. */
  online: readonly FriendPresence[];
  /** Requests waiting for your answer. */
  asking: number;
}

export class FriendsStore {
  private view: FriendsView | null = null;
  private ids = new Set<string>();
  private names = new Map<string, string>();
  private here = new Map<string, FriendPresence>();
  private first = true;
  private snap: FriendsSnapshot = { view: null, online: [], asking: 0 };
  private listeners = new Set<() => void>();
  private arrivals = new Set<(uids: string[]) => void>();

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  snapshot = () => this.snap;
  /** Someone came onto the island (the toast). */
  onArrive(l: (uids: string[]) => void) { this.arrivals.add(l); return () => { this.arrivals.delete(l); }; }
  private changed() {
    this.snap = { view: this.view, online: [...this.here.values()], asking: this.view?.incoming.length ?? 0 };
    for (const l of this.listeners) l();
  }

  setView(v: FriendsView) {
    this.view = v;
    this.ids = new Set(v.friends.map(f => f.member_id));
    for (const f of v.friends) this.names.set(f.member_id, f.world_name);
    for (const r of [...v.incoming, ...v.outgoing]) this.names.set(r.member_id, r.world_name);
    this.changed();
  }
  isFriend = (uid: string) => this.ids.has(uid);
  nameOf = (uid: string) => this.names.get(uid) ?? null;
  presence = (uid: string) => this.here.get(uid);
  get code() { return this.view?.code ?? null; }

  /** A new connection to the room (a join, a rejoin, a move): its first presence list won't toast. */
  connected() { this.first = true; }
  /** The room's `friends` list. Returns who came that wasn't here before (none on a connection's first list). */
  setOnline(list: readonly FriendPresence[]): string[] {
    const before = this.here, quiet = this.first;
    this.first = false;
    let same = before.size === list.length;
    const next = new Map<string, FriendPresence>(), came: string[] = [];
    for (const f of list) {
      next.set(f.uid, f);
      const was = before.get(f.uid);
      if (!was) { if (!quiet) came.push(f.uid); same = false; }
      else if (was.shard !== f.shard || was.area !== f.area) same = false;
    }
    if (same) return [];
    this.here = next;
    this.changed();
    if (came.length) for (const l of this.arrivals) l(came);
    return came;
  }
  /** Off the island (left, kicked): nobody's presence is known. */
  offline() { if (this.here.size) { this.here = new Map(); this.changed(); } }
}

/** The page's one friends store (on globalThis, as the net and chat stores are). */
export function friendsStore(): FriendsStore {
  const g = globalThis as unknown as { __tsiFriends?: FriendsStore };
  return (g.__tsiFriends ??= new FriendsStore());
}
