import { NextResponse } from "next/server";
import { z } from "zod";
import { progressionContext } from "@/lib/progression/deps";
import { MAX_DELIVERY_UNITS } from "@/lib/progression/goals";
import { badRequest, readJson, respond } from "@/lib/progression/http";
import { contribute } from "@/lib/progression/service";
import { DELIVERY_KINDS } from "@/lib/progression/types";

const Body = z.object({
  goal_slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  kind: z.enum(DELIVERY_KINDS),
  amount: z.number().int().min(1).max(MAX_DELIVERY_UNITS),
  item_key: z.string().regex(/^[a-z0-9_:-]{1,64}$/).nullable().optional(),
  // Client-generated per delivery attempt; resend the same key on retry.
  idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/),
});

// POST /api/progression/contribute: in-game delivery at the monument/HQ.
export async function POST(request: Request) {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return badRequest();
  const d = parsed.data;
  return respond(
    await contribute(ctx.store, ctx.userId, { goal_slug: d.goal_slug, kind: d.kind, amount: d.amount, item_key: d.item_key ?? null, idempotency_key: `delivery:${d.idempotency_key}` }, ctx.now),
    "contribution",
  );
}
