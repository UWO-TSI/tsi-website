"use client";

/**
 * Per-device graphics settings (G4 + G5 follow-up, 2026-06-01).
 *
 * Persisted to localStorage. Auto-detects sane defaults from
 * navigator.deviceMemory:
 *   - ≤4 GB: lite mode auto-on (no PostFX, no clouds, no ambient life,
 *            no ghosts)
 *   - ≥8 GB: bloom auto-on (the polish that ate ~12 FPS on 4GB devices
 *            is fine on bigger ones)
 *
 * Members can override either way via the in-game settings panel.
 */

import { useEffect, useState } from "react";

interface DeviceMemoryNavigator extends Navigator {
  deviceMemory?: number;
}

// Keys aligned with existing per-feature hooks (useLiteMode,
// useGhostReplaySetting) so the panel + the individual hooks see the
// same value.
const KEYS = {
  liteMode: "tsi.liteMode.v1",
  bloom: "tsi.bloom.v1",
  shadows: "tsi.shadows.v1",
  ghosts: "tsi.ghosts.enabled",
};

function detectDeviceMemoryGB(): number {
  if (typeof navigator === "undefined") return 8;
  const dm = (navigator as DeviceMemoryNavigator).deviceMemory;
  return typeof dm === "number" ? dm : 8;
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export interface GraphicsSettings {
  liteMode: boolean;
  bloom: boolean;
  shadows: boolean;
  ghostsEnabled: boolean;
}

export interface GraphicsSettingsActions {
  setLiteMode: (v: boolean) => void;
  setBloom: (v: boolean) => void;
  setShadows: (v: boolean) => void;
  setGhostsEnabled: (v: boolean) => void;
  resetToAuto: () => void;
}

export function useGraphicsSettings(): [GraphicsSettings, GraphicsSettingsActions] {
  const [state, setState] = useState<GraphicsSettings>({
    liteMode: false,
    bloom: false,
    shadows: false,
    ghostsEnabled: true,
  });

  useEffect(() => {
    const gb = detectDeviceMemoryGB();
    const autoLite = gb <= 4;
    const autoBloom = gb >= 8;
    setState({
      liteMode: readBool(KEYS.liteMode, autoLite),
      bloom: readBool(KEYS.bloom, autoBloom),
      shadows: readBool(KEYS.shadows, false), // default off for 60-FPS budget
      ghostsEnabled: readBool(KEYS.ghosts, true),
    });
  }, []);

  const actions: GraphicsSettingsActions = {
    setLiteMode: (v) => {
      setState((s) => ({ ...s, liteMode: v }));
      writeBool(KEYS.liteMode, v);
    },
    setBloom: (v) => {
      setState((s) => ({ ...s, bloom: v }));
      writeBool(KEYS.bloom, v);
    },
    setShadows: (v) => {
      setState((s) => ({ ...s, shadows: v }));
      writeBool(KEYS.shadows, v);
    },
    setGhostsEnabled: (v) => {
      setState((s) => ({ ...s, ghostsEnabled: v }));
      writeBool(KEYS.ghosts, v);
    },
    resetToAuto: () => {
      try {
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
      const gb = detectDeviceMemoryGB();
      setState({
        liteMode: gb <= 4,
        bloom: gb >= 8,
        shadows: false,
        ghostsEnabled: true,
      });
    },
  };

  return [state, actions];
}
