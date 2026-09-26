"use client";

import { useEffect } from "react";
import { AudioManager } from "./audio";
import { musicBlockAt, type MusicOverride } from "./musicSchedule";
import type { Season } from "./season";

/**
 * Keeps `AudioManager`'s music channel following the real Toronto clock
 * (rows 84, 106, 112-114): picks the current 2-hour block, re-checks every
 * minute (same cadence as `useIslandConditions`'s clock tick — a 2-hour
 * boundary doesn't need finer scheduling), and swaps in the cafe/interior
 * override whenever the player is indoors.
 */
export function useMusicDirector({ season, override = null }: { season?: Season; override?: MusicOverride }): void {
  useEffect(() => {
    const apply = () => AudioManager.setMusic({ block: musicBlockAt(), season, override });
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [season, override]);
}
