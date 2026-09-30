/**
 * SQL seed for weapons, enemy types and missions, kept verbatim in
 * 20260926190000_combat_content.sql. Upserts, so the content pass overwrites
 * the first seed in 20260926150800_combat.sql (web/scripts/gen-seeds.mjs).
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

export function combatSeedSql(): string {
  return [
    SEED_BEGIN,
    `INSERT INTO weapons (${WEAPON_COLS.join(", ")}) VALUES`,
    WEAPONS.map((w) => `  (${[q(w.key), q(w.name), q(w.type), w.tier, `ARRAY[${w.scaling.map(q).join(",")}]::text[]`, w.max_durability, w.repair_per_point].join(", ")})`).join(",\n"),
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
