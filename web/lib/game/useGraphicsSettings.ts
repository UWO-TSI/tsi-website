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
  pixelated: "tsi.pixelated.v1",
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
  /** Art pass 2026-07-07: gates the blob-shadow layer (shadow maps are gone). */
  shadows: boolean;
  ghostsEnabled: boolean;
  /** Render at 0.66 dpr with nearest upscale — the Frog Island chunky-pixel look. */
  pixelated: boolean;
}

export interface GraphicsSettingsActions {
  setLiteMode: (v: boolean) => void;
  setBloom: (v: boolean) => void;
  setShadows: (v: boolean) => void;
  setGhostsEnabled: (v: boolean) => void;
  setPixelated: (v: boolean) => void;
  resetToAuto: () => void;
}

export function useGraphicsSettings(): [GraphicsSettings, GraphicsSettingsActions] {
  const [state, setState] = useState<GraphicsSettings>({
    liteMode: false,
    bloom: false,
    shadows: false,
    ghostsEnabled: true,
    pixelated: true,
  });

  useEffect(() => {
    const gb = detectDeviceMemoryGB();
    const autoLite = gb <= 4;
    const autoBloom = gb >= 8;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage read is a one-shot client-only init; running outside an effect would break SSR
    setState({
      liteMode: readBool(KEYS.liteMode, autoLite),
      bloom: readBool(KEYS.bloom, autoBloom),
      // Cozy push (David ruling 2026-07-03): soft shadows ON by default,
      // auto-off on ≤4GB devices via the lite gate. FPS re-measured against
      // the 60-on-M1 floor after the change.
      shadows: readBool(KEYS.shadows, !autoLite),
      ghostsEnabled: readBool(KEYS.ghosts, true),
      pixelated: readBool(KEYS.pixelated, true),
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
    setPixelated: (v) => {
      setState((s) => ({ ...s, pixelated: v }));
      writeBool(KEYS.pixelated, v);
    },
    resetToAuto: () => {
      try {
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
      const gb = detectDeviceMemoryGB();
      setState({
        liteMode: gb <= 4,
        bloom: gb >= 8,
        shadows: !(gb <= 4),
        ghostsEnabled: true,
        pixelated: true,
      });
    },
  };

  return [state, actions];
}
