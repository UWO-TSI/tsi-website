"use client";

/**
 * FishReveal (David ruling 2026-07-23) — the blind-box first-catch ceremony.
 *
 * Fullscreen takeover in three stages, timings per tier from REVEAL:
 *
 *   suspense — world dims/blurs; the fish floats center-screen as a BLACK
 *              silhouette, shaking harder and harder (rAF, amplitude ramps
 *              quadratically) while a tier-colored glow builds behind it —
 *              the telegraph. Sea King leaks the holographic shimmer.
 *              Rotating gacha rays fade in from rare up.
 *   flash    — tier-tinted white flare + confetti burst (celebrate()) +
 *              max shake. The blind box cracks.
 *   landed   — silhouette resolves to the real fish (filter animates to
 *              color, scale pop), name + NEW! + rarity chip + size slide
 *              in. Holds, then dismisses.
 *
 * Any click / E / Space / Enter skips suspense straight to the flash;
 * clicking after landing dismisses immediately. prefers-reduced-motion
 * collapses suspense to a beat. Repeats never see this — FishingOverlay
 * only mounts it for first catches.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";
import {
  HOLO_GRADIENT,
  RARITY_META,
  REVEAL,
  celebrate,
  fishOdds,
  type FishDef,
} from "@/lib/game/fishing";

type Stage = "suspense" | "freeze" | "flash" | "landed";

export default function FishReveal({
  fish,
  sizeCm,
  onDone,
}: {
  fish: FishDef;
  sizeCm: number;
  onDone: () => void;
}) {
  const cfg = REVEAL[fish.rarity];
  const meta = RARITY_META[fish.rarity];
  const holo = fish.rarity === "seaking";
  // "1 in N" — the Sol's-RNG flex number, computed against the live pool.
  const odds = fishOdds(fish);

  const [stage, setStage] = useState<Stage>("suspense");
  const stageRef = useRef<Stage>("suspense");
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const fishImgRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crack = useCallback(() => {
    if (stageRef.current === "flash" || stageRef.current === "landed") return;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    setStage("flash");
    AudioManager.playSFX("confirm");
    celebrate(fish.rarity, meta.color);
    timersRef.current.push(
      window.setTimeout(() => {
        setStage("landed");
        timersRef.current.push(window.setTimeout(finish, cfg.hold));
      }, cfg.flash)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // End of suspense: epic+ gets the dead-stop gasp (shake halts, faint
  // fake-out flare for legendary+), then the real crack.
  const toFlash = useCallback(() => {
    if (stageRef.current !== "suspense") return;
    if (cfg.freeze > 0) {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      setStage("freeze");
      AudioManager.playSFX("click");
      timersRef.current.push(window.setTimeout(crack, cfg.freeze));
    } else {
      crack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage 1 timer (reduced motion collapses the suspense to a beat).
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(toFlash, reduced ? 180 : cfg.suspense);
    timersRef.current.push(t);
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip input: click / E / Space / Enter. ESC also skips (never traps).
  useEffect(() => {
    const skip = () => {
      if (stageRef.current === "suspense") toFlash();
      else if (stageRef.current === "freeze") crack();
      else if (stageRef.current === "landed") finish();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      skip();
    };
    const onKey = (e: KeyboardEvent) => {
      if (["e", "E", " ", "Enter", "Escape"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        skip();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suspense rAF: shake amplitude ramps quadratically, glow builds behind.
  useEffect(() => {
    if (stage !== "suspense") return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / cfg.suspense);
      const amp = cfg.shake * p * p;
      if (fishImgRef.current) {
        fishImgRef.current.style.transform = `translate(${(Math.random() * 2 - 1) * amp}px, ${
          (Math.random() * 2 - 1) * amp
        }px) scale(${1 + 0.1 * p})`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = String(0.2 + 0.8 * p);
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${0.65 + 0.55 * p})`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, cfg.suspense, cfg.shake]);

  const landed = stage === "landed";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8, 10, 16, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        // Sol's-RNG monochrome moment: the sea-king crack drains the color
        // out of the whole screen for a beat, then it floods back.
        filter: holo && stage === "flash" ? "grayscale(1) contrast(1.15)" : "none",
        transition: "filter 240ms ease-out",
        animation: "tsi-reveal-in 220ms ease-out",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* Gacha rays (rare+) — rotate behind the fish, tier-tinted */}
      {cfg.rays && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 720,
            height: 720,
            marginLeft: -360,
            marginTop: -360,
            background: `repeating-conic-gradient(${meta.color}30 0deg 9deg, transparent 9deg 26deg)`,
            borderRadius: "50%",
            WebkitMaskImage: "radial-gradient(closest-side, black 20%, transparent 72%)",
            maskImage: "radial-gradient(closest-side, black 20%, transparent 72%)",
            animation: "tsi-reveal-spin 16s linear infinite",
            opacity: landed ? 0.9 : 0.55,
          }}
        />
      )}

      {/* Telegraph glow — ramps to tier color during suspense, snaps bright
          at the freeze */}
      <div
        ref={glowRef}
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 460,
          height: 460,
          transform: "translate(-50%, -50%) scale(0.65)",
          borderRadius: "50%",
          background: holo ? HOLO_GRADIENT : `radial-gradient(circle, ${meta.color}66 0%, ${meta.color}22 45%, transparent 70%)`,
          backgroundSize: holo ? "300% 300%" : undefined,
          animation: holo ? "tsi-holo-shift 2.2s linear infinite" : undefined,
          filter: "blur(38px)",
          opacity: 0.2,
        }}
      />

      {/* Freeze fake-out flare (legendary+ gasp beat) */}
      {stage === "freeze" && cfg.doubleFlash && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 46%, ${meta.color}66 0%, transparent 60%)`,
            animation: "tsi-reveal-minipop 380ms ease-out forwards",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Pulse rings at the crack — count = tier flex */}
      {(stage === "flash" || stage === "landed") &&
        Array.from({ length: cfg.rings }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "46%",
              width: 180,
              height: 180,
              marginLeft: -90,
              marginTop: -90,
              borderRadius: "50%",
              border: `3px solid ${holo ? "#5EE7F7" : meta.color}`,
              opacity: 0,
              animation: `tsi-reveal-ring 900ms ease-out ${i * 150}ms forwards`,
              pointerEvents: "none",
            }}
          />
        ))}

      {/* Flash flare — mounts at the crack, fades itself out */}
      {stage !== "suspense" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 46%, #FFFFFF 0%, ${meta.color}AA 38%, transparent 75%)`,
            animation: `tsi-reveal-flash ${Math.max(380, cfg.flash + 240)}ms ease-out forwards`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* The fish */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={fishImgRef}
          src={`/assets/acnh/icons/${fish.key}.png`}
          alt=""
          width={150}
          height={150}
          draggable={false}
          style={{
            filter: landed
              ? `drop-shadow(0 0 24px ${meta.color}CC)`
              : "brightness(0) drop-shadow(0 0 14px rgba(0,0,0,0.6))",
            transition: "filter 320ms ease-out",
            animation: landed ? "tsi-reveal-land 420ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "tsi-reveal-bob 2.2s ease-in-out infinite",
          }}
        />

        {/* Result line — only after the crack */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            opacity: landed ? 1 : 0,
            transform: landed ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 300ms ease-out 120ms, transform 300ms ease-out 120ms",
            fontFamily: "var(--font-highlight, sans-serif)",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFDF5", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
            {fish.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#FFFDF5",
                borderRadius: 999,
                padding: "4px 11px",
                ...(holo
                  ? {
                      background: HOLO_GRADIENT,
                      backgroundSize: "300% 100%",
                      animation: "tsi-holo-shift 2.2s linear infinite",
                      textShadow: "0 1px 2px rgba(20, 40, 60, 0.45)",
                      boxShadow: "0 0 14px rgba(122, 231, 255, 0.8)",
                    }
                  : { background: meta.color }),
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#1A1410",
                background: "#FFD166",
                borderRadius: 999,
                padding: "4px 11px",
              }}
            >
              NEW!
            </span>
            <span style={{ fontSize: 13, color: "rgba(255, 253, 245, 0.85)", fontWeight: 600 }}>{sizeCm} cm</span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                color: "rgba(255,255,255,0.65)",
                background: "rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              1 in {odds}
            </span>
          </div>
        </div>
      </div>

      {/* Server-broadcast-style banner (legendary+) — becomes a real
          global announcement when multiplayer lands */}
      {landed && cfg.doubleFlash && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "9px 22px",
            borderRadius: 999,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#FFFDF5",
            background: holo ? HOLO_GRADIENT : `linear-gradient(90deg, ${meta.color}, ${meta.color}CC)`,
            backgroundSize: holo ? "300% 100%" : undefined,
            animation: holo
              ? "tsi-reveal-banner 420ms cubic-bezier(0.34, 1.56, 0.64, 1), tsi-holo-shift 2.2s linear infinite"
              : "tsi-reveal-banner 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: `0 4px 24px ${holo ? "#5EE7F7" : meta.color}66`,
            whiteSpace: "nowrap",
          }}
        >
          ⚡ {meta.label.toUpperCase()} CATCH — {fish.name}, {sizeCm} cm
        </div>
      )}

      {/* Skip hint */}
      {!landed && (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          click to skip
        </div>
      )}

      <style>{`
        @keyframes tsi-reveal-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tsi-reveal-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tsi-reveal-flash {
          0% { opacity: 0; }
          18% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes tsi-reveal-land {
          0% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes tsi-reveal-bob {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -10px; }
        }
        @keyframes tsi-holo-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes tsi-reveal-minipop {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes tsi-reveal-ring {
          0% { opacity: 0.9; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes tsi-reveal-banner {
          0% { opacity: 0; transform: translateX(-50%) translateY(-18px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
