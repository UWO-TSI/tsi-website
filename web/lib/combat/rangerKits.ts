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

/**
 * The family's weapon skins (the seed's weapon_skin rows, by `${subclass}:${cosmetic.skin}`) as colours by the weapons'
 * material names (art/props-enemies/build_ranger_weapons.py: M_Wood, M_Dark, M_Wrap, M_String, M_Fit, M_Iron), every
 * tier: classes.ts WEAPON_SKINS, painted in hand by primitives.ts signaturePaint.
 */
export const RANGER_SKINS: Record<string, Record<string, string>> = {
  "marksman:fletcher": { M_Wood: "#e9dfc8", M_Dark: "#bcae8e", M_Wrap: "#3d8fb8", M_String: "#eef6f8" }, // pale ash limbs, sea-blue fletching
  "sniper:longshot": { M_Fit: "#d0a94e", M_Iron: "#b8913f", M_Wood: "#4b2f1f", M_Dark: "#2e1c13" }, // polished brass, dark walnut
  "hunter:whalebone": { M_Wood: "#ece3cf", M_Dark: "#d4c8ad", M_String: "#2b2522", M_Iron: "#3a3330" }, // a bone-white stock, a tarred chain
  "gunslinger:pearl": { M_Wood: "#f1ece4", M_Iron: "#2e3c5e", M_Dark: "#222b42", M_Fit: "#9aa9bd" }, // a pearl grip, a blued barrel
  "gunslinger:starfire": { M_Iron: "#1c2340", M_Fit: "#ffcf6a", M_Wood: "#3b2a1f" }, // night-blue steel, star-gold fittings
};
