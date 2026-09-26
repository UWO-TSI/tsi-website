import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseHomesStore } from "@/lib/homes-sync/supabaseStore";
import { saveHome } from "@/lib/homes-sync/service";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { ownedRefs } from "@/lib/wallet/service";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({
  layout: z.unknown(),
  base_revision: z.number().int().min(0),
  // One key per edit; resend the same key when retrying the same save.
  save_key: IdemKey,
});

// PUT /api/homes/layout: save the whole document (validated, owned pieces only, optimistic, idempotent).
export async function PUT(request: Request) {
  const ctx = await withStore((db) => ({ homes: supabaseHomesStore(db), economy: supabaseEconomyStore(db) }));
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const owned = await ownedRefs(ctx.store.economy, ctx.userId);
  if (!owned.ok) return jsonResult(owned, "saved");
  return jsonResult(await saveHome(ctx.store.homes, ctx.userId, parsed.data, owned.data), "saved");
}
