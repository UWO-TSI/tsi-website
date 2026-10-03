/**
 * The Arcane family's four v2 kits (specs/classes/design-sheet.md: Elementalist, Illusionist, Necromancer and Transmuter
 * LOCKED, the stat directions and the build overrides), as data the one ability system runs: today's effect primitives
 * plus classes v2's shared ones (lib/game/combat/primitives.ts).
 */
import { ELEMENTALIST } from "./arcane/elementalist";
import { ILLUSIONIST } from "./arcane/illusionist";

export { ELEMENTALIST, ILLUSIONIST };
export const ARCANE_KITS = [ELEMENTALIST, ILLUSIONIST];
