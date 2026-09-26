import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseHomesStore } from "@/lib/homes-sync/supabaseStore";
import { saveHome } from "@/lib/homes-sync/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({
  layout: z.unknown(),
  base_revision: z.number().int().min(0),
  // One key per edit; resend the same key when retrying the same save.
  save_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/),
});

// PUT /api/homes/layout: save the whole document (validated, optimistic, idempotent).
export async function PUT(request: Request) {
  const ctx = await withStore(supabaseHomesStore);
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await saveHome(ctx.store, ctx.userId, parsed.data), "saved");
}
