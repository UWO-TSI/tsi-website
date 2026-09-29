/**
 * Which collection items count as museum specimens vs building materials.
 * Specimens: fish, sea creatures, shore finds, bugs. Materials: everything
 * else a member gathers (fruit, flowers...). Assumption logged in
 * specs/progression-questions.md until real materials (wood, stone) exist.
 */
import type { DeliveryKind } from "./types";

const SPECIMEN_PREFIXES = ["fish_", "sea_", "shore_", "bug_"];
const NOT_DELIVERABLE_PREFIXES = ["rod_", "bobber_", "gear_"];

export function itemDeliveryKind(itemKey: string): Exclude<DeliveryKind, "coins"> | null {
  if (!/^[a-z0-9_]{1,64}$/.test(itemKey)) return null;
  if (NOT_DELIVERABLE_PREFIXES.some((p) => itemKey.startsWith(p))) return null;
  return SPECIMEN_PREFIXES.some((p) => itemKey.startsWith(p)) ? "specimen" : "material";
}

export function itemLabel(itemKey: string): string {
  const bare = itemKey.replace(/^(fish|sea|shore|bug|flower|fruit)_/, "");
  return bare.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
