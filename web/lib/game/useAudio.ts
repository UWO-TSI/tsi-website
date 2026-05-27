"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { AudioManager, type AmbientPhase, type SFXName, type AudioState } from "./audio";

/**
 * React glue for the AudioManager singleton (sprint A7).
 *
 * - `useAmbientAudio(phase)` keeps the manager's ambient track in sync with
 *   the caller's current time-of-day phase.
 * - `useSFX()` returns a stable `play(name)` callback for one-shots.
 * - `useAudioState()` exposes the manager state to UI (enable prompt + sliders).
 */

export function useAmbientAudio(phase: AmbientPhase): void {
  useEffect(() => {
    AudioManager.setPhase(phase);
  }, [phase]);
}

export function useSFX(): { play: (name: SFXName) => void } {
  const play = useCallback((name: SFXName) => {
    AudioManager.playSFX(name);
  }, []);
  return { play };
}

const EMPTY_STATE: AudioState = {
  enabled: false,
  volumes: { master: 0.7, ambient: 0.6, sfx: 0.8 },
  phase: null,
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
