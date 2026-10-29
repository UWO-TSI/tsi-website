/**
 * Residents (rows 122, 217, 218): npc_personas rows with a service post, a
 * bio, a tone and a schedule of where they stand in each island phase.
 * Edited by T1/T2 in the Residents editor (draft → publish, versioned).
 */
import { ISLAND_PHASES, type IslandPhase } from "@/lib/game/islandTime";
import { HOME_LANDMARKS, ROUTINE_SPECIAL } from "@/lib/game/residentRoutine";
import type { LandmarkId } from "@/lib/game/defaultIsland";
import { validateTalk } from "./talk";

export const RESIDENT_POSTS = ["hq_lead", "shopkeeper", "cafe_owner", "museum_curator", "wharf_keeper", "oracle_keeper", "workshop_crafter", "villager"] as const;
export type ResidentPost = (typeof RESIDENT_POSTS)[number];
/** Each post's title (the Residents editor, the dialogue box's name tag). */
export const POST_TITLES: Record<ResidentPost, string> = {
  hq_lead: "HQ lead", shopkeeper: "Shopkeeper", cafe_owner: "Café owner", museum_curator: "Museum curator",
  wharf_keeper: "Wharf keeper", oracle_keeper: "Oracle keeper", workshop_crafter: "Workshop crafter", villager: "Villager",
};

/**
 * Schedule anchors (keys are stable: saved schedules reference them). Where each stands is its `anchor` object placed
 * in the world editor, else the landmark of the same name (lib/game/residentRoutine.ts placeAt).
 */
export const RESIDENT_ANCHORS = {
  plaza: { label: "Plaza" },
  path: { label: "Main path" },
  hq: { label: "HQ steps" },
  shop: { label: "Shop" },
  cafe: { label: "Café" },
  oracle: { label: "Oracle temple" },
  museum: { label: "Museum" },
  pond: { label: "Pond" },
  beach: { label: "Beach" },
  wharf: { label: "Wharf" },
} as const satisfies Record<string, { label: string }>;
export type ResidentAnchor = keyof typeof RESIDENT_ANCHORS;
/** A stop in a routine: a map anchor, a bench (under a lamp at night) or home (in through their door). */
export type ResidentStop = ResidentAnchor | keyof typeof ROUTINE_SPECIAL;
/** Per phase, one stop or a routine of up to MAX_STOPS walked in turn; `home` is the building they live in. */
export type ResidentSchedule = Partial<Record<IslandPhase, ResidentStop | ResidentStop[]>> & { home?: LandmarkId };
export const MAX_STOPS = 6;
const isAnchor = (v: unknown): v is ResidentAnchor => typeof v === "string" && Object.hasOwn(RESIDENT_ANCHORS, v);
const isStop = (v: unknown): v is ResidentStop => isAnchor(v) || (typeof v === "string" && Object.hasOwn(ROUTINE_SPECIAL, v));
/** A phase's value: one stop, or a routine of 1–MAX_STOPS stops. */
const isRoutine = (v: unknown) => isStop(v) || (Array.isArray(v) && v.length > 0 && v.length <= MAX_STOPS && v.every(isStop));

/** Server-side check before an npc_personas draft is saved (fields the editor sends; unknown keys pass). */
export function validateResidentDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.display_name !== "string" || !d.display_name.trim() || d.display_name.length > 80) errors.push("display_name: 1-80 characters");
  if (d.post != null && !(RESIDENT_POSTS as readonly unknown[]).includes(d.post)) errors.push("post: one of the service posts or villager");
  if (d.bio !== undefined && (typeof d.bio !== "string" || d.bio.length > 1000)) errors.push("bio: up to 1000 characters");
  if (d.tone != null && (typeof d.tone !== "string" || d.tone.length > 40)) errors.push("tone: up to 40 characters");
  if (d.persona_prompt != null && (typeof d.persona_prompt !== "string" || d.persona_prompt.length > 2000)) errors.push("persona_prompt: up to 2000 characters");
  const lines = d.canned_dialogue;
  if (lines !== undefined && (!Array.isArray(lines) || lines.length > 30 || lines.some((l) => typeof l !== "string" || !l.trim() || l.length > 200))) errors.push("dialogue: up to 30 lines of 1-200 characters");
  const talk = d.talk === undefined ? null : validateTalk(d.talk);
  if (talk) errors.push(talk);
  const s = d.schedule;
  if (s !== undefined && (!s || typeof s !== "object" || Array.isArray(s) || Object.entries(s).some(([k, v]) => k === "home" ? !(HOME_LANDMARKS as readonly unknown[]).includes(v) : !(ISLAND_PHASES as readonly string[]).includes(k) || !isRoutine(v)))) errors.push("schedule: phase → stop or routine of stops; home → a building");
  return errors;
}

