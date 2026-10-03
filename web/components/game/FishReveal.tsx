"use client";

/**
 * FishReveal — the catch card (specs/polish/fishing.md deliverable 5, the cozy cream direction). Every catch, first
 * or repeat, gets the same paper card at the foot of the screen while the world shows the fish itself: held up in
 * your hands, or over your head with the hold-up off (character/FishingRig.tsx). No backdrop, no blur, no rays.
 *
 *   arrive  — `delay` ms after the catch leaves the water (the world's beat first), the card slides up.
 *   develop — a first catch keeps its silhouette and "???" a beat (longer for the rarer: REVEAL), then fills with
 *             colour, its name, a chime and soft paper confetti from rare up. A repeat arrives developed.
 *   stay    — a few seconds by tier (REVEAL.hold), then it goes; Continue (click, E, Space, Enter) sooner, Esc closes.
 *
 * Rarity is the one palette (the GUI sheet's --gui-rarity-*: RarityBadge, the same in the journal and the book);
 * the Sea King's badge is holographic. prefers-reduced-motion develops at once without confetti or pops.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";
import { HOLO_GRADIENT, REVEAL, celebrate, fishOdds, iconFor, RARITY_META, type FishDef } from "@/lib/game/fishing";
import { oneLinerFor } from "@/lib/game/peaceful";
import { Badge, Button, RarityBadge } from "@/components/gui";

export default function FishReveal({ fish, sizeCm, recipe, isNew = true, newRecord = false, delay = 0, onDone }: {
  fish: FishDef;
  /** Null: no size recorded (a fish off the roster). */
  sizeCm: number | null;
  /** A recipe the catch taught (rare catches). */
  recipe?: string | null;
  /** The first of its kind: it develops from a silhouette, with its odds. */
  isNew?: boolean;
  /** A repeat that beat your record for the species. */
  newRecord?: boolean;
  /** ms before the card arrives (the world's catch beat plays first). */
  delay?: number;
  onDone: () => void;
}) {
  const cfg = REVEAL[fish.rarity];
  const meta = RARITY_META[fish.rarity];
  const holo = fish.rarity === "seaking";
  const odds = isNew ? fishOdds(fish) : null;
  const [developed, setDeveloped] = useState(!isNew);
  const cardRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    timers.current.forEach(t => window.clearTimeout(t));
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** The silhouette fills with colour: the name, a chime, soft confetti from the card (none with reduced motion). */
  const develop = useCallback(() => {
    if (done.current) return;
    setDeveloped(true);
    AudioManager.playSFX("confirm");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = cardRef.current?.getBoundingClientRect().top ?? window.innerHeight * 0.75;
    if (!calm) celebrate(fish.rarity, meta.color, { x: 0.5, y: Math.min(0.95, top / window.innerHeight) });
    timers.current.push(window.setTimeout(finish, cfg.hold));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A repeat develops as it arrives; a first catch keeps its silhouette a beat.
    timers.current.push(window.setTimeout(develop, delay + (isNew && !calm ? cfg.develop : 120)));
    const list = timers.current;
    return () => list.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Continue: a developing card shows now, a developed one goes. */
  const next = useCallback(() => {
    if (done.current) return;
    if (developed) finish();
    else { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; develop(); }
  }, [developed, develop, finish]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element | null)?.closest("button")) return;
      e.preventDefault(); e.stopPropagation(); next();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); return; }
      if (["e", "E", " ", "Enter"].includes(e.key)) {
        // Native buttons own Space and Enter; a key held from the reel never skips the card.
        if ((e.key === " " || e.key === "Enter") && (document.activeElement as Element | null)?.closest("button")) return;
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) next();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("pointerdown", onPointer, true); window.removeEventListener("keydown", onKey, true); };
  }, [next, finish]);

  const line = oneLinerFor(fish.key);
  return (
    <div className="tsi-catch-card" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", zoom: "var(--gui-overlay-zoom, 1)", zIndex: 60,
      width: "min(520px, 92vw)", pointerEvents: "none" }}>
      <div ref={cardRef} role="dialog" aria-modal="false" aria-live="polite" aria-label={developed ? `You caught ${fish.label}` : "A catch"} data-catch-card={developed ? "developed" : "developing"}
        style={{ pointerEvents: "auto", display: "grid", gridTemplateColumns: "92px 1fr", gap: 14, alignItems: "center", padding: "14px 18px 14px 14px",
          background: "var(--gui-paper-hi, #fffff7)", borderRadius: "var(--gui-r-card, 20px)", color: "var(--gui-ink, #4f3f31)", fontFamily: "var(--gui-font, sans-serif)",
          boxShadow: "var(--gui-shadow-lg, 0 6px 0 rgb(114 92 78 / 0.18), 0 22px 48px rgb(79 63 49 / 0.18)), inset 0 0 0 2.5px var(--gui-paper-edge, #e3d9b8)",
          opacity: 0, animation: `tsi-catch-in 420ms var(--gui-spring, cubic-bezier(0.2, 1.4, 0.4, 1)) ${delay}ms forwards` }}>
        {/* The fish on a round paper plate edged in its rarity. */}
        <div style={{ position: "relative", width: 92, height: 92, borderRadius: "var(--gui-r-blob, 50%)", display: "grid", placeItems: "center",
          background: "var(--gui-paper-warm, #f8f4e8)", boxShadow: `inset 0 0 0 3px ${developed ? `var(--gui-rarity-${fish.rarity})` : "var(--gui-paper-edge, #e3d9b8)"}`, transition: "box-shadow 320ms ease-out" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconFor(fish)} alt="" width={76} height={76} draggable={false}
            style={{ filter: developed ? "drop-shadow(0 3px 2px rgb(79 63 49 / 0.22))" : "brightness(0) opacity(0.5)", transition: "filter 380ms ease-out",
              animation: developed ? (isNew ? "tsi-catch-develop 460ms var(--gui-spring, ease-out)" : undefined) : "tsi-catch-wiggle 1.1s ease-in-out infinite" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--gui-text-xl, 22px)", fontWeight: 800, color: "var(--gui-ink-strong, #3a2e22)", lineHeight: 1.15 }}>{developed ? fish.name : "???"}</span>
            {isNew && <Badge tone="new">New!</Badge>}
            {!isNew && newRecord && <Badge tone="warn">New record</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap", opacity: developed ? 1 : 0, transition: "opacity 300ms ease-out 80ms" }}>
            <RarityBadge rarity={fish.rarity} style={holo ? { background: HOLO_GRADIENT, backgroundSize: "300% 100%", animation: "tsi-holo-shift 2.2s linear infinite" } : undefined}>{meta.label}</RarityBadge>
            {sizeCm !== null && <span style={{ fontSize: "var(--gui-text-sm, 13px)", fontWeight: 700, color: "var(--gui-ink-2, #6b5843)" }}>{sizeCm} cm</span>}
            {odds !== null && <span style={{ fontSize: "var(--gui-text-xs, 12px)", color: "var(--gui-muted, #726450)" }}>Base odds · 1 in {odds}</span>}
          </div>
          {line && <p style={{ margin: "8px 0 0", fontSize: "var(--gui-text-sm, 13px)", fontStyle: "italic", color: "var(--gui-ink-2, #6b5843)", opacity: developed ? 1 : 0, transition: "opacity 300ms ease-out 160ms" }} data-testid="catch-one-liner">“{line}”</p>}
          {recipe && <p style={{ margin: "6px 0 0", fontSize: "var(--gui-text-sm, 13px)", fontWeight: 800, color: "var(--gui-sage, #426b5b)" }} data-testid="reveal-recipe">You learned a recipe: {recipe}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <Button size="sm" variant="secondary" onClick={next}>{developed ? "Continue" : "Show me"}</Button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tsi-catch-in {
          0% { opacity: 0; transform: translateY(26px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tsi-catch-develop {
          0% { transform: scale(0.82) rotate(-6deg); }
          60% { transform: scale(1.12) rotate(3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes tsi-catch-wiggle {
          0%, 100% { transform: rotate(-4deg) translateY(0); }
          50% { transform: rotate(4deg) translateY(-3px); }
        }
        @keyframes tsi-holo-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        /* At the foot of the screen under the catch you hold up (Animal Crossing's text box); on touch, the HUD's lane
           above the stick and buttons. */
        .tsi-catch-card { bottom: 36px; }
        @media (pointer: coarse) { .tsi-catch-card { bottom: var(--hud-lane-bottom, 120px); } }
        @media (prefers-reduced-motion: reduce) {
          [data-catch-card] { animation-duration: 1ms !important; }
          [data-catch-card] img { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
