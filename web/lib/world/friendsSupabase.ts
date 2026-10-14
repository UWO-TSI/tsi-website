import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError, raisePg } from "@/lib/result";
import { FriendError, FRIEND_LIMITS, type FriendErrorCode, type FriendStore, type RequestOutcome } from "./friends";

type Row = Record<string, unknown>;
const CODES: FriendErrorCode[] = ["invalid", "not_found", "blocked", "limit"];
/** A PostgREST error as the friends' own (the function's RAISE text is the code). */
const raise = (error: { code?: string; message?: string } | null): never => {
  try {
    return raisePg(error, CODES);
  } catch (e) {
    if (e instanceof DomainError) throw new FriendError(e.code as FriendErrorCode, e.message);
    throw e;
  }
};

/** World names for these members (member_identity), null for none yet. */
async function namesOf(db: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const { data, error } = await db.from("member_identity").select("member_id, world_name").in("member_id", ids);
  if (error) raise(error);
  return new Map(((data ?? []) as Row[]).map(r => [String(r.member_id), (r.world_name as string) ?? null]));
}

/** The service-role store behind /api/world/friends (RLS lets members read their own rows; every write is a function). */
export function supabaseFriendStore(db: SupabaseClient): FriendStore {
  return {
    async codeOf(member) {
      const { data, error } = await db.from("world_friend_codes").select("code").eq("member_id", member).maybeSingle();
      if (error) raise(error);
      return data ? String((data as Row).code) : null;
    },
    async insertCode(member, code) {
      const { error } = await db.from("world_friend_codes").insert({ member_id: member, code });
      if (!error) return "ok";
      if (error.code !== "23505") return raise(error);
      // The member's own row (another tab got there first), or someone else's code.
      const { data, error: again } = await db.from("world_friend_codes").select("code").eq("member_id", member).maybeSingle();
      if (again) raise(again);
      return data ? "exists" : "taken";
    },
    async memberByCode(code) {
      const { data, error } = await db.from("world_friend_codes").select("member_id").eq("code", code).maybeSingle();
      if (error) raise(error);
      return data ? String((data as Row).member_id) : null;
    },
    async friends(member) {
      const { data, error } = await db.from("world_friends").select("a_id, b_id, created_at").or(`a_id.eq.${member},b_id.eq.${member}`).limit(FRIEND_LIMITS.max);
      if (error) raise(error);
      const rows = ((data ?? []) as Row[]).map(r => ({ other: String(r.a_id) === member ? String(r.b_id) : String(r.a_id), at: String(r.created_at) }));
      const names = await namesOf(db, rows.map(r => r.other));
      return rows.map(r => ({ member_id: r.other, world_name: names.get(r.other) ?? null, since: r.at }));
    },
    async requests(member) {
      const { data, error } = await db.from("world_friend_requests").select("from_id, to_id, created_at").or(`from_id.eq.${member},to_id.eq.${member}`)
        .order("created_at", { ascending: false }).limit(200);
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      const others = rows.map(r => (String(r.from_id) === member ? String(r.to_id) : String(r.from_id)));
      const names = await namesOf(db, [...new Set(others)]);
      const view = (r: Row, other: string) => ({ member_id: other, world_name: names.get(other) ?? null, at: String(r.created_at) });
      return {
        incoming: rows.filter(r => String(r.to_id) === member).map(r => view(r, String(r.from_id))),
        outgoing: rows.filter(r => String(r.from_id) === member).map(r => view(r, String(r.to_id))),
      };
    },
    async request(from, to) {
      const { data, error } = await db.rpc("world_friend_request", { p_from: from, p_to: to });
      if (error) raise(error);
      return data as RequestOutcome;
    },
    async accept(me, from) {
      const { data, error } = await db.rpc("world_friend_accept", { p_me: me, p_from: from });
      if (error) raise(error);
      return data as "friends" | "already_friends";
    },
    async remove(me, other) {
      const { data, error } = await db.rpc("world_friend_remove", { p_me: me, p_other: other });
      if (error) raise(error);
      return data === true;
    },
  };
}
