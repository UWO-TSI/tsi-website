"use client";

import { useSyncExternalStore } from "react";

/**
 * Reactive media-query hook. useSyncExternalStore keeps it SSR-safe
 * (server snapshot = false) and avoids the
 * react-hooks/set-state-in-effect lint rule.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Coarse pointer = touch-primary device (phones, tablets). */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
