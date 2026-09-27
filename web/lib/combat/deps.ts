import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseCombatStore } from "./supabaseStore";
import type { CombatStore } from "./store";

export async function combatContext(): Promise<{ userId: string; store: CombatStore; now: Date } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, store: supabaseCombatStore(ctx.db), now: ctx.now };
}
