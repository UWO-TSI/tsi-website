import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const positionId = searchParams.get("position_id");

  if (!positionId) {
    return NextResponse.json(
      { error: "Missing position_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("application_drafts")
    .select("*")
    .eq("user_id", user.id)
    .eq("position_id", positionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { position_id, form_data } = body;

  if (!position_id || !form_data) {
    return NextResponse.json(
      { error: "Missing position_id or form_data" },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (!positionId) {
    return NextResponse.json(
      { error: "Missing position_id" },
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
