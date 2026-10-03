/** Your portfolio's read (portfolios / portfolio_items, 001_initial_schema: items are ordered by `position`). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { must } from "./load";

/** Your name, your portfolio (null before you make one) and its items in order; null signed out. */
export async function loadPortfolio(db: SupabaseClient) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const profile = must(await db.from("profiles").select("display_name").eq("id", user.id).maybeSingle());
  const portfolio = must(await db.from("portfolios").select("*").eq("user_id", user.id).maybeSingle());
  const items = portfolio ? must(await db.from("portfolio_items").select("*").eq("portfolio_id", portfolio.id).order("position", { ascending: true })) ?? [] : [];
  return { userId: user.id, displayName: (profile?.display_name as string | undefined) ?? "", portfolio, items };
}
