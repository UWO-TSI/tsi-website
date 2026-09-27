import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseStudyStore } from "./supabaseStore";
import type { StudyStore } from "./store";

export async function studyContext(): Promise<{ userId: string; store: StudyStore; now: Date } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, store: supabaseStudyStore(ctx.db), now: ctx.now };
}
