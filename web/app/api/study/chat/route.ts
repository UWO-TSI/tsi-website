import { NextResponse } from "next/server";
import { z } from "zod";
import { postChat, readChat } from "@/lib/study/chat";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { mutedResponseBody, mutedUntil } from "@/lib/identity/mute";

// GET /api/study/chat: your table's chat (last two hours), seated members only.
export async function GET() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await readChat(ctx.store, ctx.userId, ctx.now), "messages");
}

// POST /api/study/chat { body }: 200 chars, profanity-filtered, rate-limited.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  const until = await mutedUntil(ctx.db, ctx.userId, ctx.now);
  if (until) return NextResponse.json(mutedResponseBody(until), { status: 403 });
  const parsed = z.object({ body: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await postChat(ctx.store, ctx.userId, parsed.data.body, ctx.now), "messages");
}
