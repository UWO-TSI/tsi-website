import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET /api/achievements — list all achievements with user's unlock status
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeSecret = searchParams.get("include_secret") === "true";

  // Get all achievements
  let query = supabase
    .from("achievements")
    .select("*")
    .order("created_at", { ascending: true });

  if (!includeSecret) {
    query = query.eq("is_secret", false);
  }

  const { data: achievements, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user's unlocked achievements
  const { data: unlocked } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .eq("user_id", user.id);

  const unlockedMap = new Map(
    (unlocked ?? []).map((u) => [u.achievement_id, u.unlocked_at])
  );

  const result = (achievements ?? []).map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id) ?? null,
  }));

  return NextResponse.json({ achievements: result });
}

// POST /api/achievements — create a new achievement (T1-T3 only)
const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  display_name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  icon: z.string().max(200).nullable().optional(),
  tc_reward: z.number().int().min(0).max(10000).optional().default(0),
  xp_reward: z.number().int().min(0).max(10000).optional().default(0),
  is_secret: z.boolean().optional().default(false),
  criteria_type: z.string().max(50).nullable().optional(),
  criteria_value: z.number().int().nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only T1-T3 can create achievements
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

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: achievement, error } = await supabase
    .from("achievements")
    .insert({
      name: parsed.data.name,
      display_name: parsed.data.display_name,
      description: parsed.data.description,
      icon: parsed.data.icon ?? null,
      tc_reward: parsed.data.tc_reward,
      xp_reward: parsed.data.xp_reward,
      is_secret: parsed.data.is_secret,
      criteria_type: parsed.data.criteria_type ?? null,
      criteria_value: parsed.data.criteria_value ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Achievement with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ achievement }, { status: 201 });
}
