"use client";

/**
 * The match's calls on the HUD layer, on the flat kit's tokens. Round 4 (David: "the text that shows up doesnt look good",
 * "less noticable"): one small quiet tag for every touch, at the touch on screen, rising a little and fading (your grade:
 * Perfect with a gold edge, Good, Early and Late in grey; Saved; Miss; Max for a max-power toss). A block says no word:
 * it reads by its effect, sound and camera. The referee's calls (Out, Net, Tape) sit in a chip under the score beside
 * the rally's heat chip, away from the play (David: "the text should show somewhere else"). The win keeps its trophy.
 *
 * Also here: the impact frames (fxPlan IMPACT, started and counted by VolleyFx through fxBus.impact): your perfect
 * spike's one negative frame and your dive's two split frames, the scene thresholded to ink by a backdrop filter so the
 * characters stand as silhouettes, focus lines rushing in on the hit after them; and the two screen edges (a cool one
 * at the top of your jump, a warm one with the rally's heat). Fed by fxBus (onFx); the edges and the flash per frame.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fxBus, onFx, type VbFx } from "@/lib/game/volleyball/fxBus";
import { HEAT, contactPlan, heatOf } from "@/lib/game/volleyball/fxPlan";
import { volley } from "@/lib/game/volleyball/session";
import { HAND, type Match } from "@/lib/game/volleyball/match";
import s from "./volleyStamps.module.css";

type Kind = "perfect" | "good" | "soft" | "saved" | "whiff" | "max" | "out" | "net" | "tape" | "win";
/** Where a call shows: at the touch, in the referee's chip under the score, or the win's trophy. */
type At = "hit" | "ref" | "win";
interface Call { text: string; kind: Kind; team: 0 | 1; at: At }
interface Shown extends Call { n: number; x: number; y: number }
const TEAM_VAR = ["var(--ui-home)", "var(--ui-away)"];

/** The call an effect makes, if any (null: none). */
export function stampOf(e: VbFx, human: number, myTeam: number): Call | null {
  if (e.kind === "contact") {
    const st = contactPlan(e.how, e.timing, e.who === human, e.team === myTeam).stamp;
    if (!st) return null;
    const kind: Kind = st === "Saved" ? "saved" : st === "Perfect" ? "perfect" : st === "Good" ? "good" : "soft";
    return { text: st, kind, team: e.team, at: "hit" };
  }
  if (e.kind === "land" && !e.in) return { text: "Out", kind: "out", team: 0, at: "ref" };
  if (e.kind === "net") return { text: "Net", kind: "net", team: 0, at: "ref" };
  if (e.kind === "tape") return { text: "Tape", kind: "tape", team: 0, at: "ref" };
  if (e.kind === "whiff" && e.who === human) return { text: "Miss", kind: "whiff", team: 0, at: "hit" };
  if (e.kind === "toss" && e.max && e.who === human) return { text: "Max", kind: "max", team: 0, at: "hit" };
  if (e.kind === "win" && e.team === myTeam) return { text: "You win!", kind: "win", team: e.team, at: "win" };
  return null;
}

/** Where a touch's tag starts on the view (0..1), a little over the touch; kept clear of the edges and the score. */
function hitPoint(e: VbFx, m: Match): [number, number] {
  const b = m.ball, p = "who" in e ? m.players[e.who] : null;
  const [x, y, z] = e.kind === "contact" ? [e.x, e.y, e.z] : e.kind === "whiff" && p ? [p.s.x, p.s.y + HAND.set, p.s.z] : [b.x, b.y, b.z];
  const at = fxBus.screen?.(x, y + 0.45, z) ?? [0.5, 0.4];
  return [Math.min(0.9, Math.max(0.1, at[0])), Math.min(0.78, Math.max(0.2, at[1]))];
}

/** The edges and the impact frame, set each frame (module scope: per-frame writes stay out of component code). */
function perFrame(apex: HTMLDivElement | null, heat: HTMLDivElement | null, flash: HTMLDivElement | null) {
  const m = volley.match, im = fxBus.impact;
  if (flash) {
    const on = im.left > 0 && im.kind ? im.kind : "";
    if ((flash.dataset.on ?? "") !== on) {
      if (on) { flash.style.setProperty("--x", `${im.x * 100}%`); flash.style.setProperty("--y", `${im.y * 100}%`); flash.dataset.on = on; }
      else delete flash.dataset.on;
    }
  }
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

/** The referee's calls' little pictures (24 × 24 in currentColor, the ball the home token), each with one small motion. */
function Glyph({ kind }: { kind: Kind }) {
  const svg = (body: ReactNode) => <svg className={s.glyph} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">{body}</svg>;
  switch (kind) {
    // The ball skips over the line and an X lands on it.
    case "out": return svg(<><path d="M3 19h11" /><circle cx={6} cy={15} r={2.6} className={s.skip} /><path d="M16 9l5 5M21 9l-5 5" className={s.slam} /></>);
    // The mesh bulges as the ball drives in.
    case "net": return svg(<><g className={s.mesh}><path d="M4 5h16M4 5v14M20 5v14M4 12h16M12 5v14" /></g><circle cx={12} cy={11} r={2.6} className={s.into} /></>);
    // The tape twangs as the ball rolls over it.
    case "tape": return svg(<><path d="M2 12h20" className={s.twang} /><path d="M4 12v8M20 12v8" /><circle cx={6} cy={8.6} r={2.4} className={s.roll} /></>);
    default: return null;
  }
}

/** A flame (the rally's heat), its tongues flickering. */
const Flame = () => <svg className={s.flame} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-5 1-8z" className={s.outer} /><path d="M12 11c1 2 3 3 3 6a3 3 0 0 1-6 0c0-2 2-3 3-6z" className={s.inner} />
</svg>;

/** The heat chip's start and its "On fire!" (fxPlan HEAT). */
const HEAT_FROM = 4;

export default function VolleyStamps() {
  const [hit, setHit] = useState<Shown | null>(null);
  const [ref, setRef] = useState<Shown | null>(null);
  const [win, setWin] = useState(false);
  const [rally, setRally] = useState(0);
  const [focus, setFocus] = useState<{ n: number; kind: string; x: number; y: number } | null>(null);
  const apex = useRef<HTMLDivElement>(null), heat = useRef<HTMLDivElement>(null), flash = useRef<HTMLDivElement>(null);
  useEffect(() => onFx(e => {
    const m = volley.match;
    if (!m) return;
    const st = stampOf(e, m.human, m.players[Math.max(0, m.human)].team);
    if (st?.at === "hit") { const [x, y] = hitPoint(e, m); setHit(prev => ({ ...st, n: (prev?.n ?? 0) + 1, x, y })); }
    else if (st?.at === "ref") setRef(prev => ({ ...st, n: (prev?.n ?? 0) + 1, x: 0, y: 0 }));
    else if (st?.at === "win") setWin(true);
    if (e.kind === "contact" && e.how !== "serve") setRally(m.rallyTouches);
    else if (e.kind === "point" || e.kind === "toss") { setRally(0); setWin(false); }
  }), []);
  useEffect(() => {
    let raf = 0, seen = fxBus.impact.n;
    const loop = () => {
      perFrame(apex.current, heat.current, flash.current);
      const im = fxBus.impact;
      // Focus lines rush in on the hit after each impact frame.
      if (im.n !== seen) { seen = im.n; setFocus({ n: im.n, kind: im.kind ?? "spike", x: im.x, y: im.y }); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const team = (c: Shown) => ({ "--team": TEAM_VAR[c.team] }) as CSSProperties;
  return <div className={s.layer} aria-live="polite">
    <div ref={apex} className={s.apex} aria-hidden="true" />
    <div ref={heat} className={s.heat} aria-hidden="true" />
    {focus && <div key={focus.n} className={s.focus} data-kind={focus.kind} style={{ "--x": `${focus.x * 100}%`, "--y": `${focus.y * 100}%` } as CSSProperties} aria-hidden="true" />}
    <div ref={flash} className={s.impact} aria-hidden="true"><i className={s.ink} /><i className={s.neg} /></div>
    <div className={s.under}>
      {rally >= HEAT_FROM && <span key={rally} className={s.rally} data-fire={rally >= HEAT.fireAt || undefined} style={{ "--h": heatOf(rally) } as CSSProperties} aria-label={`Rally of ${rally}`}>
        <Flame /><b>{rally}</b>{rally === HEAT.fireAt && <em>On fire!</em>}
      </span>}
      {ref && <span key={ref.n} className={s.ref} data-kind={ref.kind}><Glyph kind={ref.kind} />{ref.text}</span>}
    </div>
    {hit && <span key={hit.n} className={s.tag} data-kind={hit.kind} style={{ ...team(hit), left: `${hit.x * 100}%`, top: `${hit.y * 100}%` }}>{hit.text}</span>}
    {win && <div className={s.win} aria-label="You win!"><span className={s.rays} /><span className={s.trophy}><Trophy /></span></div>}
  </div>;
}
