/**
 * The drops (specs/v1-drop.md, "The roadmap"): what each release of the world switches on. One table, read by every
 * place a not-yet-released thing would otherwise show (a door, a prompt, a sheet, a key, a wheel slot, an objective,
 * a barrier), so v2 to v4 each flip on by raising one number.
 *
 * | Drop | Opens |
 * |---|---|
 * | 1 Arrival | the village: fishing, foraging, bugs, digging, the museum, the shop, crafting, the glider |
 * | 2 | the café and its study tables; the mountain (the rockslide cleared) and the Oracle temple at its top |
 * | 3 | combat: the ruins (the rubble and the dense forest edge cleared), missions, the classes UI, weapons on the wheel |
 * | 4 | personal islands: the home island boat and claiming your plot |
 *
 * The north island has no drop yet (David is still choosing the combat home, terrain-v2.md): its bridge stays unbuilt
 * until a drop is set for it here.
 *
 * Which drop is live: `NEXT_PUBLIC_GAME_DROP` (1-4, inlined at build time, so changing it needs a redeploy); unset or
 * unreadable, drop 1. Development previews another with `?drop=N` (never in production). The dev scene overrides
 * (`?cafe=inside`, `?ruins=1`, `?home=1`, `?temple=inside`) still open their scenes whatever the drop: they are how
 * the lab and the perf bench reach them.
 */
export type DropNumber = 1 | 2 | 3 | 4;

/** The drop each feature opens in (null: not scheduled yet). */
export const DROP_FEATURES = {
  /** The café's door and its study tables (and the café fund chapter that pointed at reopening it). */
  cafe: 2,
  /** The mountain trail past the rockslide. */
  mountain: 2,
  /** The Oracle temple (the class quiz) on the summit. */
  oracle: 2,
  /** The ruins gate, the mission board and the combat chapter. */
  combat: 3,
  /** The classes UI: the Path sheet (P), the class tag, the family and subclass auras. */
  classes: 3,
  /** Weapons on the tool wheel. */
  weapons: 3,
  /** The ruins rubble cleared from the entrance. */
  ruins: 3,
  /** The dense forest edge thinned (the way to the ruins). */
  forest: 3,
  /** The home island: the boat at the wharf and "Claim your plot". */
  homeIsland: 4,
  /** The north island's bridge: not scheduled. */
  northIsland: null,
  /** The new world's meadow (and the forest past it) beyond the invisible border (lib/game/barriers.ts "border"): not scheduled. */
  meadow: null,
} as const satisfies Record<string, DropNumber | null>;
export type DropFeature = keyof typeof DROP_FEATURES;
export type DropFlags = Record<DropFeature, boolean>;

/** Is `feature` released by drop `drop`? */
export function featureOn(feature: DropFeature, drop: DropNumber): boolean {
  const at: DropNumber | null = DROP_FEATURES[feature];
  return at !== null && drop >= at;
}

/** Every feature's switch at drop `drop`. */
export function dropFlags(drop: DropNumber): DropFlags {
  return Object.fromEntries((Object.keys(DROP_FEATURES) as DropFeature[]).map(f => [f, featureOn(f, drop)])) as DropFlags;
}

/** "2", "v2" → 2; anything else → null. */
export function parseDrop(value: string | null | undefined): DropNumber | null {
  const m = /^v?([1-4])$/i.exec((value ?? "").trim());
  return m ? (Number(m[1]) as DropNumber) : null;
}

/** The live drop: the dev preview `?drop=` (not in production), else the build's `NEXT_PUBLIC_GAME_DROP`, else 1. */
export function resolveDrop({ env, search, production }: { env: string | undefined; search: string; production: boolean }): DropNumber {
  const preview = production ? null : parseDrop(new URLSearchParams(search).get("drop"));
  return preview ?? parseDrop(env) ?? 1;
}

/** This build's drop, read once (a module constant: every reader agrees for the page's life). */
export const DROP: DropNumber = resolveDrop({
  env: process.env.NEXT_PUBLIC_GAME_DROP,
  search: typeof window === "undefined" ? "" : window.location.search,
  production: process.env.NODE_ENV === "production",
});

/** This build's switches. */
export const DROPS: DropFlags = dropFlags(DROP);

// ── Progression: goals, chapters and steps that point at a later drop ────────────────────────────────────────────────
/**
 * The regions club goals (`unlocks`) and chapters (`unlocks_regions`) open, by the feature that releases them. A goal
 * or chapter that opens any region of an unreleased feature is not offered yet (the café fund before the café's drop,
 * the ruins-gate chapter before combat's); regions not listed (the village core, the museum, the woods) are v1's.
 */
export const REGION_FEATURE: Readonly<Record<string, DropFeature>> = {
  cafe: "cafe", study_tables: "cafe",
  cliffs: "mountain", mountain: "mountain", oracle: "oracle",
  ruins_gate: "combat", ruins: "combat",
  home: "homeIsland", home_island: "homeIsland",
};
/** Chapter steps that need a feature: claiming your plot is the home island's. */
export const STEP_FEATURE: Readonly<Record<string, DropFeature>> = { claim_plot: "homeIsland" };

export const regionReleased = (region: string, flags: DropFlags = DROPS) => !REGION_FEATURE[region] || flags[REGION_FEATURE[region]];

/** The club goals this drop offers (the rest wait for theirs; their progress is kept). */
export function releasedGoals<G extends { unlocks: readonly string[] }>(goals: readonly G[], flags: DropFlags = DROPS): G[] {
  return goals.filter(g => g.unlocks.every(r => regionReleased(r, flags)));
}

/**
 * The quest chapters this drop offers, each with the steps it can't take yet listed in `hidden_steps` (counted as done
 * where they gate the chapter's end; lib/progression/chapters.ts evaluateChapters).
 */
export function releasedChapters<C extends { unlocks_regions: readonly string[] }>(chapters: readonly C[], flags: DropFlags = DROPS): (C & { hidden_steps?: string[] })[] {
  const hidden = Object.entries(STEP_FEATURE).filter(([, f]) => !flags[f]).map(([k]) => k);
  return chapters.filter(c => c.unlocks_regions.every(r => regionReleased(r, flags))).map(c => (hidden.length ? { ...c, hidden_steps: hidden } : c));
}
