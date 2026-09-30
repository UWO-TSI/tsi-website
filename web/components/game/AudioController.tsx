"use client";

import { Volume2, VolumeX } from "lucide-react";
import { AudioManager, type AmbientPhase } from "@/lib/game/audio";
import { useAmbience, useAudioState, useSoundUnlock } from "@/lib/game/useAudio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { Season } from "@/lib/game/season";

/**
 * AudioController (sprint A7; extended in the audio pass) — mounted once at
 * the game world's DOM root (GameWorld, and DefaultIslandWorld's member
 * island — ledger row 169 / polish-ownership item 9: the chime was silent
 * there because nothing called `AudioManager.enable()`).
 *
 * Responsibilities:
 *   1. Drive the AudioManager ambient bed off the current time-of-day phase
 *      (plus weather/season, when the caller has them).
 *   2. Enable sound on the first pointer/keyboard gesture anywhere on the
 *      page, so players don't have to find the bell icon (row 1). The bell
 *      still renders as a manual fallback and status indicator.
 *   3. Render a bottom-right mute toggle. The volume sliders live in the
 *      settings sheet (`SettingsSheet.tsx`, row 259).
 */

export default function AudioController({ phase, weather, season }: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }) {
  useAmbience({ phase, weather, season });
  const state = useAudioState();
  useSoundUnlock();

  return (
    <>
      {/* Enable-sound prompt — top-right corner, only while disabled. */}
      {!state.enabled && (
        <button
          onClick={() => AudioManager.enable()}
          aria-label="Enable sound"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            background: "rgba(15, 15, 16, 0.78)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 999,
            color: "#FFDD87",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            animation: "tsi-bell-pulse 2.4s ease-in-out infinite",
          }}
          title="Turn on sound"
        >
          <VolumeX size={16} />
          <style>{`@keyframes tsi-bell-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,221,135,0.35); } 50% { transform: scale(1.06); box-shadow: 0 0 0 7px rgba(255,221,135,0); } }`}</style>
        </button>
      )}

      {/* Mute toggle, bottom-right corner. */}
      {state.enabled && (
        <button
          onClick={() => AudioManager.setMuted(!state.muted)}
          aria-pressed={state.muted}
          aria-label="Mute sound"
          title={state.muted ? "Unmute" : "Mute"}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            background: "rgba(15, 15, 16, 0.78)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 8,
            color: "#f1ffff",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          {state.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}
    </>
  );
}
