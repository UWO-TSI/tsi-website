import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";

// POST — discard a draft (T1/T2; only they can draft since row 215).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id: draftId } = await params;
  const { data: draft, error: draftError } = await ctx.db
    .from("content_drafts")
    .select("id, status")
    .eq("id", draftId)
    .maybeSingle();

  if (draftError || !draft) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }

  if (draft.status !== "draft") {
    return NextResponse.json(
      { ok: false, error: `Draft is ${draft.status}, cannot discard` },
      { status: 409 },
    );
  }

  const { error: updateError } = await ctx.db
    .from("content_drafts")
    .update({ status: "discarded" })
    .eq("id", draftId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
