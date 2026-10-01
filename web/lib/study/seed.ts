/** SQL seed for the study tables (lib/seedMigrations.ts): the TS in tables.ts is the source; changes land as a new migration. */
import { q } from "@/lib/collections/seed";
import { DEFAULT_TABLES } from "./tables";

export const SEED_BEGIN = "-- BEGIN GENERATED STUDY TABLES (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED STUDY TABLES";

export function studyTablesSeedSql(): string {
  const rows = DEFAULT_TABLES.map((t) => `  (${[q(t.id), q(t.slug), q(t.label), q(t.location), q(t.anchor), q(t.kind), t.seats, t.position].join(", ")})`);
  return [
    SEED_BEGIN,
    "INSERT INTO study_tables (id, slug, label, location, anchor, kind, seats, position) VALUES",
    rows.join(",\n"),
    "ON CONFLICT (id) DO NOTHING;",
    SEED_END,
  ].join("\n");
}
