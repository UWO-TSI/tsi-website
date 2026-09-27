/**
 * The one T1/T2 gate (rows 215, 221): every admin route starts here, before it
 * reads a body or touches the database. 401 signed out, 403 for T3-T5.
 * Its own module so route tests that mock memberContext or withStore still run this gate.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
