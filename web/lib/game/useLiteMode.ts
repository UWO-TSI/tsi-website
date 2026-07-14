"use client";

/**
 * Lite mode (G4 follow-up).
 *
 * Persisted boolean in localStorage. When enabled, the game world skips:
 *  - PostFX (bloom + vignette)
 *  - AmbientLife particles (butterflies, fireflies, leaves, birds)
 *  - Ghost-replay quads
 *  - Distant clouds
 *
 * Auto-enabled on first visit if navigator.deviceMemory ≤ 4 GB
 * (covers Chromebooks + low-end laptops). Members can override either
 * way in settings.
 */

import { useEffect, useState } from "react";

const KEY = "tsi.liteMode.v1";
const AUTO_THRESHOLD_GB = 4;

interface DeviceMemoryNavigator extends Navigator {
  deviceMemory?: number;
}

function detectAutoLite(): boolean {
  if (typeof navigator === "undefined") return false;
  const dm = (navigator as DeviceMemoryNavigator).deviceMemory;
  return typeof dm === "number" && dm <= AUTO_THRESHOLD_GB;
}

export function useLiteMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR-safe init
        setEnabled(stored === "true");
        return;
      }
      // No stored value — auto-detect from deviceMemory.
      const auto = detectAutoLite();
       
      setEnabled(auto);
      localStorage.setItem(KEY, String(auto));
    } catch {
      /* ignore localStorage failures (private browsing, etc.) */
    }
  }, []);

  const set = (next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  return [enabled, set];
}
