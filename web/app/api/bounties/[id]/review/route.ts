import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const ReviewSchema = z.object({
  submission_id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "revision_requested"]),
  reviewer_notes: z.string().max(2000).nullable().optional(),
});

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

  // Only T1-T3 can review
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

  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;

  // Update the submission
  const { data: submission, error } = await supabase
    .from("bounty_submissions")
    .update({
      status: parsed.data.status,
      reviewer_notes: parsed.data.reviewer_notes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.submission_id)
    .eq("bounty_id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If approved, complete the bounty and award rewards
  if (parsed.data.status === "approved" && submission) {
    const { data: bounty } = await supabase
      .from("bounties")
      .select("pay_tc, xp_reward")
      .eq("id", id)
      .single();

    // Complete the bounty
    await supabase
      .from("bounties")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    // Complete the claim
    await supabase
      .from("bounty_claims")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("bounty_id", id)
      .eq("user_id", submission.user_id);

    // Award coins and XP
    if (bounty) {
      const { data: submitterProfile } = await supabase
        .from("profiles")
        .select("tethos_coins, xp")
        .eq("id", submission.user_id)
        .single();

      if (submitterProfile) {
        const newCoins = submitterProfile.tethos_coins + (bounty.pay_tc ?? 0);
        const newXp = submitterProfile.xp + (bounty.xp_reward ?? 0);

        await supabase
          .from("profiles")
          .update({ tethos_coins: newCoins, xp: newXp })
          .eq("id", submission.user_id);

        // Record transactions
        if (bounty.pay_tc && bounty.pay_tc > 0) {
          await supabase.from("tc_transactions").insert({
            user_id: submission.user_id,
            amount: bounty.pay_tc,
            balance_after: newCoins,
            type: "earn_bounty",
            reference_id: id,
            description: `Bounty completed: ${id}`,
          });
        }

        if (bounty.xp_reward && bounty.xp_reward > 0) {
          await supabase.from("xp_transactions").insert({
            user_id: submission.user_id,
            amount: bounty.xp_reward,
            type: "bounty",
            reference_id: id,
            description: `Bounty completed: ${id}`,
          });
        }
      }
    }
  }

  // If revision requested, move bounty back to in_progress
  if (parsed.data.status === "revision_requested") {
    await supabase
      .from("bounties")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({ submission });
}
