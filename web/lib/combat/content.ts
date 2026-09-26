/**
 * Ruins roster, missions and the boss drop table (rows 21, 208, 213, 228, 230,
 * 231). Content, mirrored as seed rows in 20260926190000_combat_content.sql
 * (enemy_types, missions, weapons); placeholder numbers. Levels are fixed per
 * zone, never scaled to the player (row 230): the outer wild is outgrown, the
 * inner temple is level 10 and the boss is a wall until geared.
 */
export type EnemyKind = "normal" | "elite" | "boss";
export type Zone = "outer" | "inner" | "boss";
export interface EnemyType {
  key: string;
  name: string;
  kind: EnemyKind;
  zone: Zone;
  level: number;
  hp: number;
  damage: number;
  defense: number; // 0..0.8 damage reduction
  armor: number; // flat reduction after defense: the stone skin that makes the boss a wall for tier-1 gear
  aggro_radius: number;
  attack_range: number;
  leash_radius: number;
  xp: number;
  behaviour: string; // what the telegraphs teach (row 51)
}

/** Row 230: one level per zone; elites sit two above it. */
export const ZONE_LEVEL: Record<Zone, number> = { outer: 5, inner: 10, boss: 15 };

const e = (key: string, name: string, kind: EnemyKind, zone: Zone, hp: number, damage: number, defense: number, aggro: number, range: number, xp: number, behaviour: string, armor = 0, leash = aggro * 3): EnemyType => ({
  key, name, kind, zone, level: ZONE_LEVEL[zone] + (kind === "elite" ? 2 : 0), hp, damage, defense, armor, aggro_radius: aggro, attack_range: range, leash_radius: leash, xp, behaviour,
});

export const ENEMIES: EnemyType[] = [
  e("shadow-fox", "Shadow fox", "normal", "outer", 60, 8, 0, 7, 1.5, 30, "Crouches, eyes flare, then pounces; dodge sideways."),
  e("thorn-crab", "Thorn crab", "normal", "outer", 90, 10, 0.3, 4, 1.2, 35, "Raises both claws, then sweeps a wide arc in front."),
  e("mushroom-beast", "Mushroom beast", "normal", "outer", 110, 9, 0.1, 5, 4, 40, "Cap swells, then it spits spores at where you stood."),
  e("rune-wisp", "Rune wisp", "normal", "outer", 70, 9, 0, 8, 7, 40, "Ring spins up and glows, then a rune bolt flies at your spot."),
  e("animated-book", "Animated book", "normal", "inner", 120, 13, 0.2, 6, 2, 65, "Pages flutter open, then it snaps shut on a short charge."),
  e("stone-golem", "Stone golem", "elite", "inner", 420, 22, 0.45, 6, 2.5, 220, "Raises both fists, core glows, then slams the ground around it.", 2),
  e("elder-thorn-crab", "Elder thorn crab", "elite", "outer", 300, 16, 0.4, 5, 1.8, 160, "A slower, wider claw sweep; hit it from behind."),
  // Wakes when you step into its chamber and never leaves it (leash 11 from its plinth).
  e("guardian-statue", "Guardian statue", "boss", "boss", 1800, 28, 0.35, 9, 3, 1200,
    "Overhead slam on a ring marker, a sigil beam sweep with a stagger after it, two rune wisps below half health, enraged at a fifth.", 9, 11),
];

export type Template = "hunt" | "fetch" | "survive" | "escort";
export interface MissionDef {
  key: string;
  title: string;
  template: Template;
  zone: Zone;
  difficulty: 1 | 2 | 3 | 4 | 5; // shown on the board
  params: Record<string, string | number>;
  rewards: { xp: number; coins: number; materials: Record<string, number> }; // materials: member_collections item_key → count
  cooldown_hours: number; // repeatable after this (row 24)
}
const m = (key: string, title: string, template: Template, zone: Zone, difficulty: MissionDef["difficulty"], params: MissionDef["params"], xp: number, coins: number, materials: Record<string, number>, cooldown_hours = 20): MissionDef => ({
  key, title, template, zone, difficulty, params, rewards: { xp, coins, materials }, cooldown_hours,
});

/** Ten missions across the four templates (row 231). */
export const MISSIONS: MissionDef[] = [
  m("hunt-foxes", "Fox trouble", "hunt", "outer", 1, { enemy: "shadow-fox", count: 6 }, 300, 60, { wood_branch: 3 }),
  m("hunt-crabs", "Crab season", "hunt", "outer", 2, { enemy: "thorn-crab", count: 5 }, 320, 60, { rock_stone: 3 }),
  m("hunt-wisps", "Put out the wisps", "hunt", "outer", 2, { enemy: "rune-wisp", count: 4 }, 360, 70, { rock_crystal: 1 }),
  m("hunt-golem", "Break the golem", "hunt", "inner", 4, { enemy: "stone-golem", count: 1 }, 700, 150, { rock_iron_nugget: 3 }),
  m("fetch-lantern", "The lost lantern", "fetch", "outer", 1, { item: "old-lantern", chamber: "fox-den" }, 350, 70, { rock_clay: 2 }),
  m("fetch-tome", "An overdue book", "fetch", "inner", 3, { item: "sealed-tome", chamber: "library" }, 650, 120, { rock_gold_nugget: 1 }),
  m("survive-circle", "Hold the rune circle", "survive", "outer", 2, { waves: 3 }, 400, 80, { rock_iron_nugget: 2 }),
  m("survive-sanctum", "Sanctum watch", "survive", "inner", 4, { waves: 4 }, 800, 160, { rock_crystal: 2 }),
  m("escort-botanist", "The botanist's walk", "escort", "outer", 2, { resident: "botanist", checkpoints: 3 }, 380, 75, { wood_branch: 4 }),
  m("escort-scholar", "Scholar to the shrine", "escort", "inner", 3, { resident: "scholar", checkpoints: 4 }, 750, 150, { rock_gold_nugget: 1, rock_crystal: 1 }),
];

/**
 * Guardian statue victory (row 21): coins and materials every time, and a
 * rare Epic or Legendary weapon the member doesn't own yet. Rolled on the
 * server (lib/combat/service.ts), paid once per boss kill and at most once
 * per cooldown, since kills are client-reported (ruling 3).
 */
export const BOSS_DROPS = {
  enemy: "guardian-statue",
  cooldown_hours: 20,
  coins: 150,
  materials: { rock_crystal: 2, rock_gold_nugget: 1 } as Record<string, number>,
  gear: [
    { rarity: "legendary", chance: 0.04, weapons: ["staff-heartstone"] },
    { rarity: "epic", chance: 0.2, weapons: ["sword-guardian", "bow-sentinel", "staff-sigil", "tome-warden"] },
  ],
};
export interface BossReward { coins: number; materials: Record<string, number>; weapon: string | null; rarity: "legendary" | "epic" | null }

/** One roll of the drop table: gear only from weapons not owned yet; a spent tier pays its chance as nothing extra. */
export function rollBossReward(owned: string[], random: () => number): BossReward {
  let r = random();
  for (const g of BOSS_DROPS.gear) {
    if (r < g.chance) {
      const open = g.weapons.filter((w) => !owned.includes(w));
      const weapon = open.length ? open[Math.floor(random() * open.length)] : null;
      return { coins: BOSS_DROPS.coins, materials: BOSS_DROPS.materials, weapon, rarity: weapon ? (g.rarity as BossReward["rarity"]) : null };
    }
    r -= g.chance;
  }
  return { coins: BOSS_DROPS.coins, materials: BOSS_DROPS.materials, weapon: null, rarity: null };
}
