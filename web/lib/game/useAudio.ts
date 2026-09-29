"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { AudioManager, type AmbientPhase, type SFXName, type AudioState } from "./audio";
import type { IslandWeather } from "./islandWeather";
import type { Season } from "./season";

/**
 * React glue for the AudioManager singleton (sprint A7; extended in the
 * audio pass, rows 84, 99, 106, 112-114).
 *
 * - `useAmbientAudio(phase)` keeps the manager's ambient track in sync with
 *   the caller's current time-of-day phase.
 * - `useAmbience({ phase, weather, season })` is the richer version: same
 *   bed, but tries a weather/season variant before the base file.
 * - `useSFX()` returns a stable `play(name)` callback for one-shots.
 * - `useAudioState()` exposes the manager state to UI (enable prompt + sliders).
 */

export function useAmbientAudio(phase: AmbientPhase): void {
  useAmbience({ phase });
}

export function useAmbience(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }): void {
  const { phase, weather, season } = input;
  useEffect(() => {
    AudioManager.setAmbience({ phase, weather, season });
  }, [phase, weather, season]);
  useEffect(() => () => AudioManager.stop(), []);
}

export function useSFX(): { play: (name: SFXName) => void } {
  const play = useCallback((name: SFXName) => {
    AudioManager.playSFX(name);
  }, []);
  return { play };
}

const EMPTY_STATE: AudioState = {
  enabled: false,
  muted: false,
  volumes: { master: 0.7, ambient: 0.6, music: 0.55, sfx: 0.8 },
  phase: null,
  music: { block: null, override: null },
};

export function useAudioState(): AudioState {
  // useSyncExternalStore for clean SSR + tear-resistant client reads.
  const [serverSnapshot] = useState<AudioState>(EMPTY_STATE);
  return useSyncExternalStore(
    (cb) => AudioManager.subscribe(cb),
    () => AudioManager.getState(),
    () => serverSnapshot,
  );
}
