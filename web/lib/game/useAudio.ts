"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AudioManager, DEFAULT_VOLUMES, type AmbientPhase, type AudioState } from "./audio";
import { musicBlockAt, type MusicOverride } from "./musicSchedule";
import type { IslandWeather } from "./islandWeather";
import type { Season } from "./season";

/**
 * React glue for the AudioManager singleton (sprint A7; extended in the
 * audio pass, rows 84, 99, 106, 112-114).
 *
 * - `useAmbience({ phase, weather, season })` keeps the manager's ambient
 *   bed on the caller's time of day, trying a weather/season variant first.
 * - `useMusicDirector({ season, override })` keeps the music channel on the clock.
 * - `useAudioState()` exposes the manager state to UI (enable prompt + sliders).
 * - `useSoundUnlock()` turns sound on at the first tap or key (browsers need a gesture).
 */

export function useAmbience(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }): void {
  const { phase, weather, season } = input;
  useEffect(() => {
    AudioManager.setAmbience({ phase, weather, season });
  }, [phase, weather, season]);
  useEffect(() => () => AudioManager.stop(), []);
}

/**
 * Keeps `AudioManager`'s music channel following the real Toronto clock
 * (rows 84, 106, 112-114): picks the current 2-hour block, re-checks every
 * minute (same cadence as `useIslandConditions`'s clock tick — a 2-hour
 * boundary doesn't need finer scheduling), and swaps in the cafe/interior
 * override whenever the player is indoors.
 */
export function useMusicDirector({ season, override = null }: { season?: Season; override?: MusicOverride }): void {
  useEffect(() => {
    const apply = () => AudioManager.setMusic({ block: musicBlockAt(), season, override });
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [season, override]);
}

const EMPTY_STATE: AudioState = {
  enabled: false,
  muted: false,
  volumes: DEFAULT_VOLUMES,
  phase: null,
  music: { block: null, override: null },
};

export function useAudioState(): AudioState {
  // useSyncExternalStore for clean SSR + tear-resistant client reads.
  return useSyncExternalStore(
    (cb) => AudioManager.subscribe(cb),
    () => AudioManager.getState(),
    () => EMPTY_STATE,
  );
}

/** Sound turns on at the first tap or key anywhere on the page, and again if the browser turned it off. */
export function useSoundUnlock(): void {
  const { enabled } = useAudioState();
  useEffect(() => {
    if (enabled) return;
    const unlock = () => AudioManager.enable();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [enabled]);
}
