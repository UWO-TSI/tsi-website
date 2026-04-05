import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { ClassName } from "@/lib/supabase/types";

// Answer schema: 12 answers, each has question_id and selected pole
const AnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.number().int().min(1).max(12),
        pole: z.string().min(1).max(1),
      })
    )
    .length(12),
});

// MBTI type → RPG class mapping
// 9 classes from types.ts: ARCHITECT, ORACLE, STRATEGIST, COMMANDER, WARDEN, ENGINEER, OPERATIVE, INITIATE, SCOUT
const MBTI_CLASS_MAP: Record<string, ClassName> = {
  // NT types → strategic/technical classes
  INTJ: "ARCHITECT",   // Visionary planner
  INTP: "ORACLE",      // Deep analytical thinker
  ENTJ: "COMMANDER",   // Decisive leader
  ENTP: "STRATEGIST",  // Inventive debater

  // NF types → people/mission-oriented classes
  INFJ: "ORACLE",      // Insightful advisor
  INFP: "SCOUT",       // Idealistic explorer
  ENFJ: "COMMANDER",   // Inspiring mentor
  ENFP: "SCOUT",       // Enthusiastic campaigner

  // SJ types → structured/reliable classes
  ISTJ: "WARDEN",      // Reliable guardian
  ISFJ: "WARDEN",      // Protective defender
  ESTJ: "OPERATIVE",   // Efficient executor
  ESFJ: "OPERATIVE",   // Community organizer

  // SP types → action/hands-on classes
  ISTP: "ENGINEER",    // Practical craftsman
  ISFP: "INITIATE",    // Artistic adventurer
  ESTP: "ENGINEER",    // Bold problem-solver
  ESFP: "INITIATE",    // Energetic performer
};

// Subclass is a flavor name for each MBTI within their class
const MBTI_SUBCLASS_MAP: Record<string, string> = {
  INTJ: "Mastermind",
  INTP: "Sage",
  ENTJ: "Warlord",
  ENTP: "Trickster",
  INFJ: "Mystic",
  INFP: "Dreamwalker",
  ENFJ: "Herald",
  ENFP: "Wanderer",
  ISTJ: "Sentinel",
  ISFJ: "Guardian",
  ESTJ: "Marshal",
  ESFJ: "Consul",
  ISTP: "Artificer",
  ISFP: "Bard",
  ESTP: "Tinker",
  ESFP: "Jester",
};

// Dimension order for building the MBTI code
const DIMENSIONS = ["EI", "SN", "TF", "JP"] as const;

function scoreMBTI(
  answers: { question_id: number; pole: string }[]
): string {
  // Count poles per dimension
  const counts: Record<string, Record<string, number>> = {
    EI: { E: 0, I: 0 },
    SN: { S: 0, N: 0 },
    TF: { T: 0, F: 0 },
    JP: { J: 0, P: 0 },
  };

  // Question → dimension mapping (3 questions per dimension)
  const questionDimension: Record<number, string> = {
    1: "EI", 2: "EI", 3: "EI",
    4: "SN", 5: "SN", 6: "SN",
    7: "TF", 8: "TF", 9: "TF",
    10: "JP", 11: "JP", 12: "JP",
  };

  for (const answer of answers) {
    const dim = questionDimension[answer.question_id];
    if (dim && counts[dim] && counts[dim][answer.pole] !== undefined) {
      counts[dim][answer.pole]++;
    }
  }

  // Build MBTI code: for each dimension, pick the pole with more votes (tie → first letter)
  let mbti = "";
  for (const dim of DIMENSIONS) {
    const [poleA, poleB] = dim.split("");
    mbti += (counts[dim][poleA] >= counts[dim][poleB]) ? poleA : poleB;
  }

  return mbti;
}

// POST /api/oracle/result — score answers, assign class + subclass
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

  const parsed = AnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Score the answers
  const mbtiType = scoreMBTI(parsed.data.answers);
  const className = MBTI_CLASS_MAP[mbtiType] ?? "INITIATE";
  const subclass = MBTI_SUBCLASS_MAP[mbtiType] ?? "Novice";

  // Save to profile
  const { error } = await supabase
    .from("profiles")
    .update({
      class: className,
      subclass: subclass,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mbti_type: mbtiType,
    class: className,
    subclass: subclass,
  });
}
