/**
 * The boss creatures a legendary or divine catch becomes (specs/launch/v1-gameplay.md, "Fish tiers and fights"): a
 * legendary surfaces as a creature about a building tall, a divine as something far bigger. David's creatures are
 * drafts for a later launch, so only the two generic placeholders exist; a real one is a row here (and its model), and
 * the fish that summons it names its `id`.
 *   scale   its height over the water (world units), which sizes the cutscene's shot and the splash;
 *   phases  how many phases its fight has (the boss reel's are three, lib/game/fishingReel.ts bossPhase).
 */
export interface BossCreatureDef { id: string; name: string; tier: "legendary" | "divine"; scale: number; phases: number }

export const BOSS_CREATURES: readonly BossCreatureDef[] = [
  { id: "placeholder-legendary", name: "Placeholder", tier: "legendary", scale: 13, phases: 3 },
  { id: "placeholder-divine", name: "Placeholder", tier: "divine", scale: 34, phases: 3 },
];

/** The creature a tier's catch surfaces as, until species name their own. */
export const creatureFor = (tier: BossCreatureDef["tier"]) => BOSS_CREATURES.find((c) => c.tier === tier)!;
