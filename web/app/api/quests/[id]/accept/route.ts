import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify quest exists and is active
  const { data: quest } = await supabase
    .from("quests")
    .select("id, is_active")
    .eq("id", id)
    .single();

  if (!quest || !quest.is_active) {
    return NextResponse.json({ error: "Quest not found or inactive" }, { status: 404 });
  }

  // Check if already accepted
  const { data: existing } = await supabase
    .from("quest_progress")
    .select("id, status")
    .eq("quest_id", id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Quest already ${existing.status}` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("quest_progress")
    .insert({
      quest_id: id,
      user_id: user.id,
      status: "accepted",
      progress: 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ progress: data }, { status: 201 });
}
