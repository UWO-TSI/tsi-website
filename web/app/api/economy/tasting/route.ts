import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { serveFish, tastingView } from "@/lib/wallet/service";

const Body = z.object({ fish: z.string().regex(/^[a-z0-9_]{1,64}$/), way: z.enum(["cook", "aquarium"]), idempotency_key: IdemKey });

// GET /api/economy/tasting: your tasting book's filled slots and the club's aquarium (the species in HQ's tank).
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await tastingView(ctx.store, ctx.userId), "tasting");
}

// POST /api/economy/tasting: bring Bancha one of your fish, to cook (fee, buff, its stamp) or for the aquarium; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await serveFish(ctx.store, ctx.userId, parsed.data, new Date()), "serve");
}
