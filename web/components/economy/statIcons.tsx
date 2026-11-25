/**
 * The rod's six stats as the UI shows them (lib/game/rods.ts STAT_KEYS): each stat's icon, for the rod's radar, the
 * menu's dishes and the HUD's buff (tasting-book r3, David: "use term like luck and the other 5 criteria").
 */
import type { ReactNode } from "react";
import { Clover, Link, Magnet, MoveHorizontal, RefreshCw, Timer } from "lucide-react";
import { STAT_INFO, STAT_KEYS, type RodStat } from "@/lib/game/rods";

export const STAT_ICON: Record<RodStat, ReactNode> = {
  luck: <Clover />, bite: <Timer />, strength: <Link />, reel: <RefreshCw />, lure: <Magnet />, control: <MoveHorizontal />,
};
/** A meal's stats, in the rod's order: each its icon, its name and its share ("+10%"). */
export const mealRows = (b: Partial<Record<RodStat, number>>) =>
  STAT_KEYS.flatMap(k => (b[k] ? [{ key: k, icon: STAT_ICON[k], label: STAT_INFO[k].label, value: `+${Math.round(b[k] * 100)}%` }] : []));
