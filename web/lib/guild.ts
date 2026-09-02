// Guild layer for the recruitment flow (David, 2026-09-02): the application
// becomes a character sheet. Four questions (one per MBTI axis, lifted
// verbatim from the Oracle Temple bank in specs/oracle-questions.md) roll a
// class; the form's steps become quests with fixed XP; the result is stored
// in essay_answers under a reserved id so the schema stays untouched.
//
// Cosmetic only. Class never affects review (design principle #4).

export type Axis = "EI" | "SN" | "TF" | "JP";
export type Letter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export interface GuildAnswer {
  text: string;
  value: Letter;
}

export interface GuildQuestion {
  id: number;
  axis: Axis;
  text: string;
  answers: GuildAnswer[];
}

export const GUILD_QUESTIONS: GuildQuestion[] = [
  {
    id: 1,
    axis: "EI",
    text: "When you join a new team or club, you tend to...",
    answers: [
      { text: "Jump in, introduce yourself, and start talking to everyone", value: "E" },
      { text: "Observe first, then connect with one or two people you click with", value: "I" },
      { text: "Look for a role or task to do. You connect through work", value: "I" },
      { text: "Bring energy to the room and rally people around an idea", value: "E" },
    ],
  },
  {
    id: 4,
    axis: "SN",
    text: "When learning a new technology or framework, you prefer to...",
    answers: [
      { text: "Follow the official tutorial step by step, building something concrete", value: "S" },
      { text: "Skim the docs to understand the big picture, then experiment", value: "N" },
      { text: "Look at real-world examples and replicate what works", value: "S" },
      { text: "Imagine what you could build with it, then learn what you need as you go", value: "N" },
    ],
  },
  {
    id: 7,
    axis: "TF",
    text: "Two teammates disagree on a technical approach. You...",
    answers: [
      { text: "Evaluate both options on merit: data, performance, maintainability", value: "T" },
      { text: "Consider how each person feels about their approach and find a compromise", value: "F" },
      { text: "Pick the one that ships faster. Efficiency matters most", value: "T" },
      { text: "Make sure neither person feels dismissed, even if one approach is clearly better", value: "F" },
    ],
  },
  {
    id: 10,
    axis: "JP",
    text: "Your ideal project workflow looks like...",
    answers: [
      { text: "Clear milestones, deadlines, and a structured plan from day one", value: "J" },
      { text: "A rough direction, then adapt as you learn and discover", value: "P" },
      { text: "Sprints with defined goals, but flexibility within each sprint", value: "J" },
      { text: "Work on whatever feels most important right now. Plans change anyway", value: "P" },
    ],
  },
];

export type GuildClass = "Warrior" | "Mage" | "Healer" | "Rogue";

export interface ClassInfo {
  class: GuildClass;
  subclass: string;
}

// Same map the Oracle Temple uses (app/student/dashboard/oracle/page.tsx),
// so a member's in-world class matches the one on their application card.
export const MBTI_TO_CLASS: Record<string, ClassInfo> = {
  ENTJ: { class: "Warrior", subclass: "Tactical Commander" },
  ESTJ: { class: "Warrior", subclass: "Iron Marshal" },
  ESTP: { class: "Warrior", subclass: "Vanguard Striker" },
  ENTP: { class: "Warrior", subclass: "Battle Strategist" },
  INTJ: { class: "Mage", subclass: "Arcane Architect" },
  INTP: { class: "Mage", subclass: "Lore Seeker" },
  INFJ: { class: "Mage", subclass: "Oracle Sage" },
  INFP: { class: "Mage", subclass: "Dream Weaver" },
  ENFJ: { class: "Healer", subclass: "Beacon Guide" },
  ENFP: { class: "Healer", subclass: "Spirit Catalyst" },
  ESFJ: { class: "Healer", subclass: "Shield Warden" },
  ISFJ: { class: "Healer", subclass: "Sanctuary Keeper" },
  ISTP: { class: "Rogue", subclass: "Shadow Tinker" },
  ISFP: { class: "Rogue", subclass: "Wandering Artisan" },
  ISTJ: { class: "Rogue", subclass: "Silent Sentinel" },
  ESFP: { class: "Rogue", subclass: "Blaze Performer" },
};

export const CLASS_COLORS: Record<GuildClass, string> = {
  Warrior: "#EF4444",
  Mage: "#6366F1",
  Healer: "#22C55E",
  Rogue: "#F59E0B",
};

export const CLASS_DESCRIPTIONS: Record<GuildClass, string> = {
  Warrior: "You lead with strategy and action. Your strength is turning plans into reality.",
  Mage: "You think deeply and create brilliantly. Your power is insight and invention.",
  Healer: "You connect and uplift others. Your gift is building teams that thrive.",
  Rogue: "You adapt and craft with precision. Your edge is resourcefulness and independence.",
};

/** What gets saved with the draft and, on submit, into essay_answers. */
export interface Character {
  mbti: string;
  class: GuildClass;
  subclass: string;
  /** Index of the chosen answer per question, in GUILD_QUESTIONS order. */
  answers: number[];
}

/** Reserved essay_answers id. Admin card + CSV export pull it out by name. */
export const META_GUILD_CLASS_ID = "__guild_class";

export function rollCharacter(answers: number[]): Character | null {
  if (answers.length < GUILD_QUESTIONS.length) return null;
  const letters = GUILD_QUESTIONS.map((q, i) => q.answers[answers[i]]?.value);
  if (letters.some((l) => !l)) return null;
  const mbti = letters.join("");
  const info = MBTI_TO_CLASS[mbti];
  if (!info) return null;
  return { mbti, class: info.class, subclass: info.subclass, answers };
}

/** Parse a stored `__guild_class` answer. Tolerates junk. */
export function parseCharacter(raw: string | null | undefined): Character | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Character>;
    if (!c || typeof c.mbti !== "string") return null;
    const info = MBTI_TO_CLASS[c.mbti];
    if (!info) return null;
    return {
      mbti: c.mbti,
      class: info.class,
      subclass: info.subclass,
      answers: Array.isArray(c.answers) ? c.answers : [],
    };
  } catch {
    return null;
  }
}

export interface Quest {
  id: string;
  /** Sidebar label. */
  name: string;
  /** Heading above the step content. */
  title: string;
  xp: number;
}

// Five quests, 100 XP total. Order matches ApplicationForm's steps.
export const QUESTS: Quest[] = [
  { id: "roll", name: "Roll your character", title: "Roll your character", xp: 20 },
  { id: "identity", name: "Identity", title: "Who you are", xp: 20 },
  { id: "proof", name: "Proof of work", title: "Proof of work", xp: 20 },
  { id: "trials", name: "Trials", title: "The trials", xp: 25 },
  { id: "oath", name: "Oath", title: "The oath", xp: 15 },
];

export const TOTAL_XP = QUESTS.reduce((sum, q) => sum + q.xp, 0);

/** XP earned when every quest before `step` is complete. */
export function xpForStep(step: number): number {
  return QUESTS.slice(0, Math.max(0, Math.min(step, QUESTS.length))).reduce(
    (sum, q) => sum + q.xp,
    0
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
