import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardRewards } from "@/lib/supabase/helpers";
import { z } from "zod";

// Onboarding steps:
// 0 = not started
// 1 = welcome screen viewed
// 2 = profile basics filled (name, bio, program, year)
// 3 = avatar configured
// 4 = tutorial completed
// completed = onboarding_completed set to true

const FINAL_STEP = 4;

const StepSchema = z.object({
  step: z.number().int().min(1).max(FINAL_STEP),
  profile_data: z
    .object({
      display_name: z.string().min(1).max(50).optional(),
      bio: z.string().max(500).optional(),
      program: z.string().max(100).optional(),
      year: z.string().max(20).optional(),
      avatar_config: z
        .object({
          body: z.string().optional(),
          hair: z.string().optional(),
          face: z.string().optional(),
          outfit: z.string().optional(),
          accessory: z.string().optional(),
          hair_color: z.string().optional(),
          skin_color: z.string().optional(),
          outfit_color: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// GET — current onboarding status
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_step, display_name, avatar_config")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    completed: data.onboarding_completed,
    current_step: data.onboarding_step,
    total_steps: FINAL_STEP,
  });
}

// POST — advance to next step or complete onboarding
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
    .select("onboarding_completed, onboarding_step")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.onboarding_completed) {
    return NextResponse.json({ error: "Onboarding already completed" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Must advance sequentially (can't skip steps)
  if (parsed.data.step !== profile.onboarding_step + 1) {
    return NextResponse.json(
      {
        error: `Must complete step ${profile.onboarding_step + 1} next (got ${parsed.data.step})`,
      },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    onboarding_step: parsed.data.step,
    updated_at: new Date().toISOString(),
  };

  // Save profile data if provided (steps 2 and 3)
  if (parsed.data.profile_data) {
    const pd = parsed.data.profile_data;
    if (pd.display_name) updates.display_name = pd.display_name;
    if (pd.bio) updates.bio = pd.bio;
    if (pd.program) updates.program = pd.program;
    if (pd.year) updates.year = pd.year;
    if (pd.avatar_config) updates.avatar_config = pd.avatar_config;
  }

  // Final step — mark completed and award starter coins + XP
  if (parsed.data.step === FINAL_STEP) {
    updates.onboarding_completed = true;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Award onboarding bonus after profile update succeeds (auto-levels up)
  if (parsed.data.step === FINAL_STEP) {
    await awardRewards(supabase, user.id, {
      coins: 100,
      xp: 50,
      coinType: "earn_achievement",
      xpType: "achievement",
      description: "Onboarding completed — welcome bonus!",
    });
  }

  return NextResponse.json({
    step: parsed.data.step,
    completed: parsed.data.step === FINAL_STEP,
    total_steps: FINAL_STEP,
  });
}
