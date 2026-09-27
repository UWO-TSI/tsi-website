import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseEconomyStore } from "./supabaseStore";
import type { EconomyStore } from "./store";

export async function economyContext(): Promise<{ userId: string; tier: number; store: EconomyStore; now: Date } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, tier: ctx.tier, store: supabaseEconomyStore(ctx.db), now: ctx.now };
}
