import { NextResponse } from "next/server";
import { z } from "zod";
import { activeWaters } from "@/lib/collections/rolls";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { claimFishingTask, fishingTasksView } from "@/lib/wallet/service";

const Body = z.object({ task: z.string().regex(/^(catch:[a-z0-9_]{1,64}|variety:\d{1,2})$/), period: z.enum(["day", "week"]), idempotency_key: IdemKey });

// GET /api/economy/tasks: today's and this week's fishing tasks, how far you are on each, and what you claimed.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await fishingTasksView(ctx.store, ctx.userId, new Date(), activeWaters()), "tasks");
}

// POST /api/economy/tasks: claim a done task's coins (the server checks your catches); retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await claimFishingTask(ctx.store, ctx.userId, parsed.data, new Date(), activeWaters()), "claim");
}
