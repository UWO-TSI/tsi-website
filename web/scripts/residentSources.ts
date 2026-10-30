/**
 * Every resident the Residents page (specs/tools/npc-editor/) edits, read from the sources the game reads them from,
 * and the checks an edit must pass. The page and scripts/apply-residents.mjs share it, so the page shows exactly
 * what the script would refuse.
 *
 * - The roster (lib/content/residentRoster.ts): PROPOSED_RESIDENTS (name, post, bio, tone, schedule, idle lines;
 *   seeded into npc_personas through gen-seeds), RESIDENT_TALK (conversations), RESIDENT_LOOKS (looks).
 * - Rosa, the café owner (lib/game/cafe.ts): CAFE_OWNER (name, look, lines) and SWEEPER_LINES (out front).
 * - The sushi bar's chef and server (lib/game/sushiBar.ts): CHEF_LOOK and SERVER_LOOK, look only.
 */
import { PROPOSED_RESIDENTS, RESIDENT_LOOKS, RESIDENT_TALK } from "@/lib/content/residentRoster";
import { MAX_STOPS, POST_TITLES, RESIDENT_ANCHORS, RESIDENT_POSTS, type ResidentPost } from "@/lib/content/residents";
import { validateTalk } from "@/lib/content/talk";
import { CAFE_OWNER, SWEEPER_LINES } from "@/lib/game/cafe";
import { CHEF_LOOK, SERVER_LOOK } from "@/lib/game/sushiBar";
import { HOME_LANDMARKS, ROUTINE_SPECIAL } from "@/lib/game/residentRoutine";
import { ISLAND_PHASES } from "@/lib/game/islandTime";
import { parseLook, type CharacterLook } from "@/lib/game/character/look";

export type Schedule = Record<string, string | string[]>;
/** Everything editable about a resident; each resident has some of these. */
export interface Values {
  display_name: string; post: string; bio: string; tone: string;
  look: CharacterLook; schedule: Schedule;
  canned_dialogue: string[]; talk: string[][]; sweeper_lines: string[];
}
export type Field = keyof Values;
export interface Resident { slug: string; /** The second line under the name. */ role: string; fields: readonly Field[]; base: Partial<Values> }

const ROSTER_FIELDS: readonly Field[] = ["display_name", "post", "bio", "tone", "look", "schedule", "canned_dialogue", "talk"];
export const RESIDENTS: readonly Resident[] = [
  ...PROPOSED_RESIDENTS.map((r): Resident => ({
    slug: r.slug, role: POST_TITLES[r.post as ResidentPost] ?? "Villager", fields: ROSTER_FIELDS,
    base: { display_name: r.display_name, post: r.post ?? "villager", bio: r.bio ?? "", tone: r.tone ?? "", look: parseLook(RESIDENT_LOOKS[r.slug]),
      schedule: (r.schedule ?? {}) as Schedule, canned_dialogue: r.canned_dialogue, talk: RESIDENT_TALK[r.slug] ?? [] },
  })),
  { slug: CAFE_OWNER.slug, role: "Café owner", fields: ["display_name", "look", "canned_dialogue", "sweeper_lines"],
    base: { display_name: CAFE_OWNER.name, look: parseLook(CAFE_OWNER.look), canned_dialogue: CAFE_OWNER.lines, sweeper_lines: SWEEPER_LINES } },
  { slug: "sushi-chef", role: "Sushi chef", fields: ["look"], base: { look: parseLook(CHEF_LOOK) } },
  { slug: "sushi-server", role: "Sushi server", fields: ["look"], base: { look: parseLook(SERVER_LOOK) } },
];
export const RESIDENT_BY_SLUG = new Map(RESIDENTS.map(r => [r.slug, r]));
/** A resident's name as the page lists it (the chef and server have none in game). */
export const nameOf = (r: Resident, v: Partial<Values> = r.base) => v.display_name ?? r.base.display_name ?? r.role;

/** A routine's stops: the map's anchors, a bench, home. */
export const STOPS: readonly string[] = [...Object.keys(RESIDENT_ANCHORS), ...Object.keys(ROUTINE_SPECIAL)];
export const PHASES = ISLAND_PHASES;

/** JSON with keys sorted, so two values compare by content. */
export const stable = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
export const same = (a: unknown, b: unknown) => stable(a) === stable(b);

const LINES = { max: 30, chars: 200 };
const lines = (v: unknown) => Array.isArray(v) && v.length <= LINES.max && v.every(l => typeof l === "string" && l.trim() && l.length <= LINES.chars);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

/** What's wrong with one field's value, or null. */
export function fieldProblem(field: Field, v: unknown): string | null {
  switch (field) {
    case "display_name": return typeof v === "string" && v.trim() && v.length <= 80 && v === v.trim() ? null : "Name: 1 to 80 characters, no spaces at the ends";
    case "post": return (RESIDENT_POSTS as readonly unknown[]).includes(v) ? null : "Role: one of the posts";
    case "bio": return text(v, 1000) ? null : "Bio: up to 1000 characters";
    case "tone": return text(v, 40) ? null : "Tone: up to 40 characters";
    case "canned_dialogue": case "sweeper_lines": return lines(v) ? null : `Lines: 1 to ${LINES.max} lines, each 1 to ${LINES.chars} characters`;
    case "talk": return validateTalk(v);
    case "look": {
      if (!v || typeof v !== "object") return "Look: not a look";
      const parsed = parseLook(v);
      return same(parsed, v) ? null : `Look: something the catalogue doesn't have (${Object.keys(parsed).filter(k => !same(parsed[k as keyof CharacterLook], (v as Record<string, unknown>)[k])).join(", ") || "an extra field"})`;
    }
    case "schedule": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return "Schedule: not a schedule";
      for (const [k, s] of Object.entries(v)) {
        if (k === "home") { if (!(HOME_LANDMARKS as readonly unknown[]).includes(s)) return `Home: ${s} is not a building`; continue; }
        if (!(PHASES as readonly string[]).includes(k)) return `Schedule: ${k} is not a time of day`;
        const stops = typeof s === "string" ? [s] : s;
        if (!Array.isArray(stops) || !stops.length || stops.length > MAX_STOPS) return `${k}: 1 to ${MAX_STOPS} places`;
        const bad = stops.find(x => !STOPS.includes(x));
        if (bad !== undefined) return `${k}: ${bad} is not a place`;
      }
      return null;
    }
  }
}

/** Every problem with a resident's doc (only the fields it changes), or an unknown resident. */
export function docProblems(slug: string, doc: Record<string, unknown>): string[] {
  const r = RESIDENT_BY_SLUG.get(slug);
  if (!r) return [`${slug}: not a resident`];
  return Object.entries(doc).flatMap(([f, v]) => {
    if (!r.fields.includes(f as Field)) return [`${slug}: ${f} is not editable for this resident`];
    const p = fieldProblem(f as Field, v);
    return p ? [`${slug}: ${p}`] : [];
  });
}

/** An export of the page's db (a list of docs, `{ id, data }` or fields beside the id, or a map by id) as [slug, doc] pairs. */
export function docsOf(raw: unknown): [string, Record<string, unknown>][] {
  const ID = ["id", "doc_id", "_id"];
  if (Array.isArray(raw)) return raw.map(d => [ID.map(k => d?.[k]).find(Boolean),
    d?.data ?? Object.fromEntries(Object.entries(d ?? {}).filter(([k]) => !ID.includes(k)))]);
  if (raw && typeof raw === "object") return Object.entries((raw as { docs?: object; documents?: object }).docs ?? (raw as { documents?: object }).documents ?? raw) as [string, Record<string, unknown>][];
  throw new Error("the export is neither a list of docs nor a map of them");
}
