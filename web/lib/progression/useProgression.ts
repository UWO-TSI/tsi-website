"use client";

/**
 * One shared progression state for the HUD, the world and the sheets.
 * Any write calls `refreshProgression()` (or dispatches
 * `tsi:progression-changed`) and every subscriber re-renders.
 */
import { useEffect, useSyncExternalStore } from "react";
import { fetchState, previewState } from "./client";
import { applyGoalOverride, parseGoalOverride } from "./devOverride";
import type { ProgressionState } from "./types";

export const PROGRESSION_CHANGED = "tsi:progression-changed";

let current: ProgressionState | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const FALLBACK = previewState();

function emit() {
  for (const l of listeners) l();
}

function withOverride(state: ProgressionState): ProgressionState {
  if (typeof window === "undefined") return state;
  return applyGoalOverride(state, parseGoalOverride(window.location.search));
}

export function setProgressionState(state: ProgressionState): void {
  current = withOverride(state);
  emit();
}

export function refreshProgression(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchState()
    .then((s) => setProgressionState(s))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shared progression state; loads once on first use. */
export function useProgression(): { state: ProgressionState; loaded: boolean } {
  const state = useSyncExternalStore(subscribe, () => current ?? FALLBACK, () => FALLBACK);
  useEffect(() => {
    if (!current) void refreshProgression();
    const onChange = () => void refreshProgression();
    window.addEventListener(PROGRESSION_CHANGED, onChange);
    return () => window.removeEventListener(PROGRESSION_CHANGED, onChange);
  }, []);
  return { state, loaded: current !== null };
}
