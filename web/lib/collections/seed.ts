/** SQL seed for collection_species, generated from ROSTER (kept verbatim in 20260926150400_collections.sql). */
import type { Species } from "./roster";

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const arr = (v: (string | number)[], type: "text" | "int") => (v.length ? `ARRAY[${v.map((x) => (type === "text" ? q(String(x)) : String(x))).join(",")}]::${type}[]` : `'{}'::${type}[]`);

export const SEED_BEGIN = "-- BEGIN GENERATED ROSTER (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED ROSTER";

export function seedSql(roster: Species[]): string {
  const rows = roster.map((s) =>
    `  (${[q(s.key), q(s.category), q(s.sub), q(s.name), q(s.biome), q(s.tool), q(s.rarity),
      s.size ? s.size[0] : "NULL", s.size ? s.size[1] : "NULL", s.hours ? s.hours[0] : "NULL", s.hours ? s.hours[1] : "NULL",
      s.rainAnyHour ? "TRUE" : "FALSE", arr(s.weather, "text"), arr(s.months, "int"), q(s.oneLiner), q(s.icon), q(s.model),
      s.assetReady ? "TRUE" : "FALSE", s.donatable ? "TRUE" : "FALSE", q(s.wing), s.position].join(", ")})`,
  );
  return [
    SEED_BEGIN,
    "INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,",
    "  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES",
    rows.join(",\n"),
    "ON CONFLICT (key) DO NOTHING;",
    SEED_END,
  ].join("\n");
}
