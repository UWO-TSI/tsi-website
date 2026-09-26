/** SQL seed for weapons, enemy types and missions (kept verbatim in 20260926150800_combat.sql). */
import { ENEMIES, MISSIONS } from "./content";
import { WEAPONS } from "./weapons";

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
export const SEED_BEGIN = "-- BEGIN GENERATED COMBAT SEED (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED COMBAT SEED";

export function combatSeedSql(): string {
  return [
    SEED_BEGIN,
    "INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point) VALUES",
    WEAPONS.map((w) => `  (${[q(w.key), q(w.name), q(w.type), w.tier, `ARRAY[${w.scaling.map(q).join(",")}]::text[]`, w.max_durability, w.repair_per_point].join(", ")})`).join(",\n"),
    "ON CONFLICT (key) DO NOTHING;",
    "INSERT INTO enemy_types (key, name, kind, zone, level, hp, damage, defense, aggro_radius, attack_range, leash_radius, xp, behaviour) VALUES",
    ENEMIES.map((e) => `  (${[q(e.key), q(e.name), q(e.kind), q(e.zone), e.level, e.hp, e.damage, e.defense, e.aggro_radius, e.attack_range, e.leash_radius, e.xp, q(e.behaviour)].join(", ")})`).join(",\n"),
    "ON CONFLICT (key) DO NOTHING;",
    "INSERT INTO missions (key, title, template, zone, params, rewards, cooldown_hours) VALUES",
    MISSIONS.map((m) => `  (${[q(m.key), q(m.title), q(m.template), q(m.zone), `${q(JSON.stringify(m.params))}::jsonb`, `${q(JSON.stringify(m.rewards))}::jsonb`, m.cooldown_hours].join(", ")})`).join(",\n"),
    "ON CONFLICT (key) DO NOTHING;",
    SEED_END,
  ].join("\n");
}
