/**
 * Adapter from web/lib/combat (rules + data) to the island's combat contract
 * (lib/game/combat/contract.ts, owned by the island agent; imported for types
 * only, so a contract change fails typecheck here instead of at runtime).
 *
 * Island wiring (their file, one change): in lib/game/combat/data.ts, build
 * WEAPONS / ENEMIES / MISSIONS by merging `islandWeapons()`, `islandEnemies()`,
 * `islandMissions()` with their presentation fields (model, scale, speed,
 * attack shapes) keyed by id, and replace runes.ts `scoreTrace` with
 * `islandScore(rune.strokes, traces, timeLimitMs)`. The gate check uses
 * `islandProgression()` from GET /api/combat/progression.
 */
import type { CombatProgression, EnemyType, IncantationScore, MissionDef, Weapon, WeaponKind } from "@/lib/game/combat/contract";
import { ENEMIES, MISSIONS } from "./content";
import { scoreTrace, type Rune } from "./incantation";
import { SUBCLASS_LEVEL } from "./progression";
import { WEAPONS, type WeaponType } from "./weapons";

const KIND: Record<WeaponType, WeaponKind> = { sword: "melee", shield: "melee", fists: "melee", bow: "bow", revolver: "bow", staff: "staff", tome: "summon", totem: "summon" };

/** Gameplay fields; the island adds cooldown, range, arc, speed, model… */
export function islandWeapons(): Pick<Weapon, "id" | "name" | "kind" | "maxDurability">[] {
  return WEAPONS.map((w) => ({ id: w.key, name: w.name, kind: KIND[w.type], maxDurability: w.max_durability }));
}

export function islandEnemies(): (Pick<EnemyType, "id" | "name" | "kind" | "level" | "hp" | "aggroRadius" | "leashRadius" | "defense" | "armor" | "xp" | "elite"> & { damage: number; range: number })[] {
  return ENEMIES.map((e) => ({
    id: e.key, name: e.name, kind: e.kind === "boss" ? "boss" : e.zone === "outer" ? "wildlife" : "construct", level: e.level, hp: e.hp,
    aggroRadius: e.aggro_radius, leashRadius: e.leash_radius, damage: e.damage, range: e.attack_range, defense: e.defense, armor: e.armor, xp: e.xp, elite: e.kind === "elite",
  }));
}

export function islandMissions(): MissionDef[] {
  return MISSIONS.map((m) => ({
    id: m.key, template: m.template, title: m.title, blurb: "", zone: m.zone, difficulty: m.difficulty,
    params: {
      enemy: typeof m.params.enemy === "string" ? m.params.enemy : undefined,
      count: typeof m.params.count === "number" ? m.params.count : typeof m.params.checkpoints === "number" ? m.params.checkpoints : undefined,
      item: typeof m.params.item === "string" ? m.params.item : undefined,
      waves: typeof m.params.waves === "number" ? m.params.waves : undefined,
      escortee: typeof m.params.resident === "string" ? m.params.resident : undefined,
    },
    reward: { coins: m.rewards.coins, xp: m.rewards.xp, materials: m.rewards.materials },
  }));
}

/** Score any rune (island geometry in [x, y] tuples) with the systems scorer. */
export function islandScore(strokes: [number, number][][], traces: ([number, number] | [number, number, number])[][], timeLimitMs = 7000): IncantationScore {
  const rune: Rune = { key: "island", name: "island", difficulty: "easy", time_limit_ms: timeLimitMs, strokes: strokes.map((s) => s.map(([x, y]) => ({ x, y }))) };
  let t = 0;
  const trace = traces.map((s) => s.map((p) => ({ x: p[0], y: p[1], t: p.length > 2 ? (p as [number, number, number])[2] : (t += 8) })));
  const r = scoreTrace(rune, trace);
  return {
    accuracy: r.accuracy, coverage: r.parts.coverage, deviation: r.parts.closeness, order: r.parts.order,
    scribble: r.parts.ink_ratio > 1.6 || r.parts.off_path > 0.3,
    outcome: r.outcome === "enhanced" ? "enhanced" : r.outcome === "cast" ? "normal" : "fail",
    power: r.potency,
  };
}

/** Ruins gate (rows 179, 207): Oracle family + level-10 subclass choice. */
export function islandProgression(p: { level: number; family: string | null; subclass: { key: string } | null }): CombatProgression {
  const reason = !p.family ? "Visit the Oracle to learn your family." : p.level < SUBCLASS_LEVEL ? `Reach level ${SUBCLASS_LEVEL}.` : !p.subclass ? "Choose your subclass." : null;
  return { level: p.level, family: p.family, subclass: p.subclass?.key ?? null, gateOpen: reason === null, reason };
}
