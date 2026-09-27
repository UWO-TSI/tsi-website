/**
 * Residents (rows 122, 217, 218): npc_personas rows with a service post, a
 * bio, a tone and a schedule of where they stand in each island phase.
 * Edited by T1/T2 in the Residents editor (draft → publish, versioned).
 */
import type { IslandPhase } from "@/lib/game/islandTime";
import type { NPCPersona } from "./types";

export const RESIDENT_POSTS = ["hq_lead", "shopkeeper", "cafe_owner", "museum_curator", "wharf_keeper", "oracle_keeper", "workshop_crafter", "villager"] as const;
export type ResidentPost = (typeof RESIDENT_POSTS)[number];
export const PHASES: readonly IslandPhase[] = ["dawn", "day", "evening", "night"];

/** Schedule anchors: open ground beside each place on the member island (residents.test.ts checks every spot is standable). */
export const RESIDENT_ANCHORS = {
  plaza: { label: "Plaza", at: [-3.3, 2.3] },
  path: { label: "Main path", at: [-2, -7] },
  hq: { label: "Clubhouse steps", at: [1.2, 4.2] },
  shop: { label: "Shop", at: [9, -9.6] },
  cafe: { label: "Café", at: [-10, -9.6] },
  oracle: { label: "Oracle temple", at: [-11, 6.4] },
  museum: { label: "Museum", at: [11, 6.4] },
  pond: { label: "Pond", at: [-6.6, 1.9] },
  beach: { label: "Beach", at: [-3, -16] },
  wharf: { label: "Wharf", at: [6.5, -16.5] },
} as const satisfies Record<string, { label: string; at: readonly [number, number] }>;
export type ResidentAnchor = keyof typeof RESIDENT_ANCHORS;
export type ResidentSchedule = Partial<Record<IslandPhase, ResidentAnchor>>;
/** Where residents gather at a club-goal ceremony, in slug order. */
const CEREMONY: readonly (readonly [number, number])[] = [[-3.3, 2.3], [-6.6, 1.9], [-1.4, 2.4], [1.2, 2.6], [-2.4, 4.2], [3, 3.4]];
/** Residents sharing an anchor stand this far apart along x. */
export const SHARED_SPACING = 1.4;

const isAnchor = (v: unknown): v is ResidentAnchor => typeof v === "string" && Object.hasOwn(RESIDENT_ANCHORS, v);

/** Server-side check before an npc_personas draft is saved (fields the editor sends; unknown keys pass). */
export function validateResidentDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.display_name !== "string" || !d.display_name.trim() || d.display_name.length > 40) errors.push("display_name: 1-40 characters");
  if (d.post != null && !(RESIDENT_POSTS as readonly unknown[]).includes(d.post)) errors.push("post: one of the service posts or villager");
  if (d.bio !== undefined && (typeof d.bio !== "string" || d.bio.length > 1000)) errors.push("bio: up to 1000 characters");
  if (d.tone != null && (typeof d.tone !== "string" || d.tone.length > 40)) errors.push("tone: up to 40 characters");
  const lines = d.canned_dialogue;
  if (lines !== undefined && (!Array.isArray(lines) || lines.length > 30 || lines.some((l) => typeof l !== "string" || !l.trim() || l.length > 200))) errors.push("dialogue: up to 30 lines of 1-200 characters");
  const s = d.schedule;
  if (s !== undefined && (!s || typeof s !== "object" || Array.isArray(s) || Object.entries(s).some(([k, v]) => !(PHASES as readonly string[]).includes(k) || !isAnchor(v)))) errors.push("schedule: phase → anchor");
  return errors;
}

type Spot = [number, number, number];
/** Where each resident stands this phase, and where they gather for a ceremony. No schedule for a phase = their day spot, else the plaza. */
export function residentSpots(personas: readonly NPCPersona[], phase: IslandPhase): { persona: NPCPersona; home: Spot; plaza: Spot }[] {
  const shared = new Map<ResidentAnchor, number>();
  return [...personas].sort((a, b) => a.slug.localeCompare(b.slug)).map((persona, i) => {
    const s = (persona.schedule ?? {}) as ResidentSchedule;
    const anchor = [s[phase], s.day].find(isAnchor) ?? "plaza";
    const k = shared.get(anchor) ?? 0;
    shared.set(anchor, k + 1);
    const [x, z] = RESIDENT_ANCHORS[anchor].at;
    const [cx, cz] = CEREMONY[i % CEREMONY.length];
    return { persona, home: [x + k * SHARED_SPACING, 0, z], plaza: [cx, 0, cz] };
  });
}
