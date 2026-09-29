"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createRemoteHomeStore } from "@/lib/homes-sync/remoteStore";
import { defaultLayout, withRooms, type HomeLayoutDoc } from "./layout";

/**
 * Home layout, synced to /api/homes (systems agent's remote store) with
 * localStorage as the offline cache. Edits apply at once and save on a short
 * debounce; the server copy is loaded on mount.
 */
const store = createRemoteHomeStore({ cache: () => (typeof window === "undefined" ? null : window.localStorage) });
const serverSnapshot = defaultLayout();
let hydrated = false;

export interface HomeActions {
  buyRoom: (expectedPrice: number) => Promise<{ ok: true; coins: number } | { ok: false; error: string; code?: string }>;
  roomPrice: () => number | null;
}

/** `?rooms=<n>` (dev only) shows n connected rooms without saving them. */
export function useHomeLayout(): [HomeLayoutDoc, (next: HomeLayoutDoc) => void, () => void, HomeActions] {
  const saved = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot);
  useEffect(() => { if (!hydrated) { hydrated = true; void store.hydrate(); } }, []);
  const [rooms] = useState(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return 0;
    return Number(new URLSearchParams(window.location.search).get("rooms")) || 0;
  });
  const layout = useMemo(() => (rooms ? withRooms(saved, rooms) : saved), [saved, rooms]);
  return [layout, next => store.set(next), () => store.reset(), { buyRoom: price => store.buyRoom(price), roomPrice: store.getRoomPrice }];
}
