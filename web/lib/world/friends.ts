/**
 * Friends (specs/v1-drop.md §3, migration 20261013170000_world_friends): add someone by clicking them in the world or by
 * their friend code, requests and accepts, decline, cancel and unfriend. Members and public accounts alike; world names
 * only (row 222). The routes (/api/world/friends) reach the records through FriendStore (Supabase's service role in
 * production, memory in tests and the local two-client bench), and tell the realtime server when a friendship is made
 * or ended so both lists change at once.
 *
 * The rules live in the database's functions (world_friend_request / _accept / _remove); the memory store keeps the
 * same ones. A request to someone who already asked you is the accept. A block, either way, stops a request without
 * saying so.
 */
import { FRIENDS_MAX, NAME_FALLBACK } from "@/lib/net/protocol";
import { DomainError, toFailure, type Result } from "@/lib/result";
import { makeFriendCode, parseFriendCode } from "./friendCode";

/** The database's limits (world_friend_request): friends each, open requests out, new requests an hour. */
export const FRIEND_LIMITS = { max: FRIENDS_MAX, pending: 30, hourly: 20 } as const;

export type FriendErrorCode = "invalid" | "not_found" | "blocked" | "limit" | "unavailable" | "failed";
export class FriendError extends DomainError<FriendErrorCode> {}
export type RequestOutcome = "requested" | "friends" | "already_friends" | "already_requested";

export interface FriendRow { member_id: string; world_name: string | null; since: string }
export interface RequestRow { member_id: string; world_name: string | null; at: string }
export interface FriendStore {
  codeOf(member: string): Promise<string | null>;
  /** exists: the member already has one (another tab made it): read it again. taken: another member has this code. */
  insertCode(member: string, code: string): Promise<"ok" | "exists" | "taken">;
  memberByCode(code: string): Promise<string | null>;
  friends(member: string): Promise<FriendRow[]>;
  requests(member: string): Promise<{ incoming: RequestRow[]; outgoing: RequestRow[] }>;
  /** world_friend_request; throws FriendError (invalid, not_found, blocked, limit). */
  request(from: string, to: string): Promise<RequestOutcome>;
  /** world_friend_accept; throws FriendError (not_found: no request from them, blocked, limit). */
  accept(me: string, from: string): Promise<"friends" | "already_friends">;
  /** world_friend_remove: everything between the pair; whether they were friends. */
  remove(me: string, other: string): Promise<boolean>;
}

export interface FriendView { member_id: string; world_name: string; since: string }
export interface RequestView { member_id: string; world_name: string; at: string }
export interface FriendsView { code: string; friends: FriendView[]; incoming: RequestView[]; outgoing: RequestView[] }

const ERR: Record<string, [number, string]> = {
  invalid: [400, "That's you!"],
  not_found: [404, "Player not found."],
  blocked: [403, "You can't send them a request right now."],
  limit: [429, "That's a lot of friend requests for now. Try again later."],
  unavailable: [503, "Friends aren't available right now."],
  failed: [500, "Something went wrong. Try again."],
};
/** A block is never named to the other side: it reads as a plain "can't" (code `refused`). */
const fail = <T>(err: unknown): Result<T> => {
  const r = toFailure<T>(ERR, err);
  return !r.ok && r.code === "blocked" ? { ...r, code: "refused" } : r;
};
const refuse = <T>(status: number, code: string, error: string): Result<T> => ({ ok: false, status, code, error });
const named = <T extends { world_name: string | null }>(r: T) => ({ ...r, world_name: r.world_name ?? NAME_FALLBACK });

/** Your code (made on first look; a taken one is made again), your friends and your requests both ways. */
export async function friendsView(store: FriendStore, me: string, make: () => string = makeFriendCode): Promise<Result<FriendsView>> {
  try {
    let code = await store.codeOf(me);
    for (let i = 0; !code && i < 6; i++) {
      const fresh = make(), r = await store.insertCode(me, fresh);
      code = r === "ok" ? fresh : r === "exists" ? await store.codeOf(me) : null;
    }
    if (!code) throw new FriendError("failed", "no code");
    const [friends, requests] = await Promise.all([store.friends(me), store.requests(me)]);
    return {
      ok: true,
      data: {
        code,
        friends: friends.map(named).sort((a, b) => a.world_name.localeCompare(b.world_name) || a.member_id.localeCompare(b.member_id)),
        incoming: requests.incoming.map(named),
        outgoing: requests.outgoing.map(named),
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export interface AddInput { member_id?: string; code?: string }
/** Ask a player to be friends, by their id (a click in the world) or their code. Asking someone who asked you accepts. */
export async function addFriend(store: FriendStore, me: string, input: AddInput): Promise<Result<{ status: RequestOutcome; member_id: string; view: FriendsView }>> {
  try {
    let target = input.member_id ?? null;
    if (input.code !== undefined) {
      const code = parseFriendCode(input.code);
      if (!code) return refuse(400, "invalid", "A friend code is 8 letters and numbers, like ABCD-2345.");
      target = await store.memberByCode(code);
      if (!target) return refuse(404, "not_found", "No one has that code. Check it and try again.");
      if (target === me) return refuse(400, "invalid", "That's your own code.");
    }
    if (!target) return refuse(400, "invalid", "Who should we ask?");
    if (target === me) return refuse(400, "invalid", "That's you!");
    const status = await store.request(me, target);
    const view = await friendsView(store, me);
    return view.ok ? { ok: true, data: { status, member_id: target, view: view.data } } : view;
  } catch (err) {
    return fail(err);
  }
}

/** Say yes or no to a request from `from`. */
export async function respondFriend(store: FriendStore, me: string, from: string, accept: boolean): Promise<Result<{ status: "friends" | "already_friends" | "declined"; view: FriendsView }>> {
  try {
    let status: "friends" | "already_friends" | "declined" = "declined";
    if (accept) {
      try {
        status = await store.accept(me, from);
      } catch (err) {
        if (err instanceof FriendError && err.code === "not_found") return refuse(404, "not_found", "That request isn't there any more.");
        throw err;
      }
    } else await store.remove(me, from);
    const view = await friendsView(store, me);
    return view.ok ? { ok: true, data: { status, view: view.data } } : view;
  } catch (err) {
    return fail(err);
  }
}

/** Unfriend, or take back a request: everything between the two of you goes. `was`: you were friends. */
export async function removeFriend(store: FriendStore, me: string, other: string): Promise<Result<{ was: boolean; view: FriendsView }>> {
  try {
    if (other === me) return refuse(400, "invalid", "That's you!");
    const was = await store.remove(me, other);
    const view = await friendsView(store, me);
    return view.ok ? { ok: true, data: { was, view: view.data } } : view;
  } catch (err) {
    return fail(err);
  }
}
