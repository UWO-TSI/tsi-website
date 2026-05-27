import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — fetch a single draft by id. RLS restricts visibility (author or T1/T2 admin).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Draft not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, draft: data });
}
