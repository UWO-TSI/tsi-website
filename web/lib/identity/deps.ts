import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseIdentityStore } from "./supabaseStore";
import type { IdentityStore } from "./store";

export async function identityContext(): Promise<{ userId: string; tier: number; store: IdentityStore; now: Date } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, tier: ctx.tier, store: supabaseIdentityStore(ctx.db), now: ctx.now };
}
