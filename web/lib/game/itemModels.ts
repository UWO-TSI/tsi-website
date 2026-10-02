/**
 * The model an item is held by in front (a pin on the tool wheel, specs/game-ui.md §2) and its icon is rendered from:
 * our own fruit, rock and mushroom models (art/props-enemies/build_items.py), the shells' and the branch's props.
 * Fish and bugs aren't held up yet (specs/polish/README.md, waiting on David), so they can't be pinned.
 */
import { ROSTER } from "@/lib/collections/roster";

export interface ItemModel { url: string; /** Its size held in front, rig units (a fruit about a fist). */ fit: number }
const ITEMS = "/assets/game/items/";
const OWN = new Set([...ROSTER.filter(s => s.category === "fruit" || s.category === "mineral" || s.sub === "mushroom").map(s => s.key)]);
const SHELLS = new Map(ROSTER.filter(s => s.sub === "shell" && s.model).map(s => [s.key, s.model!]));

export function itemModel(key: string): ItemModel | null {
  if (OWN.has(key)) return { url: `${ITEMS}${key}.glb`, fit: key === "fruit_coconut" ? 0.19 : 0.16 };
  const shell = SHELLS.get(key);
  if (shell) return { url: shell, fit: 0.1 };
  if (key === "wood_branch") return { url: "/assets/game/props/branch.glb", fit: 0.2 };
  return null;
}
/** Only what can be held can be pinned to the wheel. */
export const pinnable = (key: string) => itemModel(key) !== null;
