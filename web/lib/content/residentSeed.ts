/**
 * SQL seed for the resident roster (row 217; David 2026-10-17, "seed the full roster"): the proposed residents
 * (residentRoster.ts PROPOSED_RESIDENTS) as npc_personas rows, so production's village has the residents development
 * shows. First block: 20261017020000_resident_roster.sql; later TS changes: lib/seedMigrations.ts (gen-seeds).
 *
 * Every resident is inserted unless its slug is there already, so a resident an admin made or edited stays as it is.
 * The two residents production already had (014: the mayor and the shopkeeper) keep their names and lines and gain
 * the roster's post, bio, tone and routine, only while those are still as their seed left them.
 */
import type { NPCPersona } from "./types";
import { PROPOSED_RESIDENTS } from "./residentRoster";
import { q } from "@/lib/collections/seed";

export const RESIDENTS_BEGIN = "-- BEGIN GENERATED RESIDENT ROSTER (web/scripts/gen-seeds.mjs)";
export const RESIDENTS_END = "-- END GENERATED RESIDENT ROSTER";
const COLS = "slug, display_name, spawn_zone, is_permanent, persona_prompt, canned_dialogue, active, post, bio, tone, schedule, talk";
const b = (v: boolean) => (v ? "TRUE" : "FALSE");
const arr = (xs: readonly string[]) => (xs.length ? `ARRAY[${xs.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const row = (r: NPCPersona) => `  (${[q(r.slug), q(r.display_name), q(r.spawn_zone), b(r.is_permanent), q(r.persona_prompt), arr(r.canned_dialogue), b(r.active),
  q(r.post ?? null), q(r.bio ?? ""), q(r.tone ?? null), json(r.schedule ?? {}), json(r.talk ?? [])].join(", ")})`;

/** Production's two seeded residents (014_content_pipeline, 20260927090000_admin_pass) as their seed left them. */
export const SEEDED_AS: Readonly<Record<string, { post: string | null; schedule: Record<string, string> }>> = {
  mayor: { post: null, schedule: { day: "path" } },
  shopkeeper: { post: "shopkeeper", schedule: { day: "shop" } },
};

export function residentsSeedSql(rows: readonly NPCPersona[] = PROPOSED_RESIDENTS): string {
  const seeded = rows.filter(r => SEEDED_AS[r.slug]).map(r => {
    const was = SEEDED_AS[r.slug];
    return `UPDATE npc_personas SET post = ${q(r.post ?? null)}, bio = ${q(r.bio ?? "")}, tone = ${q(r.tone ?? null)}, schedule = ${json(r.schedule ?? {})}`
      + ` WHERE slug = ${q(r.slug)} AND post IS NOT DISTINCT FROM ${q(was.post)} AND bio = '' AND tone IS NULL AND schedule = ${json(was.schedule)};`;
  });
  return [
    RESIDENTS_BEGIN,
    `INSERT INTO npc_personas (${COLS}) VALUES`,
    rows.map(row).join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    ...seeded,
    RESIDENTS_END,
  ].join("\n");
}
