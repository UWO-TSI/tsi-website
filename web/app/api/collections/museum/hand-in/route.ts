import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { handIn } from "@/lib/collections/service";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({
  species_key: z.string().regex(/^[a-z0-9_]{1,64}$/),
  idempotency_key: IdemKey,
});

// POST /api/collections/museum/hand-in: one of a species handed in to the museum's drive (m5), duplicates included.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await handIn(ctx.store, ctx.userId, parsed.data.species_key, parsed.data.idempotency_key), "hand_in");
}
