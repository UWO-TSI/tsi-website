/**
 * Family look for the reveal (row 206). The family itself comes from the
 * systems engine (lib/oracle/engine.ts: NT/SJ/SP/NF → Arcane/Ranger/
 * Vanguard/Warden); this is the island's colour, light and keeper wording.
 */
import type { Family } from "@/lib/oracle/engine";

export interface FamilyMeta { color: string; light: string; blurb: string; keeperLine: string }
export const FAMILIES: Record<Family, FamilyMeta> = {
  Arcane: { color: "#8B5CF6", light: "#B48CFF", blurb: "Thinkers who chase the idea behind the idea.",
    keeperLine: "The light runs violet. You see the pattern before anyone else does. Welcome, Arcane." },
  Ranger: { color: "#3B82F6", light: "#7FB2FF", blurb: "Steady hands who keep the path clear for everyone.",
    keeperLine: "Blue, and steady as the tide. People lean on you, and they're right to. Welcome, Ranger." },
  Vanguard: { color: "#F2C94C", light: "#FFE08A", blurb: "Doers who move first and figure it out on the way.",
    keeperLine: "Gold light, quick as a spark. You're already halfway there. Welcome, Vanguard." },
  Warden: { color: "#34C759", light: "#8FE3A0", blurb: "Hearts who grow the people around them.",
    keeperLine: "Green, like new leaves. The island feels warmer with you on it. Welcome, Warden." },
};
export const isFamily = (v: unknown): v is Family => typeof v === "string" && v in FAMILIES;

/** What the keeper says at each beat (the answer route returns beat 1, 2, … every ten answers). */
const REACTIONS = [
  "Take your time. There are no wrong answers in here.",
  "Hm. The crystal is warming up.",
  "Halfway. Stretch if you need to.",
  "The colours are starting to settle.",
  "Nearly there. I can almost see it.",
  "Last few. Answer the way you really are, not the way you'd like to be.",
];
export function keeperReaction(beat: number | null): string | null {
  return beat && beat > 0 ? REACTIONS[Math.min(REACTIONS.length - 1, beat - 1)] : null;
}

export const SCALE: { value: -2 | -1 | 0 | 1 | 2; label: string }[] = [
  { value: -2, label: "Not me" }, { value: -1, label: "Not really" }, { value: 0, label: "Unsure" },
  { value: 1, label: "Somewhat" }, { value: 2, label: "That's me" },
];
