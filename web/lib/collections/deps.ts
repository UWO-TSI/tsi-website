import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseCollectionsStore } from "./supabaseStore";
import type { CollectionsStore } from "./store";
import { torontoParts } from "@/lib/time";

export async function collectionsContext(): Promise<{ userId: string; store: CollectionsStore; now: Date } | NextResponse> {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return { userId: ctx.userId, store: supabaseCollectionsStore(ctx.db), now: ctx.now };
}

/** Island clock for availability: Toronto hour/month unless the client passes its own. */
export function momentFrom(url: URL, now: Date) {
  const t = torontoParts(now);
  const hourParam = Number(url.searchParams.get("hour"));
  const hour = url.searchParams.has("hour") && hourParam >= 0 && hourParam < 24 ? hourParam : t.hour;
  const month = t.month;
  const w = url.searchParams.get("weather");
  const weather = w === "rain" || w === "snow" || w === "cloudy" ? w : "clear";
  return { hour, month, weather } as const;
}
