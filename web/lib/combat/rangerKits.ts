/**
 * The Ranger family's four kits (classes v2, wave "Ranger"; specs/classes/design-sheet.md: Marksman, Sniper, Hunter and
 * Gunslinger LOCKED, the stat directions, the Oracle map and the build overrides). Keys 1–5 all equipped; the movement
 * key opens at mastery 3; mastery raises each class's stat direction and ranks its keys, the ult (10, 18) and the
 * passive (16). Numbers are in the §1.1 units (power × base hit, seconds, energy) and tuned by the v2 harness
 * (specs/evidence/classes/K-ranger-balance.md); each family wave tunes data only.
 *
 * Their basic attacks are their own (FireSpec, lib/game/combat/classFire.ts): the Marksman's Focus (1.5 → 8 shots a
 * second while you keep firing) and arrow drop, the Sniper's slow heavy shot and weak points, the Hunter's harpoon
 * bolts, the Gunslinger's six-round cylinder with its active reload. Their FX keys name recipes in
 * lib/game/fx/rangerFx.ts; clips are verbs on the weapon's grip or `Unique_*` / `Ult_*` (build_clips.py).
 */
import type { ClassKit } from "./classes";
import { GUNSLINGER } from "./ranger/gunslinger";
import { HUNTER } from "./ranger/hunter";
import { MARKSMAN } from "./ranger/marksman";
import { SNIPER } from "./ranger/sniper";

export { GUNSLINGER, HUNTER, MARKSMAN, SNIPER };
export const RANGER_KITS: ClassKit[] = [MARKSMAN, SNIPER, HUNTER, GUNSLINGER];
