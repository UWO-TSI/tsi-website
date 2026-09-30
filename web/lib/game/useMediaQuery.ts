"use client";

import { useSyncExternalStore } from "react";

/**
 * Reactive media-query hook. useSyncExternalStore keeps it SSR-safe
 * (server snapshot = false) and avoids the
 * react-hooks/set-state-in-effect lint rule.
 */
export function useMediaQuery(query: string): boolean;
/** `serverValue` null: unknown until the client has read the query. */
export function useMediaQuery(query: string, serverValue: null): boolean | null;
export function useMediaQuery(query: string, serverValue: boolean | null = false): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

/** Coarse pointer = touch-primary device (phones, tablets). */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

const noSubscribe = () => () => {};
/** The page's query string, null until the client reads it (server render and hydration). */
export function useSearch(): string | null {
  return useSyncExternalStore(noSubscribe, () => window.location.search, () => null);
}
