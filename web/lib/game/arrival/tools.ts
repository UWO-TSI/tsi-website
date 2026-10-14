/**
 * The tool bag on a first arrival (playtest round 1, decision 5): a new player starts with nothing on the wheel (Tab)
 * and Bram hands over his rod at the beach. While the arrival runs, the wheel holds only what he has given; once the
 * walk-along is done (or left) the wheel is the usual one. Existing players never arrive again, so nothing changes for
 * them, and nothing here touches an inventory: it's what the wheel shows during the walk.
 */
import type { WheelItem } from "@/lib/game/toolWheel";

/** What the arrival lets onto the wheel: null when no arrival is running (the wheel as it always is). */
export type ArrivalTools = { rod: boolean } | null;

/** The wheel's contents under the arrival: nothing until Bram gives the rod, then the rod alone. */
export function gateWheel(items: readonly WheelItem[], tools: ArrivalTools): WheelItem[] {
  if (!tools) return [...items];
  return items.filter(i => i.kind === "rod" && tools.rod);
}
