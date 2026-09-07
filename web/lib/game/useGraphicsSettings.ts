"use client";

import { useSyncExternalStore } from "react";
import { createGraphicsSettingsStore, type GraphicsSettings } from "./graphicsSettingsStore";
export type { GraphicsSettings } from "./graphicsSettingsStore";

const store = createGraphicsSettingsStore({
  storage: () => window.localStorage,
  memory: () => typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  events: () => window,
});

export interface GraphicsSettingsActions {
  setLiteMode: (v: boolean) => void;
  setBloom: (v: boolean) => void;
  setShadows: (v: boolean) => void;
  setGhostsEnabled: (v: boolean) => void;
  setPixelated: (v: boolean) => void;
  resetToAuto: () => void;
}

const actions: GraphicsSettingsActions = {
  setLiteMode: (v) => store.set("liteMode", v),
  setBloom: (v) => store.set("bloom", v),
  setShadows: (v) => store.set("shadows", v),
  setGhostsEnabled: (v) => store.set("ghostsEnabled", v),
  setPixelated: (v) => store.set("pixelated", v),
  resetToAuto: store.reset,
};

export function useGraphicsSettings(): [GraphicsSettings, GraphicsSettingsActions] {
  return [useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot), actions];
}
