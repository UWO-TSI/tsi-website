import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { sendNote, storeFailure } from "@/lib/progression/service";
import { mutedResponseBody, mutedUntil } from "@/lib/identity/mute";

const Send = z.object({
  to: z.string().uuid(),
  subject: z.string().optional(),
  body: z.string(),
});

// GET /api/progression/letters: the caller's mailbox (received + sent).
export async function GET() {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, letters: await ctx.store.listLetters(ctx.userId, 50) });
  } catch (err) {
    return jsonResult(storeFailure(err), "");
  }
}

// POST /api/progression/letters: send a note (text only, length- and rate-limited).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Send.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const until = await mutedUntil(ctx.db, ctx.userId, ctx.now).catch(() => null);
  if (until) return NextResponse.json(mutedResponseBody(until), { status: 403 });
  return jsonResult(await sendNote(ctx.store, ctx.userId, parsed.data, ctx.now), "letter");
}
