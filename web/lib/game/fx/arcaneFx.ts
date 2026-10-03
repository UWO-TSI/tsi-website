/**
 * The Arcane family's effects (design sheet §1.7, the LOCKED kits): recipes for the FX registry (combat.ts spreads them
 * in), built from the combat pack's rows (the wave-0 base rows and the Arcane rows: flame, droplet, wave, petal, cloud,
 * card, shard, bone, skull, beast), FxMaterial meshes, ground decals and, for the ults, a pooled light. Every recipe
 * stays inside its tier's budget (combat.test.ts); colour comes from the event's ramp (an element's, or the kit's).
 */
import type { FxRecipe } from "./combat";
import { ELEMENTALIST_FX } from "./arcane/elementalist";

export const ARCANE_FX: Record<string, FxRecipe> = { ...ELEMENTALIST_FX };
