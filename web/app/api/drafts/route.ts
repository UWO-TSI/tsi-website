import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const positionIdSchema = z.string().uuid();
const draftInput = z.object({ position_id: positionIdSchema, form_data: z.record(z.string(), z.unknown()) });
const noStore = { "Cache-Control": "no-store" };
const findSubmission = (supabase: Awaited<ReturnType<typeof createClient>>, userId: string, positionId: string) =>
  supabase.from("applications").select("id,position_id,submitted_at")
    .eq("user_id", userId).eq("position_id", positionId).maybeSingle();

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  const { searchParams } = new URL(request.url);
  const positionId = searchParams.get("position_id");

  if (!positionIdSchema.safeParse(positionId).success) {
    return NextResponse.json(
      { error: "Invalid position_id" },
      { status: 400, headers: noStore }
    );
  }

  const { data, error } = await supabase
    .from("application_drafts")
    .select("*")
    .eq("user_id", user.id)
    .eq("position_id", positionId)
    .maybeSingle();

  // A late in-flight autosave may leave a draft after submission. Never restore
  // it over a confirmed application, even when cleanup previously failed.
  const submitted = await findSubmission(supabase, user.id, positionId!);
  if (submitted.error) {
    return NextResponse.json({ error: "Could not check your application. Please try again." }, { status: 503, headers: noStore });
  }
  if (submitted.data) return NextResponse.json({ submitted_application: submitted.data }, { headers: noStore });
  if (error) return NextResponse.json({ error: "Could not load your draft. Please try again." }, { status: 503, headers: noStore });

  return NextResponse.json(data, { headers: noStore });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = draftInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid position_id or form_data" },
      { status: 400 }
    );
  }
  const { position_id, form_data } = parsed.data;
  const submitted = await findSubmission(supabase, user.id, position_id);
  if (submitted.error) return NextResponse.json({ error: "Could not check your application. Please retry saving." }, { status: 503 });
  if (submitted.data) return NextResponse.json({ code: "ALREADY_SUBMITTED", submitted_application: submitted.data }, { status: 409 });

  const { data, error } = await supabase
    .from("application_drafts")
    .upsert(
      {
        user_id: user.id,
        position_id,
        form_data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,position_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not save your draft. Please try again." }, { status: 503 });
  }

  // Best-effort cleanup covers submission during this upsert. This is not an
  // atomic database fence; GET independently hides any remaining stale draft.
  const afterSave = await findSubmission(supabase, user.id, position_id);
  if (afterSave.error) return NextResponse.json({ error: "Could not confirm your draft state. Please retry saving." }, { status: 503 });
  if (afterSave.data) {
    const cleanup = await supabase.from("application_drafts").delete().eq("user_id", user.id).eq("position_id", position_id);
    if (cleanup.error) console.error("Late draft cleanup failed:", cleanup.error.code);
    return NextResponse.json({ code: "ALREADY_SUBMITTED", submitted_application: afterSave.data }, { status: 409 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const positionId = searchParams.get("position_id");

  if (!positionIdSchema.safeParse(positionId).success) {
    return NextResponse.json(
      { error: "Invalid position_id" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("application_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("position_id", positionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
