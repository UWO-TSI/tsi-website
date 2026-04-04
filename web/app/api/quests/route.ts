import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET — list available quests + user's progress
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // daily, weekly, seasonal
  const status = searchParams.get("status"); // available, in_progress, completed

  // Get all active quests
  let questQuery = supabase
    .from("quests")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (type) {
    questQuery = questQuery.eq("quest_type", type);
  }

  const { data: quests, error: questError } = await questQuery;

  if (questError) {
    return NextResponse.json({ error: questError.message }, { status: 500 });
  }

  // Get user's quest progress
  const { data: progress } = await supabase
    .from("quest_progress")
    .select("*")
    .eq("user_id", user.id);

  const progressMap = new Map(
    (progress ?? []).map((p) => [p.quest_id, p])
  );

  // Combine quests with progress
  const combined = (quests ?? []).map((quest) => {
    const userProgress = progressMap.get(quest.id);
    return {
      ...quest,
      user_status: userProgress?.status ?? "available",
      user_progress: userProgress?.progress ?? 0,
      accepted_at: userProgress?.accepted_at ?? null,
      completed_at: userProgress?.completed_at ?? null,
    };
  });

  // Filter by status if requested
  let filtered = combined;
  if (status === "available") {
    filtered = combined.filter((q) => q.user_status === "available");
  } else if (status === "in_progress") {
    filtered = combined.filter(
      (q) => q.user_status === "accepted" || q.user_status === "in_progress"
    );
  } else if (status === "completed") {
    filtered = combined.filter((q) => q.user_status === "completed");
  }

  return NextResponse.json({ quests: filtered });
}

// POST — create quest (T1-T3 only)
const CreateQuestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  quest_type: z.enum(["daily", "weekly", "seasonal"]),
  xp_reward: z.number().int().min(0).default(0),
  tc_reward: z.number().int().min(0).default(0),
  criteria: z.string().max(500).nullable().optional(),
  max_completions: z.number().int().min(1).default(1),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_recurring: z.boolean().default(false),
});

export async function POST(request: Request) {
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

  if (!profile || profile.tier > 3) {
    return NextResponse.json({ error: "Forbidden — T1-T3 only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateQuestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("quests")
    .insert({
      ...parsed.data,
      created_by: user.id,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ quest: data }, { status: 201 });
}
