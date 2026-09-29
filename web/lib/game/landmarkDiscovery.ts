export const DISCOVERY_KEY = "tsi.discovered.v1";
export const LANDMARKS = [
  { key: "cove", label: "Beach Cove", x: 16, z: 53.9, r: 8 },
  { key: "lighthouse", label: "The Lighthouse", x: 38.2, z: -37.1, r: 7 },
  { key: "islet", label: "Isla Chica", x: -24, z: 72, r: 9 },
  { key: "flats", label: "The Flats", x: 38.5, z: 46.5, r: 9 },
  { key: "reedmarsh", label: "The Reedmarsh", x: -41.5, z: 9.5, r: 7 },
  { key: "windmill", label: "The Windmill", x: -32, z: -26, r: 9 },
  { key: "oracle", label: "Oracle Temple", x: 0, z: 30, r: 7 },
] as const;
export type Landmark = (typeof LANDMARKS)[number];
type DiscoveryStorage = Pick<Storage, "getItem" | "setItem">;

// Device-local discoveries survive opening/closing the map when storage is blocked.
const sessionDiscoveries = new Set<string>();

export function createLandmarkDiscovery(storage?: DiscoveryStorage, session = sessionDiscoveries) {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(DISCOVERY_KEY) ?? "[]");
    if (Array.isArray(saved)) {
      for (const key of saved) if (LANDMARKS.some((landmark) => landmark.key === key)) session.add(key);
    }
  } catch { /* Keep this visit's discoveries if storage is unavailable. */ }

  return (x: number, z: number): Landmark | undefined => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const landmark = LANDMARKS.find((zone) => !session.has(zone.key) && Math.hypot(x - zone.x, z - zone.z) < zone.r);
    if (!landmark) return;
    session.add(landmark.key);
    try { storage?.setItem(DISCOVERY_KEY, JSON.stringify([...session])); } catch { /* Session progress remains available. */ }
    return landmark;
  };
}
