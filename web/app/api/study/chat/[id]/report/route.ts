import { NextResponse } from "next/server";
import { z } from "zod";
import { reportChat } from "@/lib/study/chat";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/study/chat/:id/report { reason? }: flag for T1/T2; hidden for the reporter.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  return jsonResult(await reportChat(ctx.store, ctx.userId, id, typeof body.reason === "string" ? body.reason : "", ctx.now), "messages");
}
