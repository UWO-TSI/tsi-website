import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";

// GET — fetch a single draft by id (T1/T2).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const { data, error } = await ctx.db.from("content_drafts").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Draft not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, draft: data });
}
