/**
 * SQL seed for weapons, enemy types and missions (first block in
 * 20260926190000_combat_content.sql; changes: lib/seedMigrations.ts). Upserts,
 * so the content pass overwrites the first seed in 20260926150800_combat.sql.
 * Classes v2 signature weapons (`subclass` set) are seeded by their family's own
 * migration (`*_classes_v2_<family>_seed.sql`, with the subclass column), not here.
 */
import { ENEMIES, MISSIONS } from "./content";
import { WEAPONS } from "./weapons";
import { q } from "@/lib/collections/seed";
const upsert = (cols: string[]) => `ON CONFLICT (key) DO UPDATE SET ${cols.filter((c) => c !== "key").map((c) => `${c} = EXCLUDED.${c}`).join(", ")};`;
export const SEED_BEGIN = "-- BEGIN GENERATED COMBAT SEED (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED COMBAT SEED";

const WEAPON_COLS = ["key", "name", "weapon_type", "tier", "scaling", "max_durability", "repair_per_point"];
const ENEMY_COLS = ["key", "name", "kind", "zone", "level", "hp", "damage", "defense", "armor", "aggro_radius", "attack_range", "leash_radius", "xp", "behaviour"];
const MISSION_COLS = ["key", "title", "template", "zone", "difficulty", "params", "rewards", "cooldown_hours"];

const weaponRow = (w: (typeof WEAPONS)[number]) => [q(w.key), q(w.name), q(w.type), w.tier, `ARRAY[${w.scaling.map(q).join(",")}]::text[]`, w.max_durability, w.repair_per_point];
/** A family wave's signature weapons (classes v2 §1.5): every tier of its subclasses' types, with the subclass they belong to. */
export function signatureSeedSql(subclasses: string[]): string {
  const cols = [...WEAPON_COLS, "subclass"];
  return [`INSERT INTO weapons (${cols.join(", ")}) VALUES`,
    WEAPONS.filter((w) => w.subclass && subclasses.includes(w.subclass)).map((w) => `  (${[...weaponRow(w), q(w.subclass!)].join(", ")})`).join(",\n"),
    upsert(cols)].join("\n");
}

export function combatSeedSql(): string {
  return [
    SEED_BEGIN,
    `INSERT INTO weapons (${WEAPON_COLS.join(", ")}) VALUES`,
    // Signature weapons (classes v2) are seeded by their family's own migration, with their subclass (signatureSeedSql).
    WEAPONS.filter((w) => !w.subclass).map((w) => `  (${weaponRow(w).join(", ")})`).join(",\n"),
    upsert(WEAPON_COLS),
    `INSERT INTO enemy_types (${ENEMY_COLS.join(", ")}) VALUES`,
    ENEMIES.map((e) => `  (${[q(e.key), q(e.name), q(e.kind), q(e.zone), e.level, e.hp, e.damage, e.defense, e.armor, e.aggro_radius, e.attack_range, e.leash_radius, e.xp, q(e.behaviour)].join(", ")})`).join(",\n"),
    upsert(ENEMY_COLS),
    `INSERT INTO missions (${MISSION_COLS.join(", ")}) VALUES`,
    MISSIONS.map((m) => `  (${[q(m.key), q(m.title), q(m.template), q(m.zone), m.difficulty, `${q(JSON.stringify(m.params))}::jsonb`, `${q(JSON.stringify(m.rewards))}::jsonb`, m.cooldown_hours].join(", ")})`).join(",\n"),
    upsert(MISSION_COLS),
    SEED_END,
  ].join("\n");
}
