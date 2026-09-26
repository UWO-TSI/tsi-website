/**
 * Ruins roster and missions (rows 208, 213, 228, 230, 231). Content, mirrored
 * as seed rows in 035_combat.sql (enemy_types, missions); placeholder numbers.
 * Fixed levels per zone, no scaling (row 230).
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
  defense: number; // 0..0.8
  aggro_radius: number;
  attack_range: number;
  leash_radius: number;
  xp: number;
  behaviour: string; // what the telegraphs teach (row 51)
}

const e = (key: string, name: string, kind: EnemyKind, zone: Zone, level: number, hp: number, damage: number, defense: number, aggro: number, range: number, xp: number, behaviour: string): EnemyType => ({
  key, name, kind, zone, level, hp, damage, defense, aggro_radius: aggro, attack_range: range, leash_radius: aggro * 3, xp, behaviour,
});

export const ENEMIES: EnemyType[] = [
  e("shadow-fox", "Shadow fox", "normal", "outer", 4, 60, 8, 0, 7, 1.5, 30, "Telegraphed pounce; dodge sideways."),
  e("thorn-crab", "Thorn crab", "normal", "outer", 5, 90, 10, 0.3, 4, 1.2, 35, "Slow; armoured front, soft back."),
  e("mushroom-beast", "Mushroom beast", "normal", "outer", 6, 110, 9, 0.1, 5, 4, 40, "Spore cloud at range; step out of it."),
  e("rune-wisp", "Rune wisp", "normal", "inner", 9, 80, 14, 0, 9, 8, 60, "Floats; fires rune bolts from range."),
  e("animated-book", "Animated book", "normal", "inner", 10, 120, 13, 0.2, 6, 2, 65, "Snapping charge after a page flutter."),
  e("stone-golem", "Stone golem", "elite", "inner", 12, 420, 22, 0.45, 6, 2.5, 220, "Ground slam telegraph; wide recovery window."),
  e("elder-thorn-crab", "Elder thorn crab", "elite", "outer", 8, 300, 16, 0.4, 5, 1.8, 160, "Spins its shell; only the back takes full damage."),
  e("guardian-statue", "Guardian statue", "boss", "boss", 15, 2400, 30, 0.35, 14, 3, 1200, "Charge, rune projectiles and a floor sigil; long recovery after the sigil for an incantation."),
];

export type Template = "hunt" | "fetch" | "survive" | "escort";
export interface MissionDef {
  key: string;
  title: string;
  template: Template;
  zone: Zone;
  params: Record<string, string | number>;
  rewards: { xp: number; coins: number };
  cooldown_hours: number; // repeatable after this (row 24)
}
const m = (key: string, title: string, template: Template, zone: Zone, params: MissionDef["params"], xp: number, coins: number, cooldown_hours = 20): MissionDef => ({
  key, title, template, zone, params, rewards: { xp, coins }, cooldown_hours,
});

/** Ten missions across the four templates (row 231). */
export const MISSIONS: MissionDef[] = [
  m("hunt-foxes", "Fox trouble", "hunt", "outer", { enemy: "shadow-fox", count: 6 }, 300, 60),
  m("hunt-crabs", "Crab season", "hunt", "outer", { enemy: "thorn-crab", count: 5 }, 320, 60),
  m("hunt-wisps", "Put out the wisps", "hunt", "inner", { enemy: "rune-wisp", count: 6 }, 600, 110),
  m("hunt-golem", "Break the golem", "hunt", "inner", { enemy: "stone-golem", count: 1 }, 700, 150),
  m("fetch-lantern", "The lost lantern", "fetch", "outer", { item: "old-lantern", chamber: "fox-den" }, 350, 70),
  m("fetch-tome", "An overdue book", "fetch", "inner", { item: "sealed-tome", chamber: "library" }, 650, 120),
  m("survive-circle", "Hold the rune circle", "survive", "outer", { waves: 3 }, 400, 80),
  m("survive-sanctum", "Sanctum watch", "survive", "inner", { waves: 5 }, 800, 160),
  m("escort-botanist", "The botanist's walk", "escort", "outer", { resident: "botanist", checkpoints: 3 }, 380, 75),
  m("escort-scholar", "Scholar to the shrine", "escort", "inner", { resident: "scholar", checkpoints: 4 }, 750, 150),
];
