"use client";

import { Volume2, VolumeX } from "lucide-react";
import { AudioManager, type AmbientPhase } from "@/lib/game/audio";
import { useAmbience, useAudioState, useSoundUnlock } from "@/lib/game/useAudio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { Season } from "@/lib/game/season";

/**
 * AudioController (sprint A7; extended in the audio pass) — mounted once at
 * the member island's DOM root (ledger row 169 / polish-ownership item 9: the
 * chime was silent there because nothing called `AudioManager.enable()`).
 *
 * Responsibilities:
 *   1. Drive the AudioManager ambient bed off the current time-of-day phase
 *      (plus weather/season, when the caller has them).
 *   2. Enable sound on the first pointer/keyboard gesture anywhere on the
 *      page, so players don't have to find the button (row 1).
 *   3. Render the HUD's one sound button (`className` places it): "turn on
 *      sound" while the browser keeps it off, mute and unmute after. The
 *      volume sliders live in the settings sheet (`SettingsSheet.tsx`, row 259).
 */
export default function AudioController({ phase, weather, season, className }: { phase: AmbientPhase; weather?: IslandWeather; season?: Season; className?: string }) {
  useAmbience({ phase, weather, season });
  const state = useAudioState();
  useSoundUnlock();
  const label = !state.enabled ? "Turn on sound" : state.muted ? "Unmute" : "Mute";
  return (
    <button className={className} data-sound={!state.enabled ? "off" : state.muted ? "muted" : "on"}
      onClick={() => (state.enabled ? AudioManager.setMuted(!state.muted) : AudioManager.enable())}
      aria-pressed={state.enabled ? state.muted : undefined} aria-label={state.enabled ? "Mute sound" : label} title={label}>
      {!state.enabled || state.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
    </button>
  );
}
