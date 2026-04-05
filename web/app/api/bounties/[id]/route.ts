import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateBountySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z
    .enum(["pending", "open", "claimed", "in_progress", "review", "completed", "expired"])
    .optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  pay_cad: z.number().min(0).nullable().optional(),
  pay_tc: z.number().int().min(0).nullable().optional(),
  xp_reward: z.number().int().min(0).optional(),
  deadline: z.string().nullable().optional(),
  tech_stack: z.array(z.string().max(50)).max(20).optional(),
});

export async function GET(
  _request: NextRequest,
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

  const { data, error } = await supabase
    .from("bounties")
    .select("*, bounty_claims(*), bounty_deliverables(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json({ bounty: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only T1-T3 can update bounties
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tier > 3) {
    return NextResponse.json({ error: "Forbidden — T1-T3 only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateBountySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("bounties")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
      ...(parsed.data.status === "open" ? { approved_by: user.id } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bounty: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tier > 2) {
    return NextResponse.json({ error: "Forbidden — T1-T2 only" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabase.from("bounties").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
