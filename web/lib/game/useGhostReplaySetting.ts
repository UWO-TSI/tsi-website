"use client";

import { useSyncExternalStore } from "react";

// ─── useGhostReplaySetting (sprint E9) ──────────────────────────────────────
// LocalStorage-backed toggle for the GhostReplay component in GameWorld.
// Default ON. Setting hidden behind a tiny settings checkbox so noise-averse
// members can mute ambient ghosts (design principle #7).
//
// Implemented with useSyncExternalStore so we don't trigger
// setState-in-effect lint and SSR returns the default cleanly.

const KEY = "tsi.ghosts.enabled";
const STORAGE_EVT = "storage";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener(STORAGE_EVT, onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener(STORAGE_EVT, onStorage);
    }
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === null) return true;
    return v === "true";
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

export function useGhostReplaySetting(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, String(next));
    } catch {
      /* ignore */
    }
    // Notify same-tab listeners (the 'storage' event only fires for other tabs).
    for (const l of listeners) l();
  };
  return [enabled, set];
}
