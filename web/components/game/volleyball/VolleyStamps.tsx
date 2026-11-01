"use client";

/**
 * The match's words over the action (David's approved plan, 2026-10-30), on the HUD layer and the flat kit's tokens:
 * your touch's grade (Perfect! in gold and big; Good clean; Early and Late as small soft tags), BLOCK!, SAVED!, OUT,
 * NET, TAPE!, Miss, MAX! for a max-power toss, and the trophy on a win. One at a time. Round 3 (David: "need to feel
 * like its ... with micro animation and juice"): each moment's stamp carries a little animated picture that says what
 * it is at a glance (the ball skipping over the line for OUT, the mesh bulging for NET, the tape twanging, a swish past
 * an empty hand for a miss, palms slamming for a block, the trophy bouncing in turning rays), and the rally's heat is
 * a flame chip under the score that grows with every touch. Behind them, two screen edges: a cool one at the top of
 * your jump, and a warm one that grows with the rally's heat. Fed by fxBus (onFx); the edges read the match each frame.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { onFx, type VbFx } from "@/lib/game/volleyball/fxBus";
import { HEAT, contactPlan, heatOf } from "@/lib/game/volleyball/fxPlan";
import { volley } from "@/lib/game/volleyball/session";
import { HAND } from "@/lib/game/volleyball/match";
import s from "./volleyStamps.module.css";

type Kind = "perfect" | "good" | "soft" | "block" | "saved" | "out" | "net" | "tape" | "whiff" | "max" | "win";
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
  if (e.kind === "net") return { text: "NET", kind: "net", team: 0 };
  if (e.kind === "tape") return { text: "TAPE!", kind: "tape", team: 0 };
  if (e.kind === "whiff" && e.who === human) return { text: "Miss", kind: "whiff", team: 0 };
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

/** Each stamp's little animated picture (24 × 24 in currentColor; the ball the home token). Null: the word alone. */
function Glyph({ kind }: { kind: Kind }) {
  const svg = (body: ReactNode) => <svg className={s.glyph} viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{body}</svg>;
  switch (kind) {
    // The ball skips over the line and an X slams down.
    case "out": return svg(<><path d="M3 19h11" className={s.line} /><circle cx={6} cy={15} r={2.6} className={s.skip} /><path d="M16 9l5 5M21 9l-5 5" className={s.slam} /></>);
    // The mesh bulges as the ball drives in, then lets it drop.
    case "net": return svg(<><g className={s.mesh}><path d="M4 5h16M4 5v14M20 5v14M4 10h16M4 15h16M9 5v14M14.5 5v14" /></g><circle cx={12} cy={11} r={2.6} className={s.into} /></>);
    // The tape twangs as the ball rolls over it.
    case "tape": return svg(<><path d="M2 12h20" className={s.twang} /><path d="M4 12v8M20 12v8" /><circle cx={6} cy={8.6} r={2.4} className={s.roll} /></>);
    // A swish through empty air past an open hand, the ball sailing by.
    case "whiff": return svg(<><path d="M4 16c4-8 12-10 17-6" className={s.swish} /><path d="M6 20l2-3M9 21l1-3" /><circle cx={18} cy={6} r={2.2} className={s.pass} /></>);
    // Two palms slam shut on the ball.
    case "block": return svg(<><path d="M7 4v9M5 6v6M9 5v8M7 13l-2 6" className={s.palmL} /><path d="M17 4v9M15 5v8M19 6v6M17 13l2 6" className={s.palmR} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" className={s.burst} /></>);
    // A body flat out, the ball popping up off the hand.
    case "saved": return svg(<><path d="M3 18h7l5 2" /><circle cx={4} cy={15} r={1.8} fill="currentColor" stroke="none" /><circle cx={17} cy={13} r={2.4} className={s.pop} /><path d="M2 22h20" /></>);
    default: return null;
  }
}

/** A flame (the rally's heat), its tongues flickering. */
const Flame = () => <svg className={s.flame} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-5 1-8z" className={s.outer} /><path d="M12 11c1 2 3 3 3 6a3 3 0 0 1-6 0c0-2 2-3 3-6z" className={s.inner} />
</svg>;

/** The heat chip's start and its "On fire!" (fxPlan HEAT). */
const HEAT_FROM = 4;

export default function VolleyStamps() {
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [rally, setRally] = useState(0);
  const apex = useRef<HTMLDivElement>(null), heat = useRef<HTMLDivElement>(null);
  useEffect(() => onFx(e => {
    const m = volley.match;
    if (!m) return;
    const st = stampOf(e, m.human, m.players[Math.max(0, m.human)].team);
    if (st) setStamp(prev => ({ ...st, n: (prev?.n ?? 0) + 1 }));
    if (e.kind === "contact" && e.how !== "serve") setRally(m.rallyTouches);
    else if (e.kind === "point" || e.kind === "toss") setRally(0);
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
    {rally >= HEAT_FROM && <div key={rally} className={s.rally} data-fire={rally >= HEAT.fireAt || undefined} style={{ "--h": heatOf(rally) } as CSSProperties} aria-label={`Rally of ${rally}`}>
      <Flame /><b>{rally}</b>{rally === HEAT.fireAt && <em>On fire!</em>}
    </div>}
    {stamp && <div key={stamp.n} className={s.stamp} data-kind={stamp.kind} style={{ "--team": TEAM_VAR[stamp.team] } as CSSProperties}>
      {stamp.kind === "win" && <><span className={s.rays} /><span className={s.trophy}><Trophy /></span></>}
      <b><Glyph kind={stamp.kind} />{stamp.text}</b>
    </div>}
  </div>;
}
