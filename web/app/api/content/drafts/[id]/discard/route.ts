import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

  const { id: draftId } = await params;
  const admin = createAdminClient();

  const { data: draft, error: draftError } = await admin
    .from("content_drafts")
    .select("id, author, status")
    .eq("id", draftId)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.tier === 1 || profile?.tier === 2;
  const isAuthor = draft.author === user.id;
  if (!isAuthor && !isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — author or T1/T2 only" },
      { status: 403 },
    );
  }

  if (draft.status !== "draft") {
    return NextResponse.json(
      { ok: false, error: `Draft is ${draft.status}, cannot discard` },
      { status: 409 },
    );
  }

  const { error: updateError } = await admin
    .from("content_drafts")
    .update({ status: "discarded" })
    .eq("id", draftId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
