/**
 * The world routes from the game (specs/multiplayer.md §6, specs/v1-drop.md §3): report, block and (v1) friends. Each
 * answers `{ ok: true, ... }` or `{ ok: false, error }` with the route's own kind words, so the card can say them.
 * Nothing throws: a dropped connection is a failure with a plain sentence.
 */
import type { FriendsView } from "./friends";

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

const OFFLINE = "Couldn't reach the island just now. Try again in a moment.";

/**
 * The local two-client bench (lib/world/devWorld.ts): with `?mp=dev&as=Name` outside production, the routes act for
 * that dev name (the server ignores the header wherever Supabase is set up).
 */
function devHeader(): Record<string, string> {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search), name = q.get("as");
  return q.get("mp") === "dev" && name && /^[A-Za-z0-9_-]{1,24}$/.test(name) ? { "x-dev-as": name } : {};
}

export async function worldCall<T extends object>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...devHeader(), ...init?.headers } });
    const body = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; code?: string } & T) | null;
    if (res.ok && body?.ok) return body as { ok: true } & T;
    const error = res.status === 401 ? "Sign in to do that." : body?.error ?? OFFLINE;
    return { ok: false, error, code: body?.code };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/** The reasons a report offers (the route takes up to 200 characters). */
export const REPORT_REASONS = ["Rude or mean", "Spam or flooding", "Something unsafe", "Something else"] as const;

export function reportWorld(body: { line_id?: string; member_id?: string; room_id?: string; reason: string }) {
  return worldCall<{ report: { id: string } }>("/api/world/report", { method: "POST", body: JSON.stringify(body) });
}
export function blockWorld(memberId: string) {
  return worldCall<{ blocks: unknown[] }>("/api/world/blocks", { method: "POST", body: JSON.stringify({ member_id: memberId }) });
}

// ── Friends (v1) ──────────────────────────────────────────────────
export type FriendStatus = "requested" | "friends" | "already_friends" | "already_requested" | "declined";
export const friendsList = () => worldCall<{ friends: FriendsView }>("/api/world/friends");
export const askFriend = (who: { member_id: string } | { code: string }) =>
  worldCall<{ status: FriendStatus; member_id: string; friends: FriendsView }>("/api/world/friends", { method: "POST", body: JSON.stringify(who) });
export const answerFriend = (memberId: string, accept: boolean) =>
  worldCall<{ status: FriendStatus; friends: FriendsView }>("/api/world/friends", { method: "PATCH", body: JSON.stringify({ member_id: memberId, accept }) });
export const dropFriend = (memberId: string) =>
  worldCall<{ was: boolean; friends: FriendsView }>(`/api/world/friends?member_id=${encodeURIComponent(memberId)}`, { method: "DELETE" });
export const blockList = () => worldCall<{ blocks: { member_id: string; world_name: string; created_at: string }[] }>("/api/world/blocks");
export const unblockWorld = (memberId: string) => worldCall<{ blocks: unknown[] }>(`/api/world/blocks?member_id=${encodeURIComponent(memberId)}`, { method: "DELETE" });
