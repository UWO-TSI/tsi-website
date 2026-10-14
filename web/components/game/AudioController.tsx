"use client";

import { type AmbientPhase } from "@/lib/game/audio";
import { useAmbience, useSoundUnlock } from "@/lib/game/useAudio";
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
 *      page, so players don't have to find a button (row 1).
 * Mute and the volumes live in Settings (`SettingsSheet.tsx`, row 259); the HUD's sound button went with playtest
 * round 1 (decision 3: "sound will be in setting"). Stays mounted: unmounting stops all sound (useAmbience).
 */
export default function AudioController({ phase, weather, season }: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }) {
  useAmbience({ phase, weather, season });
  useSoundUnlock();
  return null;
}
