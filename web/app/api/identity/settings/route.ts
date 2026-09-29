import { NextResponse } from "next/server";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { updateSettings } from "@/lib/identity/service";

// GET /api/identity/settings: text size, high contrast, menu key bindings.
export async function GET() {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, settings: await ctx.store.settings(ctx.userId) });
  } catch {
    return NextResponse.json({ ok: false, error: "Settings unavailable" }, { status: 503 });
  }
}

// POST /api/identity/settings { text_size?, high_contrast?, key_bindings? }: partial update, validated.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await updateSettings(ctx.store, ctx.userId, body), "settings");
}
