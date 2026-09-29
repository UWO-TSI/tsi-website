import { NextResponse } from "next/server";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { me } from "@/lib/identity/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/identity/me: world name, member badge, family, auras, settings.
export async function GET() {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await me(ctx.store, ctx.userId), "identity");
}
