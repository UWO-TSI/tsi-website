"use client";

import { useEffect, useRef, type RefObject } from "react";

const INTERVAL_MS = 30_000;
const MIN_DELTA = 0.5;
const FORCE_INTERVAL_MS = 5 * 60_000;

/**
 * Writes the current user's position to player_positions every 30s.
 * Only writes when player has moved > MIN_DELTA units since last send,
 * OR when stale > FORCE_INTERVAL_MS (so idle players still register
 * a recent heartbeat for ghost-replay).
 */
export function usePositionHeartbeat(
  positionRef: RefObject<{ x: number; z: number } | null>,
): void {
  const lastSent = useRef({ x: 0, z: 0, at: 0 });

  useEffect(() => {
    const tick = async () => {
      const pos = positionRef.current;
      if (!pos) return;
      const now = Date.now();
      const dx = pos.x - lastSent.current.x;
      const dz = pos.z - lastSent.current.z;
      const moved = Math.hypot(dx, dz) > MIN_DELTA;
      const stale = now - lastSent.current.at > FORCE_INTERVAL_MS;
      if (!moved && !stale) return;

      try {
        const res = await fetch("/api/positions/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ world_x: pos.x, world_z: pos.z }),
        });
        if (res.ok) lastSent.current = { x: pos.x, z: pos.z, at: now };
      } catch {
        /* swallow — heartbeat is best-effort */
      }
    };

    const id = setInterval(tick, INTERVAL_MS);
    return () => clearInterval(id);
  }, [positionRef]);
}
