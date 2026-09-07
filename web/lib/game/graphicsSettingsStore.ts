export interface GraphicsSettings {
  liteMode: boolean;
  bloom: boolean;
  shadows: boolean;
  ghostsEnabled: boolean;
  pixelated: boolean;
}

export const GRAPHICS_KEYS: Record<keyof GraphicsSettings, string> = {
  liteMode: "tsi.liteMode.v1", bloom: "tsi.bloom.v1", shadows: "tsi.shadows.v1",
  ghostsEnabled: "tsi.ghosts.enabled", pixelated: "tsi.pixelated.v1",
};

export function automaticGraphics(memory?: number): GraphicsSettings {
  const liteMode = typeof memory === "number" && Number.isFinite(memory) && memory > 0 && memory <= 4;
  return { liteMode, bloom: false, shadows: !liteMode, ghostsEnabled: true, pixelated: true };
}

const SERVER_SETTINGS = Object.freeze(automaticGraphics());
const fields = Object.keys(GRAPHICS_KEYS) as (keyof GraphicsSettings)[];

type SettingsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One live snapshot for the world, settings panel, and legacy feature hooks. */
export function createGraphicsSettingsStore({ storage, memory, events }: {
  storage: () => SettingsStorage;
  memory: () => number | undefined;
  events: () => EventTarget;
}) {
  let snapshot: GraphicsSettings | undefined;
  const sessionOverrides: Partial<GraphicsSettings> = {};
  const listeners = new Set<() => void>();
  const publish = (next: GraphicsSettings) => {
    if (snapshot && fields.every((key) => snapshot![key] === next[key])) return;
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const refresh = () => {
    const next = automaticGraphics(memory());
    for (const key of fields) {
      try {
        const value = storage().getItem(GRAPHICS_KEYS[key]);
        if (value === "true" || value === "false") next[key] = value === "true";
      } catch { /* Fall back to automatic settings when storage is blocked. */ }
      if (key in sessionOverrides) next[key] = sessionOverrides[key]!;
    }
    publish(next);
  };
  const getSnapshot = () => {
    if (!snapshot) refresh();
    return snapshot!;
  };
  const onStorage = (event: Event) => {
    const key = (event as StorageEvent).key;
    if (key !== null && !Object.values(GRAPHICS_KEYS).includes(key)) return;
    refresh();
  };
  return {
    getSnapshot,
    getServerSnapshot: () => SERVER_SETTINGS,
    subscribe(listener: () => void) {
      if (listeners.size === 0) { events().addEventListener("storage", onStorage); refresh(); }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) events().removeEventListener("storage", onStorage);
      };
    },
    set(key: keyof GraphicsSettings, value: boolean) {
      const next = { ...getSnapshot(), [key]: value };
      try { storage().setItem(GRAPHICS_KEYS[key], String(value)); delete sessionOverrides[key]; }
      catch { sessionOverrides[key] = value; }
      publish(next);
    },
    reset() {
      const next = automaticGraphics(memory());
      for (const key of fields) {
        try { storage().removeItem(GRAPHICS_KEYS[key]); delete sessionOverrides[key]; }
        catch { sessionOverrides[key] = next[key]; }
      }
      publish(next);
    },
  };
}
