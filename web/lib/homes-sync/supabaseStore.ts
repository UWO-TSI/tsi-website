import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleLayout } from "./rules";
import { HomeStoreError, type HomesStore } from "./store";

function raise(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";
  if (["42P01", "PGRST205", "PGRST202", "42703", "42883"].includes(code) || /does not exist|schema cache/i.test(msg)) throw new HomeStoreError("unavailable", msg);
  for (const c of ["revision_conflict", "room_cap", "insufficient", "room_count_mismatch"] as const) if (msg.includes(c)) throw new HomeStoreError(c);
  throw new HomeStoreError("failed", msg);
}

type Row = Record<string, unknown>;

export function supabaseHomesStore(db: SupabaseClient): HomesStore {
  return {
    async getHome(memberId) {
      const [home, rooms] = await Promise.all([
        db.from("member_homes").select("rooms_count, outdoor, revision").eq("member_id", memberId).maybeSingle(),
        db.from("member_home_rooms").select("room_index, room_id, wallpaper, flooring, items").eq("member_id", memberId),
      ]);
      if (home.error) raise(home.error);
      if (rooms.error) raise(rooms.error);
      const h = (home.data ?? {}) as Row;
      const count = typeof h.rooms_count === "number" ? h.rooms_count : 1;
      return {
        rooms_count: count,
        layout: assembleLayout(count, (rooms.data ?? []) as never, h.outdoor ?? []),
        revision: typeof h.revision === "number" ? h.revision : 0,
      };
    },
    async saveLayout(memberId, base, key, doc) {
      const { data, error } = await db.rpc("home_save_layout", { p_member_id: memberId, p_base_revision: base, p_save_key: key, p_rooms: doc.rooms, p_outdoor: doc.outdoor });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { revision: Number(r.revision), replayed: r.replayed === true };
    },
    async buyRoom(memberId, price, max, key, room) {
      const { data, error } = await db.rpc("home_buy_room", { p_member_id: memberId, p_price: price, p_max_rooms: max, p_idempotency_key: key, p_room_id: room.id, p_wallpaper: room.wallpaper, p_flooring: room.flooring });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { rooms_count: Number(r.rooms_count), coins: Number(r.coins), replayed: r.replayed === true };
    },
  };
}
