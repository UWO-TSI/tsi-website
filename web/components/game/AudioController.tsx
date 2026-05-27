"use client";

import { useState } from "react";
import { Volume2, VolumeX, Settings2 } from "lucide-react";
import { AudioManager, type AmbientPhase } from "@/lib/game/audio";
import { useAmbientAudio, useAudioState } from "@/lib/game/useAudio";

/**
 * AudioController (sprint A7) — mounted once at the GameWorld DOM root.
 *
 * Responsibilities:
 *   1. Drive the AudioManager phase off the current TOD phase prop.
 *   2. Render the "Click to enable sound" prompt (top-right) until user
 *      gestures (browser autoplay rule).
 *   3. Render a tiny bottom-right widget with the 3 volume sliders.
 *
 * The settings page (`/student/dashboard/settings`) is intentionally not
 * extended this sprint — sliders live here, attached to the game world
 * where the user can hear changes in real time.
 */

export default function AudioController({ phase }: { phase: AmbientPhase }) {
  useAmbientAudio(phase);
  const state = useAudioState();
  const [panelOpen, setPanelOpen] = useState(false);

  const handleEnable = () => {
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
            gap: 8,
            padding: "8px 12px",
            background: "rgba(15, 15, 16, 0.78)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 8,
            color: "#f1ffff",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          <VolumeX size={14} />
          Click to enable sound
        </button>
      )}

      {/* Mixer widget — bottom-right corner. */}
      {state.enabled && (
        <div
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
                label="Ambient"
                value={state.volumes.ambient}
                onChange={(v) => AudioManager.setVolumes({ ambient: v })}
              />
              <VolumeSlider
                label="SFX"
                value={state.volumes.sfx}
                onChange={(v) => AudioManager.setVolumes({ sfx: v })}
              />
            </div>
          )}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={panelOpen ? "Close audio settings" : "Open audio settings"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
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
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: "100%", accentColor: "#7EC850" }}
      />
    </label>
  );
}
