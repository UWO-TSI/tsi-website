/**
 * The game's performance budget (specs/perf/budget.md): what a scene, a character, an effect, an asset and a player on
 * the network may cost. The numbers come from the October 2026 measurements (specs/perf/2026-10-results.md,
 * specs/perf/effects-cost.md) with headroom for a full shard of 40 players. Two checks hold them:
 * - budget.test.ts (the normal vitest gate): every shipped GLB within its category, every particle pool registered and
 *   within its cap, no light in a character effect, LOD coverage, the network rates;
 * - `npm run perf:check` (specs/perf/perf-check.mjs): the bench scenes on a production build against
 *   specs/perf/baseline.json, failing on a regression over 10% in frame time or draw calls.
 *
 * Frame numbers are on the reference machine (Mac mini M4, Chrome, 1280 × 800 at DPR 1, the pixel finish on), uncapped:
 * the median frame and the main thread's frame CPU. The member floor is a 60 FPS frame (16.7 ms) on an M1 / Iris Xe
 * class laptop, about 2–2.5× slower than the reference in GPU and 1.6× in single-thread CPU; so the reference must
 * stay under ~6 ms a frame on High (Lite's machines are slower still: 4 ms).
 */

/** Per scene and tier: the ceilings the bench scenes are held to (reference machine, uncapped). */
export interface SceneBudget {
  /** Median frame (ms). */
  frameMs: number;
  /** 95th-percentile frame (ms). */
  p95Ms: number;
  /** The probe's frame CPU (ms): first frame callback to the end of the render. */
  cpuMs: number;
  /** Draw calls a frame, every pass. */
  draws: number;
  /** Triangles a frame, every pass. */
  triangles: number;
  /** Longest frame within 1.5 s of an ult (ms), at the display's pace; fights only. */
  ultHitchMs?: number;
}
export type SceneName = "village" | "v2" | "cafe" | "ruins";
export type Tier = "high" | "lite";

/**
 * Village: 24 players (?bots=24) and the residents, at the spawn. v2: the terrain v2 world draft (?fixture=v2, 384 ×
 * 552) with the same 24. Café: inside with its patrons and 24 bots. Ruins: a pack of 17 hunting you, the kit on a loop
 * and Shadow Garden's ults. Today's medians are specs/perf/baseline.json; each budget leaves room for a full shard of
 * 40 (at most 3 more drawn players and 16 more interpolated ones: specs/perf/budget.md "Headroom") and for content,
 * under the floor machine's ceiling (frame ≤ 6 ms here on High, ≤ 4 ms on Lite).
 */
export const SCENE_BUDGET: Record<SceneName, Record<Tier, SceneBudget>> = {
  village: {
    high: { frameMs: 6, p95Ms: 9, cpuMs: 5, draws: 560, triangles: 620_000 },
    lite: { frameMs: 4, p95Ms: 6, cpuMs: 3.5, draws: 420, triangles: 420_000 },
  },
  v2: {
    high: { frameMs: 6.5, p95Ms: 10, cpuMs: 6, draws: 760, triangles: 1_200_000 },
    lite: { frameMs: 4, p95Ms: 6, cpuMs: 3.5, draws: 560, triangles: 950_000 },
  },
  cafe: {
    high: { frameMs: 4, p95Ms: 6, cpuMs: 2.5, draws: 180, triangles: 110_000 },
    lite: { frameMs: 2.5, p95Ms: 4.5, cpuMs: 1.5, draws: 140, triangles: 90_000 },
  },
  ruins: {
    high: { frameMs: 5, p95Ms: 10, cpuMs: 4, draws: 480, triangles: 280_000, ultHitchMs: 40 },
    lite: { frameMs: 3.5, p95Ms: 7, cpuMs: 2.5, draws: 290, triangles: 210_000, ultHitchMs: 33 },
  },
};

/** The shard (specs/multiplayer.md §4): what the scene budgets leave room for. */
export const SHARD = { players: 40, fullHigh: 12, fullLite: 8, drawnHigh: 24, drawnLite: 16, auras: 8, plates: 12 } as const;

/**
 * One character, by its detail tier (lib/game/character/lod.ts and net/lod.ts). Triangles are the merged look (base
 * skin and face plus every worn part), before anything held; draws are its own meshes in the scene pass (the body,
 * the face, the print), shadow draws those again in the sun's map; materials are the shared body material and any
 * held item's.
 */
export interface CharacterBudget { triangles: number; draws: number; shadowDraws: number; materials: number; bones: number; mixerHz: number }
export const CHARACTER_BUDGET: Record<"full" | "lod1" | "lod2" | "reduced", CharacterBudget> = {
  /** Within 21 u, or any Full remote: the whole look, every frame, the sun shadow. head-roblox: the hairstyles' original
   * meshes (up to 4,315 with the under-cap) put the heaviest wearable look at 7,700. Wardrobe batch 2 (David, 2026-10-17:
   * the budget stays; "find ways to lower triangles that aren't displayed"): hidden inner geometry cut from every
   * hairstyle and Roblox accessory, a covering hat drawing none of the hair it hides, and the accessories' Full meshes
   * no heavier than what shows (art/characters/hidden_cut.py, import_roblox.py full_cap) keep it at 7,567. */
  full: { triangles: 7800, draws: 3, shadowDraws: 2, materials: 1, bones: 22, mixerHz: 60 },
  /** Past 21 u and under 72 px: LOD 1 parts (art/characters/build_lod.py), the hairstyles within 2,400: 5,014 at most. */
  /** Wardrobe batch 2: 4,963 (the Roblox accessories' LOD 1 at 300, the glasses' at 250, hidden geometry cut). */
  lod1: { triangles: 5100, draws: 3, shadowDraws: 2, materials: 1, bones: 22, mixerHz: 30 },
  /** Past 40 u and under 28 px (lod.ts `far`): the hairstyles' LOD 2 (about 1,100), every other part its LOD 1: 3,958 at most. */
  /** Wardrobe batch 2: 3,947. */
  lod2: { triangles: 4000, draws: 3, shadowDraws: 2, materials: 1, bones: 22, mixerHz: 15 },
  /** A Reduced remote: no sun shadow, the mixer at 15 Hz (drawn at LOD 1 or 2 by its distance). */
  reduced: { triangles: 5100, draws: 3, shadowDraws: 0, materials: 1, bones: 22, mixerHz: 15 },
};
/** What one more player in view may add to a frame (specs/multiplayer.md §5.5 targets, kept). */
export const PER_PLAYER = { fullCpuMs: 0.12, drawnCpuMsTotal24: 3, drawsHigh: 5, drawsLite: 3 } as const;

/**
 * Character effects (specs/perf/effects-cost.md): an effect's share, what it may add when every Full player in view
 * shows it (12 on High). `drawsPerPlayer` for what a player carries (scene and shadow passes together; 0 for the
 * scene's shared pools and DOM overlays); `cpuMs` main-thread time per frame for all 12; `particles` alive from one
 * player's effect at once; `lights` always 0 (a light appearing recompiles every lit material:
 * specs/perf/2026-10-baseline.md item 2).
 */
export interface EffectBudget { drawsPerPlayer: number; cpuMs: number; particles: number; lights: 0 }
export const EFFECT_BUDGET: Record<string, EffectBudget> = {
  auraSubclass: { drawsPerPlayer: 2, cpuMs: 0.15, particles: 11, lights: 0 },
  auraFamily: { drawsPerPlayer: 2, cpuMs: 0.1, particles: 7, lights: 0 },
  dust: { drawsPerPlayer: 0, cpuMs: 0.15, particles: 12, lights: 0 },
  juice: { drawsPerPlayer: 0, cpuMs: 0.2, particles: 24, lights: 0 },
  ghost: { drawsPerPlayer: 2, cpuMs: 0.15, particles: 0, lights: 0 },
  leaf: { drawsPerPlayer: 2, cpuMs: 0.25, particles: 0, lights: 0 },
  held: { drawsPerPlayer: 2, cpuMs: 0.25, particles: 0, lights: 0 },
  weapon: { drawsPerPlayer: 2, cpuMs: 0.25, particles: 0, lights: 0 },
  rod: { drawsPerPlayer: 2, cpuMs: 0.25, particles: 0, lights: 0 },
  fishing: { drawsPerPlayer: 4, cpuMs: 0.3, particles: 20, lights: 0 },
  plates: { drawsPerPlayer: 0, cpuMs: 0.25, particles: 0, lights: 0 },
  shadows: { drawsPerPlayer: 2, cpuMs: 0.25, particles: 0, lights: 0 },
  emotes: { drawsPerPlayer: 0, cpuMs: 0.15, particles: 0, lights: 0 },
  interp: { drawsPerPlayer: 0, cpuMs: 0.1, particles: 0, lights: 0 },
  /** Group dancing (components/game/dance/DanceSync.tsx): the beat sync and a note every other beat from the shared movement pool. */
  dance: { drawsPerPlayer: 0, cpuMs: 0.15, particles: 2, lights: 0 },
};

/**
 * Particle pools (the scene's fixed capacities: nothing allocated as effects fire). Every `new ParticlePool(` in the
 * code is listed here with the most its file may hold in all; budget.test.ts reads the sources, so a new pool fails
 * until it is registered.
 */
export const PARTICLE_POOLS: Record<string, number> = {
  "components/game/movement/moveFx.ts": 544, // movement juice 384, footprints 160: shared by every avatar in a scene
  "components/game/GlowFx.tsx": 160,
  "components/game/combat/CombatFx.tsx": 1040, // glow 768, ink 256, decals 16 (fx/combat.ts FX_POOLS)
  "components/game/combat/MobFx.tsx": 360,
  "components/game/oracle/CandleFire.tsx": 48,
  "components/game/campfire/Campfire.tsx": 64, // the beach fire's tongues and embers (about 40 alive with eight dancers)
};
/** Particles one movement event may throw (one avatar, juice amount 1): the heaviest today is a heavy landing on grass, 19. */
export const JUICE_EVENT_PARTICLES = 24;

/**
 * Per player on the network (specs/multiplayer.md §4.3): the pose stream up (msgpack arrays at 10 Hz on the ground, 15
 * while a move is set, an extra packet per event at most every 30 ms), and down: everyone else in your view relayed,
 * a full shard of the busiest mover. Measured on the bots (budget.test.ts): at most 272 B/s and 9.9 packets a second.
 */
export const NETWORK_BUDGET = { upBytesPerSecond: 600, packetsPerSecond: 16, downBytesPerSecond: 16 * 1024 } as const;

/** Files whose effects draw on characters: never a light in them. */
export const CHARACTER_EFFECT_FILES = [
  "components/game/oracle/FamilyAura.tsx", "components/game/oracle/SubclassAura.tsx", "components/game/movement/moveFx.ts",
  "components/game/character/Character.tsx", "components/game/character/FishingRig.tsx", "components/game/net/RemoteAvatars.tsx",
  "components/game/net/RemoteAvatar.tsx", "components/game/net/RemoteAuras.tsx", "components/game/net/Nameplates.tsx", "components/game/net/fx.ts",
  "components/game/PlayerAvatar.tsx", "components/game/dance/DanceSync.tsx",
] as const;

/**
 * Asset budgets by folder under web/public/assets (the first matching prefix wins). A GLB over its category fails
 * budget.test.ts naming the asset and the budget; an existing asset over the line is listed in ASSET_EXCEPTIONS with
 * its own cap (its numbers today), so it can't grow either.
 */
export interface AssetBudget { triangles: number; primitives: number; materials: number; texture: number; bones: number }
export interface AssetCategory extends AssetBudget { name: string; prefixes: readonly string[] }
export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  // head-roblox (David, 2026-10-14: "lower poly like 2400 triangles for hair when far ... but hair should look good close
  // up"): a whole hairstyle's LOD 1 holds its curves within 2,400 and its far LOD 2 within 1,200 (art/characters/build_lod.py).
  { name: "LOD 1 hairstyle", prefixes: ["characters/v6/lod1/hair/full/"], triangles: 2400, primitives: 1, materials: 1, texture: 0, bones: 22 },
  { name: "LOD 2 hairstyle", prefixes: ["characters/v6/lod2/"], triangles: 1200, primitives: 1, materials: 1, texture: 0, bones: 22 },
  { name: "character LOD 1 part", prefixes: ["characters/v6/lod1/"], triangles: 1200, primitives: 4, materials: 4, texture: 256, bones: 22 },
  { name: "character base", prefixes: ["characters/v6/base/"], triangles: 2000, primitives: 8, materials: 6, texture: 1024, bones: 22 },
  // A whole hairstyle (David's set, characters/v6/hair/full) replaces the bangs and the back together (look.ts wornParts).
  // head-roblox: Full is the original Roblox mesh, undecimated (Roblox caps an accessory at 4,000; David's run 609-4,000),
  // plus the under-cap (up to ~320): 4,400. One primitive and one material (its cap and second colour are mask channels
  // in the shared atlas).
  { name: "full hair", prefixes: ["characters/v6/hair/full/"], triangles: 4400, primitives: 1, materials: 1, texture: 0, bones: 22 },
  { name: "hair", prefixes: ["characters/v6/hair/"], triangles: 1200, primitives: 1, materials: 1, texture: 0, bones: 22 },
  { name: "accessory", prefixes: ["characters/v6/accessories/"], triangles: 1200, primitives: 4, materials: 4, texture: 128, bones: 22 },
  { name: "outfit", prefixes: ["characters/v6/outfits/"], triangles: 300, primitives: 4, materials: 4, texture: 128, bones: 22 },
  { name: "weapon", prefixes: ["game/weapons/"], triangles: 1000, primitives: 8, materials: 8, texture: 256, bones: 0 },
  { name: "tool", prefixes: ["game/tools/"], triangles: 600, primitives: 5, materials: 5, texture: 256, bones: 0 },
  { name: "effect", prefixes: ["game/props/"], triangles: 3000, primitives: 6, materials: 6, texture: 512, bones: 0 },
  { name: "enemy", prefixes: ["game/enemies/"], triangles: 1500, primitives: 16, materials: 8, texture: 512, bones: 0 },
  { name: "interior room", prefixes: ["game/cafe/", "game/interiors/"], triangles: 12_000, primitives: 24, materials: 24, texture: 1024, bones: 0 },
  { name: "building", prefixes: ["acnh/buildings/", "buildings/", "game/buildings/", "game/wharf/"], triangles: 12_000, primitives: 10, materials: 10, texture: 1024, bones: 0 },
  // game/wharf-art2 (art/water/build_coral_reefs.py): a reef is a dozen of the coral clumps on rocks in one mesh and one
  // plain material, one draw where the clumps it stands in for were each their own prop. Before the seabed row: first match wins.
  { name: "coral reef", prefixes: ["game/water/coral-reef-"], triangles: 3000, primitives: 1, materials: 1, texture: 0, bones: 0 },
  // v1 water (2026-10-13): the seabed's kinds and the decorative fish, each node drawn instanced (one draw per kind
  // however many lie in reach), so primitives are the scene's draws for the whole seabed.
  { name: "seabed and water life", prefixes: ["game/water/"], triangles: 1200, primitives: 10, materials: 6, texture: 256, bones: 0 },
  // game/remodel-nature (art/nature): the beach and woods pickups, each one closed smooth mesh, one material (the shells
  // wear a painted texture, game/remodel-r2).
  { name: "shore and forage", prefixes: ["game/forage/mushroom-", "game/forage/shell-"], triangles: 2000, primitives: 1, materials: 1, texture: 256, bones: 0 },
  // game/remodel-r2 (art/nature/close_bushes.py): the dump's bushes closed all round, one primitive on the dump's leaf texture.
  { name: "closed bush", prefixes: ["game/plants/bush-"], triangles: 1000, primitives: 1, materials: 1, texture: 128, bones: 0 },
  // game/village-art2 (art/trees/build_shrubs.py): the new world's wild shrubs, lobes of leaf cards on the summer atlas
  // (one cut-out material) and their twigs in colour.
  { name: "shrub", prefixes: ["game/plants/shrub-"], triangles: 1200, primitives: 2, materials: 2, texture: 256, bones: 0 },
  // game/village-art2 (art/props/build_river_set.py): reeds and cattails, blades in colour, one material.
  { name: "reeds", prefixes: ["game/plants/reeds-"], triangles: 800, primitives: 1, materials: 1, texture: 0, bones: 0 },
  // game/remodel-trees (art/trees): our trees, leaf or needle cards over closed volumes on a trunk, drawn instanced: the
  // cards with their volume (one cut-out material on the painted atlas) and the bark in colour, the crown's hull and the
  // trunk only in the sun's map. Triangles count all four; the far model (.lod1) is held under half the near one
  // (natureLod.test.ts).
  { name: "tree", prefixes: ["game/plants/tree-", "game/plants/conifer-"], triangles: 3200, primitives: 4, materials: 4, texture: 512, bones: 0 },
  // game/trees-art (art/trees/build_forest_trees.py): the closed forest's single low-poly trees, instanced by the
  // hundred: the crown on one small painted texture and the trunk in colour.
  { name: "forest tree", prefixes: ["game/plants/forest-tree-"], triangles: 400, primitives: 2, materials: 2, texture: 256, bones: 0 },
  // game/trees-art: the few riverbank trees, richer (a willow's hanging sprays, many-lumped crowns) on the same texture.
  { name: "river tree", prefixes: ["game/plants/river-tree-"], triangles: 1200, primitives: 2, materials: 2, texture: 256, bones: 0 },
  // game/remodel-trees (art/trees/build_flowers.py): a clump of stems with petal cards, one cut-out material on the
  // painted petal atlas, one draw for every flower of its kind.
  { name: "flower", prefixes: ["game/plants/flower-"], triangles: 600, primitives: 1, materials: 1, texture: 512, bones: 0 },
];
/** Shipped before the budget, over their category: each capped where it is today. Shrink, never raise. */
export const ASSET_EXCEPTIONS: Record<string, Partial<AssetBudget> & { why: string }> = {
  "game/weapons/tanto-gilt.glb": { primitives: 12, why: "twin blades in 12 parts: 24 draws with its shadow on each Full player holding it" },
  "game/weapons/tanto-lotus.glb": { primitives: 12, why: "twin blades in 12 parts" },
  "game/weapons/tanto-rune.glb": { primitives: 10, why: "twin blades in 10 parts" },
  "game/weapons/aegis-dawn.glb": { primitives: 10, why: "shield and blade in 10 parts" },
  "game/weapons/aegis-gilt.glb": { primitives: 10, why: "shield and blade in 10 parts" },
  "game/weapons/handwraps-gilt.glb": { primitives: 10, why: "two hands' wraps in 10 parts" },
  "game/weapons/handwraps-sun.glb": { primitives: 10, why: "two hands' wraps in 10 parts" },
  "game/weapons/tooth-charm-4.glb": { primitives: 9, materials: 9, why: "tier-4 charm, a material per part" },
  "game/weapons/tooth-charm-5.glb": { primitives: 10, materials: 10, why: "tier-5 charm, a material per part" },
  "game/cafe/cafe-room.glb": { triangles: 34_170, primitives: 48, materials: 33, why: "the café interior, one room drawn alone: 48 draws" },
  "game/interiors/kit.glb": { primitives: 35, why: "the interiors' shared kit; pieces are drawn one by one" },
  // The shop is two floors (David asked for it bigger, specs/interiors/shop.md): each floor is its own room model.
  "game/interiors/shop/ground.glb": { triangles: 17_088, why: "the shop's approved ground floor, one floor of a two-floor room: 2.70 ms high at the shop's perf check" },
  "game/interiors/shop/mezz.glb": { triangles: 18_244, why: "the shop's furnished mezzanine (the merch level), the second floor: 2.70 ms high at the shop's perf check" },
  // HQ is two tall storeys, 24 x 18 since phase 4 (specs/interiors/hq.md, row 316; layout B, the gallery; David,
  // 2026-10-22: "the building can be built a little bigger"), about three and a half times the shop's floor: each storey
  // is its own model. Phase 4 rose on David's notes (the sectional, beanbags, the study's six monitors and chairs, more
  // plants and lamps, rounder cushions) in a room 35% bigger: hq perf check, specs/evidence/hq-interior/phase4/.
  "game/interiors/hq/ground.glb": { triangles: 36_776, why: "HQ's ground floor: the walls both storeys high (9.2), the entry and the window nook, the hall's big lounge (the sectional, beanbags), the floor under both arms, the library wall (about 5.8k of books)" },
  "game/interiors/hq/upper.glb": { triangles: 28_140, primitives: 32, why: "HQ's upper floor in three parts (the bridge's big lounge, the left arm's study, the right arm), each cut away on its own: a part's materials draw once per part" },
  "game/buildings/cafe.glb": { primitives: 34, materials: 25, why: "the café exterior: 34 draws in the village, the most of any building" },
  "game/buildings/sushi-bar.glb": { triangles: 25_000, why: "the sushi bar made Japanese (David, phase A rounds 2 and 3): a kawara roof of round tiles with turned-up corners and golden fish on its ridge, the counter seen up close from the stools (the fish case and its fish, the boards, the guests' places, the sake bottles and menu tags); still, merged with the props, 8 draws, new world only" },
  // Dump models David kept and we only retouched (row 314, art/props/derive_*.py): their own geometry and textures.
  "game/props/beach-parasol.glb": { triangles: 4740, why: "the dump's parasol and two loungers kept as they were, recoloured only (one draw)" },
  "game/props/hq-notice-board.glb": { texture: 768, why: "the dump's metal HQ board kept with its own 768 x 384 atlas, the notes made plain; one board, indoors" },
};
