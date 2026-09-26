import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseHomesStore } from "./supabaseStore";
import type { HomesStore } from "./store";

export async function homesContext(): Promise<{ userId: string; store: HomesStore } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, store: supabaseHomesStore(ctx.db) };
}
