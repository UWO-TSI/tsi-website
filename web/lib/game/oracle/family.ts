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
