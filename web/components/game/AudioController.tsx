"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Volume2, VolumeX, Settings2 } from "lucide-react";
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
 *   3. Render a tiny bottom-right widget with the volume sliders.
 *
 * The settings sheet (`SettingsSheet.tsx`) is the persisted home for these
 * sliders; this widget is a quick in-context mixer that shares the same
 * `AudioManager` state, so both stay in sync automatically.
 */

export default function AudioController({ phase, weather, season }: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }) {
  useAmbience({ phase, weather, season });
  const state = useAudioState();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (panelOpen) panelRef.current?.querySelector("input")?.focus(); }, [panelOpen]);
  const closePanel = () => { setPanelOpen(false); buttonRef.current?.focus(); };

  useSoundUnlock();

  const handleEnable = () => {
    setPanelOpen(false);
    AudioManager.enable();
  };

  return (
    <>
      {/* Enable-sound prompt — top-right corner, only while disabled. */}
      {!state.enabled && (
        <button
          onClick={handleEnable}
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

      {/* Mixer widget — bottom-right corner. */}
      {state.enabled && (
        <div
          onKeyDown={(event) => {
            if (panelOpen && event.key === "Escape") {
              event.preventDefault(); event.stopPropagation(); closePanel();
            }
          }}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 50,
            fontFamily: "'IBM Plex Mono', monospace",
            color: "#f1ffff",
          }}
        >
          {panelOpen && (
            <div
              ref={panelRef}
              id={panelId}
              role="region"
              aria-label="Audio settings"
              style={{
                marginBottom: 8,
                padding: 12,
                width: 200,
                background: "rgba(15, 15, 16, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                backdropFilter: "blur(6px)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <VolumeSlider
                label="Master"
                value={state.volumes.master}
                onChange={(v) => AudioManager.setVolumes({ master: v })}
              />
              <VolumeSlider
                label="Music"
                value={state.volumes.music}
                onChange={(v) => AudioManager.setVolumes({ music: v })}
              />
              <VolumeSlider
                label="Ambience"
                value={state.volumes.ambient}
                onChange={(v) => AudioManager.setVolumes({ ambient: v })}
              />
              <VolumeSlider
                label="SFX"
                value={state.volumes.sfx}
                onChange={(v) => AudioManager.setVolumes({ sfx: v })}
              />
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, minHeight: 32 }}>
                <span>Mute</span>
                <input type="checkbox" checked={state.muted} onChange={(e) => AudioManager.setMuted(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#7EC850" }} />
              </label>
            </div>
          )}
          <button
            ref={buttonRef}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            onClick={() => panelOpen ? closePanel() : setPanelOpen(true)}
            aria-label={panelOpen ? "Close audio settings" : "Open audio settings"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              minHeight: 44,
              background: "rgba(15, 15, 16, 0.78)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 8,
              color: "#f1ffff",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
            }}
          >
            {panelOpen ? <Settings2 size={14} /> : <Volume2 size={14} />}
            {panelOpen ? "Close" : "Audio"}
          </button>
        </div>
      )}
    </>
  );
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
      <span style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af" }}>
        <span>{label}</span>
        <span>{Math.round(value * 100)}</span>
      </span>
      <input
        aria-label={`${label} volume`}
        aria-valuetext={`${Math.round(value * 100)}%`}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: "100%", minHeight: 32, accentColor: "#7EC850" }}
      />
    </label>
  );
}
