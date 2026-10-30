"use client";

/**
 * The match's words over the action (David's approved plan, 2026-10-30), on the HUD layer and the flat kit's tokens:
 * your touch's grade (Perfect! in gold and big; Good clean; Early and Late as small soft tags), BLOCK!, SAVED!, OUT,
 * MAX! for a max-power toss, and the trophy on a win. One at a time, each springing in and out. Behind them, two
 * screen edges: a cool one at the top of your jump (the apex's slow-mo), and a warm one that grows with the rally's heat.
 * Fed by fxBus (onFx); the edges read the match each frame through refs.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { onFx, type VbFx } from "@/lib/game/volleyball/fxBus";
import { contactPlan, heatOf } from "@/lib/game/volleyball/fxPlan";
import { volley } from "@/lib/game/volleyball/session";
import { HAND } from "@/lib/game/volleyball/match";
import s from "./volleyStamps.module.css";

type Kind = "perfect" | "good" | "soft" | "block" | "saved" | "out" | "max" | "win";
interface Stamp { n: number; text: string; kind: Kind; team: 0 | 1 }
const TEAM_VAR = ["var(--ui-home)", "var(--ui-away)"];

/** The stamp an effect shows, if any (null: none). */
export function stampOf(e: VbFx, human: number, myTeam: number): Omit<Stamp, "n"> | null {
  if (e.kind === "contact") {
    const st = contactPlan(e.how, e.timing, e.who === human, e.team === myTeam).stamp;
    if (!st) return null;
    const kind: Kind = st === "BLOCK!" ? "block" : st === "SAVED!" ? "saved" : st === "Perfect!" ? "perfect" : st === "Good" ? "good" : "soft";
    return { text: st, kind, team: e.team };
  }
  if (e.kind === "land" && !e.in) return { text: "OUT", kind: "out", team: 0 };
  if (e.kind === "toss" && e.max && e.who === human) return { text: "MAX!", kind: "max", team: 0 };
  if (e.kind === "win" && e.team === myTeam) return { text: "You win!", kind: "win", team: e.team };
  return null;
}

/** The two screen edges, set each frame (module scope: per-frame writes stay out of component code). */
function edges(apex: HTMLDivElement | null, heat: HTMLDivElement | null) {
  const m = volley.match;
  if (!m || m.human < 0) { if (apex) apex.style.opacity = "0"; if (heat) heat.style.opacity = "0"; return; }
  const me = m.players[m.human], b = m.ball;
  const near = me.s.mode === "air" && Math.abs(me.s.vy) < 2.2 && Math.hypot(b.x - me.s.x, b.y - me.s.y - HAND.spike, b.z - me.s.z) < 3.2;
  if (apex) apex.style.opacity = near ? "1" : "0";
  if (heat) heat.style.opacity = m.phase === "rally" ? String(Math.max(0, heatOf(m.rallyTouches) - 0.25) * 1.2) : "0";
}

/** A trophy, drawn in currentColor (the gold token). */
const Trophy = () => <svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true" fill="currentColor">
  <path d="M18 8h28v6h10c0 12-6 18-14 19-2 6-6 9-8 10v7h8v6H22v-6h8v-7c-2-1-6-4-8-10C14 32 8 26 8 14h10V8zm0 12h-4c1 5 3 8 6 9-1-3-2-6-2-9zm28 0c0 3-1 6-2 9 3-1 5-4 6-9h-4z" />
</svg>;

export default function VolleyStamps() {
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const apex = useRef<HTMLDivElement>(null), heat = useRef<HTMLDivElement>(null);
  useEffect(() => onFx(e => {
    const m = volley.match;
    if (!m) return;
    const st = stampOf(e, m.human, m.players[Math.max(0, m.human)].team);
    if (st) setStamp(prev => ({ ...st, n: (prev?.n ?? 0) + 1 }));
  }), []);
  useEffect(() => {
    let raf = 0;
    const loop = () => { edges(apex.current, heat.current); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className={s.layer} aria-live="polite">
    <div ref={apex} className={s.apex} aria-hidden="true" />
    <div ref={heat} className={s.heat} aria-hidden="true" />
    {stamp && <div key={stamp.n} className={s.stamp} data-kind={stamp.kind} style={{ "--team": TEAM_VAR[stamp.team] } as CSSProperties}>
      {stamp.kind === "win" && <span className={s.trophy}><Trophy /></span>}
      <b>{stamp.text}</b>
    </div>}
  </div>;
}
