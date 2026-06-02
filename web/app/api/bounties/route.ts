import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  client_name: z.string().min(1).max(100),
  pay_cad: z.number().min(0).nullable().optional(),
  pay_tc: z.number().int().min(0).nullable().optional(),
  xp_reward: z.number().int().min(0).optional().default(0),
  difficulty: z.number().int().min(1).max(5).optional().default(1),
  deadline: z.string().nullable().optional(),
  tech_stack: z.array(z.string().max(50)).max(20).optional().default([]),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const difficulty = searchParams.get("difficulty");

  let query = supabase
    .from("bounties")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.neq("status", "pending");
  }

  if (difficulty) {
    query = query.eq("difficulty", parseInt(difficulty, 10));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Surface the caller's active claims so the UI can show "Submit
  // deliverables" vs "Already claimed" without an extra round-trip.
  const { data: claims } = await supabase
    .from("bounty_claims")
    .select("bounty_id, status")
    .eq("user_id", user.id);

  const myClaimedBountyIds = (claims ?? [])
    .filter((c) => c.status === "active")
    .map((c) => c.bounty_id as string);

  return NextResponse.json({ bounties: data, myClaimedBountyIds });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateBountySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Get caller's tier to determine if bounty is auto-approved
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const isAdmin = profile && profile.tier <= 3;

  const { data, error } = await supabase
    .from("bounties")
    .insert({
      ...parsed.data,
      status: isAdmin ? "open" : "pending",
      submitted_by: user.id,
      approved_by: isAdmin ? user.id : null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bounty: data }, { status: 201 });
}
