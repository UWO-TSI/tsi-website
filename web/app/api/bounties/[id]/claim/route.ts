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

  // Verify bounty is OPEN
  const { data: bounty } = await supabase
    .from("bounties")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.status !== "open") {
    return NextResponse.json(
      { error: "Bounty is not open for claiming" },
      { status: 409 }
    );
  }

  // Check if already claimed by this user
  const { data: existingClaim } = await supabase
    .from("bounty_claims")
    .select("id")
    .eq("bounty_id", id)
    .eq("user_id", user.id)
    .single();

  if (existingClaim) {
    return NextResponse.json(
      { error: "You already claimed this bounty" },
      { status: 409 }
    );
  }

  // Create claim
  const { error: claimError } = await supabase.from("bounty_claims").insert({
    bounty_id: id,
    user_id: user.id,
    status: "active",
  });

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  // Update bounty status to claimed
  await supabase
    .from("bounties")
    .update({ status: "claimed", updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ success: true }, { status: 201 });
}
