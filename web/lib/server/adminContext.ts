/**
 * The one T1/T2 gate (rows 215, 221): every admin route starts here, before it
 * reads a body or touches the database. 401 signed out, 403 for T3-T5.
 * Its own module so route tests that mock memberContext or withStore still run this gate.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { forbidden, isAdminTier, memberContext, withStore, type MemberContext } from "./memberContext";

export async function adminContext(): Promise<MemberContext | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return isAdminTier(ctx.tier) ? ctx : forbidden();
}

/** withStore behind the same gate (building a store runs no query). */
export async function withAdminStore<S>(make: (db: SupabaseClient) => S): Promise<(MemberContext & { store: S }) | NextResponse> {
  const ctx = await withStore(make);
  if (ctx instanceof NextResponse) return ctx;
  return isAdminTier(ctx.tier) ? ctx : forbidden();
}

/** The staff gate (T1-T3: events, bounties, quests, achievements) on the caller's own RLS client, which the route keeps for its writes. */
export async function staffContext(): Promise<{ supabase: SupabaseClient; user: User } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
  if (!profile || profile.tier > 3) return NextResponse.json({ error: "Forbidden — T1-T3 only" }, { status: 403 });
  return { supabase, user };
}
