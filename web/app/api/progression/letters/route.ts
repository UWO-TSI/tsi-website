import { NextResponse } from "next/server";
import { z } from "zod";
import { progressionContext } from "@/lib/progression/deps";
import { badRequest, readJson, respond } from "@/lib/progression/http";
import { sendNote, storeFailure } from "@/lib/progression/service";
import { mutedResponseBody, mutedUntil } from "@/lib/identity/mute";
import { createAdminClient } from "@/lib/supabase/admin";

const Send = z.object({
  to: z.string().uuid(),
  subject: z.string().optional(),
  body: z.string(),
});

// GET /api/progression/letters: the caller's mailbox (received + sent).
export async function GET() {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, letters: await ctx.store.listLetters(ctx.userId, 50) });
  } catch (err) {
    const f = storeFailure(err);
    return NextResponse.json({ ok: false, error: f.error, code: f.code }, { status: f.status });
  }
}

// POST /api/progression/letters: send a note (text only, length- and rate-limited).
export async function POST(request: Request) {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Send.safeParse(json.body);
  if (!parsed.success) return badRequest();
  const until = await mutedUntil(createAdminClient(), ctx.userId, ctx.now).catch(() => null);
  if (until) return NextResponse.json(mutedResponseBody(until), { status: 403 });
  return respond(await sendNote(ctx.store, ctx.userId, parsed.data, ctx.now), "letter");
}
