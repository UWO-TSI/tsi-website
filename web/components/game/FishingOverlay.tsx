"use client";

/**
 * FishingOverlay (cozy marathon G5) — Stardew/ACNH-style fishing.
 *
 * DOM overlay (outside the Canvas, alongside the emote menu). Listens for
 * `tsi:fish-start` from GameWorld's E handler when the player is at a
 * riverbank spot, then runs a self-contained state machine:
 *
 *   casting → waiting (2-6s) → bite (1.4s window) → result
 *
 * Press E (or click the button) during the bite window to catch; miss the
 * window and it gets away. ESC cancels anytime. A catch collects a random
 * fish to member_collections — cosmetic only, no TC/XP (principle #3).
 *
 * Kept entirely in the DOM: no R3F coupling, no player-controller changes.
 * Its own keydown listener handles E-during-bite so it doesn't fight the
 * world's E handler (which only fires the start event and is inert while a
 * cast is active because this overlay swallows the keypress).
 */

import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";

type Phase = "idle" | "casting" | "waiting" | "bite" | "caught" | "missed";

const FISH = [
  { key: "fish_common", label: "a Pond Minnow" },
  { key: "fish_river", label: "a River Trout" },
  { key: "fish_river", label: "a Sunfish" },
  { key: "fish_rare", label: "a Golden Koi" },
];
const RARE_INDEX = 3;

const BITE_WINDOW_MS = 1400;

export default function FishingOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [caughtLabel, setCaughtLabel] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const biteDeadlineRef = useRef(0);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const cancel = () => {
    clearTimers();
    setPhase("idle");
    setCaughtLabel(null);
  };

  const beginWait = () => {
    setPhase("waiting");
    const wait = 2000 + Math.random() * 4000;
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("bite");
        AudioManager.playSFX("confirm");
        biteDeadlineRef.current = performance.now() + BITE_WINDOW_MS;
        // Auto-miss if the window lapses.
        timersRef.current.push(
          window.setTimeout(() => {
            setPhase("missed");
            AudioManager.playSFX("exit");
            timersRef.current.push(window.setTimeout(cancel, 1800));
          }, BITE_WINDOW_MS)
        );
      }, wait)
    );
  };

  const start = () => {
    clearTimers();
    setCaughtLabel(null);
    setPhase("casting");
    AudioManager.playSFX("click");
    timersRef.current.push(window.setTimeout(beginWait, 650));
  };

  const hook = () => {
    if (phase !== "bite") return;
    if (performance.now() > biteDeadlineRef.current) return;
    clearTimers();
    // 12% rare, else weighted among the common three.
    const rare = Math.random() < 0.12;
    const fish = rare ? FISH[RARE_INDEX] : FISH[Math.floor(Math.random() * RARE_INDEX)];
    setCaughtLabel(fish.label);
    setPhase("caught");
    AudioManager.playSFX("confirm");
    // Signals the "catch a fish" onboarding quest (auto-complete).
    window.dispatchEvent(new CustomEvent("tsi:fish-caught", { detail: { key: fish.key } }));
    fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_key: fish.key }),
    }).catch(() => {});
    timersRef.current.push(window.setTimeout(cancel, 2600));
  };

  // Start on the world event.
  useEffect(() => {
    const onStart = () => {
      // Ignore restart while a cast is live; a fresh start only from idle.
      setPhase((p) => (p === "idle" ? "casting" : p));
    };
    window.addEventListener("tsi:fish-start", onStart);
    return () => window.removeEventListener("tsi:fish-start", onStart);
  }, []);

  // When phase flips to "casting" via the event, run the cast sequence once.
  const startedRef = useRef(false);
  useEffect(() => {
    if (phase === "casting" && !startedRef.current) {
      startedRef.current = true;
      start();
    }
    if (phase === "idle") startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keyboard: E hooks during bite, ESC cancels. Capture so the world's E
  // handler doesn't also fire while fishing.
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        e.stopPropagation();
        hook();
      } else if (e.key === "Escape") {
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  if (phase === "idle") return null;

  const label =
    phase === "casting"
      ? "Casting…"
      : phase === "waiting"
        ? "Waiting for a bite…"
        : phase === "bite"
          ? "!!  Press E!"
          : phase === "caught"
            ? `You caught ${caughtLabel}!`
            : "It got away…";

  const accent = phase === "bite" ? "#E5484D" : phase === "caught" ? "#3D8F52" : "#4A4034";

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 120,
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          padding: "10px 20px",
          background: "#FFFDF5",
          color: accent,
          border: `2px solid ${phase === "bite" ? "#E5484D" : "#E8DFC8"}`,
          borderRadius: 14,
          fontFamily: "var(--font-highlight, sans-serif)",
          fontSize: 15,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 14px rgba(60, 45, 20, 0.2)",
          animation: phase === "bite" ? "fish-pulse 0.4s ease-in-out infinite" : undefined,
        }}
      >
        {label}
      </div>
      {(phase === "waiting" || phase === "bite" || phase === "casting") && (
        <div
          style={{
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          ESC to reel in
        </div>
      )}
      <style>{`
        @keyframes fish-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
