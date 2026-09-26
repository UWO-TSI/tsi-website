import type { SupabaseClient } from "@supabase/supabase-js";
import { CraftingError, type CraftingErrorCode, type CraftingStore } from "./service";

type Row = Record<string, unknown>;
const CODES: CraftingErrorCode[] = ["not_found", "not_learned", "insufficient_items", "already_owned", "key_reused", "nothing_left"];
function raise(error: { code?: string; message?: string } | null): never {
  const msg = error?.message ?? "";
  if (["42P01", "PGRST205", "PGRST202", "42703", "42883"].includes(error?.code ?? "") || /does not exist|schema cache/i.test(msg)) throw new CraftingError("unavailable", msg);
  throw new CraftingError(CODES.find(c => msg.includes(c)) ?? "failed", msg);
}
const first = (data: unknown) => ((Array.isArray(data) ? data[0] : data) ?? {}) as Row;

export function supabaseCraftingStore(db: SupabaseClient): CraftingStore {
  return {
    async learned(m) {
      const { data, error } = await db.from("member_recipes").select("recipe_id, source").eq("member_id", m);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(r => ({ recipe_id: String(r.recipe_id), source: String(r.source) }));
    },
    async materials(m) {
      const { data, error } = await db.from("member_collections").select("item_key, count").eq("user_id", m).gt("count", 0);
      if (error) raise(error);
      return Object.fromEntries(((data ?? []) as Row[]).map(r => [String(r.item_key), Number(r.count)]));
    },
    async owned(m) {
      const [items, weapons] = await Promise.all([
        db.from("member_inventory").select("shop_items(slug)").eq("member_id", m),
        db.from("member_weapons").select("weapon_key").eq("member_id", m),
      ]);
      if (items.error) raise(items.error);
      if (weapons.error) raise(weapons.error);
      return new Set([
        ...((items.data ?? []) as Row[]).map(r => String((r.shop_items as Row | null)?.slug)),
        ...((weapons.data ?? []) as Row[]).map(r => String(r.weapon_key)),
      ]);
    },
    async bottleOn(m, day) {
      const { data, error } = await db.from("member_recipes").select("recipe_id").eq("member_id", m).eq("bottle_day", day).maybeSingle();
      if (error) raise(error);
      return data ? String((data as Row).recipe_id) : null;
    },
    async craft(m, recipeId, key) {
      const { data, error } = await db.rpc("crafting_craft", { p_member_id: m, p_recipe_id: recipeId, p_idempotency_key: key });
      if (error) raise(error);
      const r = first(data);
      return { qty: Number(r.qty), replayed: r.replayed === true };
    },
    async learn(m, recipeId, source) {
      const { data, error } = await db.rpc("crafting_learn", { p_member_id: m, p_recipe_id: recipeId, p_source: source });
      if (error) raise(error);
      return { learned: first(data).learned === true };
    },
    async openBottle(m) {
      const { data, error } = await db.rpc("crafting_open_bottle", { p_member_id: m });
      if (error) raise(error);
      const r = first(data);
      return { recipe_id: String(r.recipe_id), replayed: r.replayed === true };
    },
  };
}
