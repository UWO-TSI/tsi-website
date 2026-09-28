/**
 * Residents (rows 122, 217, 218): npc_personas rows with a service post, a
 * bio, a tone and a schedule of where they stand in each island phase.
 * Edited by T1/T2 in the Residents editor (draft → publish, versioned).
 */
import type { IslandPhase } from "@/lib/game/islandTime";
import type { NPCPersona } from "./types";
import { objectById, objectsOf, village, villageSpawnPoint, type Village } from "@/lib/game/villageMap";

export const RESIDENT_POSTS = ["hq_lead", "shopkeeper", "cafe_owner", "museum_curator", "wharf_keeper", "oracle_keeper", "workshop_crafter", "villager"] as const;
export type ResidentPost = (typeof RESIDENT_POSTS)[number];
export const PHASES: readonly IslandPhase[] = ["dawn", "day", "evening", "night"];

/**
 * Schedule anchors (keys are stable: saved schedules reference them). Where each
 * stands is its `anchor` object in the village map file, placed in /lab/map; the
 * painter's health panel checks every one is open ground for three residents.
 */
export const RESIDENT_ANCHORS = {
  plaza: { label: "Plaza" },
  path: { label: "Main path" },
  hq: { label: "Clubhouse steps" },
  shop: { label: "Shop" },
  cafe: { label: "Café" },
  oracle: { label: "Oracle temple" },
  museum: { label: "Museum" },
  pond: { label: "Pond" },
  beach: { label: "Beach" },
  wharf: { label: "Wharf" },
} as const satisfies Record<string, { label: string }>;
export type ResidentAnchor = keyof typeof RESIDENT_ANCHORS;
export type ResidentSchedule = Partial<Record<IslandPhase, ResidentAnchor>>;
/** An anchor's spot on the village map, or null when it is not placed. */
export function anchorAt(key: ResidentAnchor, v: Village = village()): [number, number] | null {
  const o = objectById("anchor", key, v);
  return o ? [o.x, o.z] : null;
}
/** Residents sharing an anchor stand this far apart along x. */
export const SHARED_SPACING = 1.4;

const isAnchor = (v: unknown): v is ResidentAnchor => typeof v === "string" && Object.hasOwn(RESIDENT_ANCHORS, v);

/** Server-side check before an npc_personas draft is saved (fields the editor sends; unknown keys pass). */
export function validateResidentDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.display_name !== "string" || !d.display_name.trim() || d.display_name.length > 80) errors.push("display_name: 1-80 characters");
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
/**
 * Where each resident stands this phase, and where they gather for a ceremony
 * (the map's `gather` spots, in slug order). No schedule for a phase = their day
 * spot, else the plaza.
 */
export function residentSpots(personas: readonly NPCPersona[], phase: IslandPhase, v: Village = village()): { persona: NPCPersona; home: Spot; plaza: Spot }[] {
  const shared = new Map<ResidentAnchor, number>();
  const gather = objectsOf("gather", v);
  const fallback = anchorAt("plaza", v) ?? villageSpawnPoint(v);
  return [...personas].sort((a, b) => a.slug.localeCompare(b.slug)).map((persona, i) => {
    const s = (persona.schedule ?? {}) as ResidentSchedule;
    const anchor = [s[phase], s.day].find(isAnchor) ?? "plaza";
    const k = shared.get(anchor) ?? 0;
    shared.set(anchor, k + 1);
    const [x, z] = anchorAt(anchor, v) ?? fallback;
    const g = gather.length ? gather[i % gather.length] : { x: fallback[0], z: fallback[1] };
    return { persona, home: [x + k * SHARED_SPACING, 0, z], plaza: [g.x, 0, g.z] };
  });
}
