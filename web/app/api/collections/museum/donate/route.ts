import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { donate } from "@/lib/collections/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({
  species_key: z.string().regex(/^[a-z0-9_]{1,64}$/),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/),
});

// POST /api/collections/museum/donate: first of a species goes on display with your name; duplicates refused.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await donate(ctx.store, ctx.userId, parsed.data.species_key, parsed.data.idempotency_key), "donation");
}
