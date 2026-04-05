import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 12 questions, 3 per MBTI dimension (E/I, S/N, T/F, J/P)
// Each answer has a "dimension" and "pole" indicating which MBTI letter it scores toward
const QUESTIONS = [
  // ── E vs I (3 questions) ──
  {
    id: 1,
    dimension: "EI",
    text: "At a guild meetup, you tend to...",
    options: [
      { label: "Jump into conversations with strangers", pole: "E" },
      { label: "Stick with people you already know", pole: "I" },
    ],
  },
  {
    id: 2,
    dimension: "EI",
    text: "After a long quest, you recharge by...",
    options: [
      { label: "Celebrating with your party at the tavern", pole: "E" },
      { label: "Resting alone in your quarters", pole: "I" },
    ],
  },
  {
    id: 3,
    dimension: "EI",
    text: "When brainstorming a new project, you prefer...",
    options: [
      { label: "Talking it out with teammates", pole: "E" },
      { label: "Thinking it through on your own first", pole: "I" },
    ],
  },

  // ── S vs N (3 questions) ──
  {
    id: 4,
    dimension: "SN",
    text: "When reading a quest briefing, you focus on...",
    options: [
      { label: "The specific steps and concrete deliverables", pole: "S" },
      { label: "The bigger picture and what it could lead to", pole: "N" },
    ],
  },
  {
    id: 5,
    dimension: "SN",
    text: "You'd rather build...",
    options: [
      { label: "Something practical that works right now", pole: "S" },
      { label: "Something experimental that could be game-changing", pole: "N" },
    ],
  },
  {
    id: 6,
    dimension: "SN",
    text: "When learning a new skill, you start with...",
    options: [
      { label: "Hands-on practice and real examples", pole: "S" },
      { label: "Understanding the theory and concepts", pole: "N" },
    ],
  },

  // ── T vs F (3 questions) ──
  {
    id: 7,
    dimension: "TF",
    text: "A teammate's PR has a bug but they're stressed. You...",
    options: [
      { label: "Point out the bug directly — it needs fixing", pole: "T" },
      { label: "Acknowledge their effort first, then mention it gently", pole: "F" },
    ],
  },
  {
    id: 8,
    dimension: "TF",
    text: "When choosing between two project approaches, you prioritize...",
    options: [
      { label: "Which is technically more efficient", pole: "T" },
      { label: "Which the team will enjoy working on more", pole: "F" },
    ],
  },
  {
    id: 9,
    dimension: "TF",
    text: "During a debate, you value...",
    options: [
      { label: "Logical consistency, even if it's uncomfortable", pole: "T" },
      { label: "Maintaining harmony and considering everyone's feelings", pole: "F" },
    ],
  },

  // ── J vs P (3 questions) ──
  {
    id: 10,
    dimension: "JP",
    text: "Your ideal project workflow is...",
    options: [
      { label: "Planned milestones with clear deadlines", pole: "J" },
      { label: "Flexible sprints that adapt as you go", pole: "P" },
    ],
  },
  {
    id: 11,
    dimension: "JP",
    text: "When a new opportunity pops up mid-sprint, you...",
    options: [
      { label: "Finish current tasks first — stay on track", pole: "J" },
      { label: "Pivot if it looks more promising", pole: "P" },
    ],
  },
  {
    id: 12,
    dimension: "JP",
    text: "Your workspace is usually...",
    options: [
      { label: "Organized with a system for everything", pole: "J" },
      { label: "Creative chaos — you know where things are", pole: "P" },
    ],
  },
];

// GET /api/oracle/quiz — return the 12 questions
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has a class assigned
  const { data: profile } = await supabase
    .from("profiles")
    .select("class, subclass")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    questions: QUESTIONS,
    already_classified: !!(profile?.class),
    current_class: profile?.class ?? null,
    current_subclass: profile?.subclass ?? null,
  });
}
