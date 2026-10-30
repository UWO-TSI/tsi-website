"use client";

/**
 * The match's HUD (specs/minigames/beach-volleyball.md §7), on the flat kit: the score top centre (you are home), the
 * serve timer under it while someone serves, the action bar at the foot (each move's pictogram, key and name; the
 * ground's moves and the air's swap in place as you jump, with no flicker), the triangle serve meter while you hold,
 * the spin picker while you serve, a grade over the bar for your touches, the point's word, and the final card with
 * the score, the coins and Play again and Leave. Only the player in the match has it.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ActionBar, ActionIcon, DarkButton, GhostButton, ServeMeter, SpinPicker, type ActionSlot } from "@/components/gui/flat";
import { volley, startVolleyAgain, stopVolley, useVolley } from "@/lib/game/volleyball/session";
import { HAND, reachOf, sideOfPlayer, type Match } from "@/lib/game/volleyball/match";
import { BAR, controlOf, stanceOf, type Action, type Control, type Stance } from "@/lib/game/volleyball/actions";
import { meterPower } from "@/lib/game/volleyball/timing";
import { VB_FEEL } from "@/lib/game/volleyball/feel";
import { sideOf } from "@/lib/game/volleyball/court";
import { timeToHeight } from "@/lib/game/volleyball/ball";
import VolleyStamps from "./VolleyStamps";
import { bindVolleySfx } from "@/lib/game/volleyball/sfx";
import s from "./volley.module.css";

const TEAM_VAR = ["var(--ui-home)", "var(--ui-away)"];
const BALL_ICON = "/assets/game/volleyball/ball-icon.png";
const LABEL: Record<Action, string> = {
  charge: "Hold to serve", serve: "Serve", spin: "Curve", bump: "Bump", set: "Set", jumpset: "Jump set", spike: "Spike", block: "Block",
  call: "Mine!", dive: "Dive", slide: "Slide dive", jump: "Jump", dash: "Dash",
};
const KEY: Record<Control, string> = { left: "Click", e: "E", right: "R-click", ctrl: "Ctrl", jump: "Space", dash: "Q" };
/** The rows the bar stacks (they crossfade in place). */
const ROWS: Stance[] = ["serve", "toss", "ground", "air"];

/**
 * The stance the bar shows, steadied: the air row only after a moment in the air, and the ground row back only after a
 * moment on the sand, so a hop on a slope or a landing frame never flickers it.
 */
const STEADY = { toAir: 0.04, toGround: 0.09 };
export function steadyStance(shown: Stance, now: Stance, heldFor: number): Stance {
  if (now === shown) return shown;
  if (now === "air") return heldFor >= STEADY.toAir ? now : shown;
  if (now === "ground" && shown === "air") return heldFor >= STEADY.toGround ? now : shown;
  // Between points the last row stays up, quiet.
  return now === "idle" ? shown : now;
}

/** Whether a move would connect now (its slot glows). */
function readyOf(m: Match, a: Action): boolean {
  const me = m.players[0], b = m.ball;
  if (m.phase !== "rally") return a === "serve" ? m.phase === "toss" : false;
  if (me.pend) return a === me.pend.how;
  const mySide = sideOfPlayer(m, 0), coming = sideOf(b.z) === mySide || (m.landing !== null && sideOf(m.landing.z) === mySide);
  if (a === "bump" || a === "set" || a === "spike" || a === "jumpset") {
    const kind = a === "jumpset" ? "set" : a;
    if (reachOf(m, 0, kind) !== null) return true;
    const t = timeToHeight(b, me.s.y + HAND[kind]);
    return coming && t !== null && t < VB_FEEL.timing.buffer;
  }
  if (a === "block") return me.s.mode === "air" && Math.abs(me.s.z) < VB_FEEL.block.nearNet && me.block <= 0 && !coming;
  if (a === "call") return coming && m.receiver[me.team] !== 0;
  if (a === "dive" || a === "slide") { const t = timeToHeight(b, HAND.dig); return coming && t !== null && t < 0.4; }
  return false;
}

/** The bar's rows for this frame. */
function rowsOf(m: Match): Record<string, ActionSlot[]> {
  const out: Record<string, ActionSlot[]> = {};
  for (const st of ROWS) out[st] = BAR[st].map(a => {
    const c = controlOf(st, a)!;
    const move = a === "dive" && m.players[0].sinceDash < 0.3 ? "slide" : a;
    return { id: move, label: LABEL[move], keycap: KEY[c], icon: <ActionIcon move={move} />, ready: readyOf(m, move), off: stanceOf(m, 0) === "idle" };
  });
  return out;
}

export default function VolleyHud() {
  const on = useVolley();
  const m = volley.match;
  const [, tick] = useState(0);
  const [shown, setShown] = useState<Stance>("ground");
  const timer = useRef<HTMLDivElement>(null);
  const live = useRef({ key: "", shown: "ground" as Stance, cand: "ground" as Stance, since: 0, last: 0 });

  // The match's sounds, while it's on.
  useEffect(() => (on ? bindVolleySfx() : undefined), [on]);

  // Per frame, only what moves: the timer's number, and a re-render when the bar, the meter or the spin change.
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = (now: number) => {
      const mm = volley.match, l = live.current;
      if (mm) {
        const t = timer.current;
        if (t) { const v = Math.ceil(mm.serveTimer); t.textContent = `${v}`; t.toggleAttribute("data-low", v <= 3); }
        const st = stanceOf(mm, 0), dt = l.last ? (now - l.last) / 1000 : 0;
        l.last = now;
        if (st !== l.cand) { l.cand = st; l.since = 0; } else l.since += dt;
        const next = steadyStance(l.shown, st, l.since);
        if (next !== l.shown) { l.shown = next; setShown(next); }
        const c = volley.controls;
        const key = [l.shown, mm.meter !== null ? meterPower(mm.meter).toFixed(3) : "", ...BAR[l.shown].map(a => readyOf(mm, a) ? 1 : 0),
          c ? `${c.spin.x.toFixed(2)},${c.spin.y.toFixed(2)}` : "", stanceOf(mm, 0)].join("|");
        if (key !== l.key) { l.key = key; tick(n => n + 1); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on || !m) return null;
  const [a, b] = m.score.points, over = m.phase === "over", serving = m.phase === "serve" || m.phase === "toss";
  const won = over && a > b, me = stanceOf(m, 0), flash = volley.flash, reward = volley.reward;
  const spin = spinNow();
  const pace = Math.round(((m.ball.k ?? 1) / VB_FEEL.pace.max) * 100);
  return (
    <div className={s.hud} data-testid="volley-hud">
      <VolleyStamps />
      <div className={s.score} aria-label={`Home ${a}, away ${b}`}>
        <span className={s.team} style={{ "--team": TEAM_VAR[0] } as CSSProperties} data-serving={m.score.serving === 0 || undefined}><i />Home</span>
        <span className={s.points}>
          <span key={`a${a}`} data-pop={a > 0 || undefined} style={{ "--team": TEAM_VAR[0] } as CSSProperties}>{a}</span><em>–</em>
          <span key={`b${b}`} data-pop={b > 0 || undefined} style={{ "--team": TEAM_VAR[1] } as CSSProperties}>{b}</span>
        </span>
        <span className={s.team} style={{ "--team": TEAM_VAR[1] } as CSSProperties} data-serving={m.score.serving === 1 || undefined}>Away<i /></span>
      </div>
      {serving && <div ref={timer} className={s.timer} aria-label="Serve timer">{Math.ceil(m.serveTimer)}</div>}
      {m.phase === "rally" && <div className={s.pace} aria-label={`Ball pace ${pace}%`} style={{ "--p": pace / 100 } as CSSProperties}><i /></div>}

      {!over && <div className={s.bar}>
        {flash?.grade && <div key={flash.n} className={s.grade} data-grade={flash.grade}>{flash.grade === "perfect" ? "Perfect!" : flash.grade === "good" ? "Good" : "Poor"}</div>}
        <ActionBar rows={rowsOf(m)} active={shown} flash={flash} />
      </div>}

      {m.meter !== null && <div className={s.meter}><ServeMeter value={meterPower(m.meter)} max={VB_FEEL.serve.maxPower} label="Serve power" /></div>}
      {me === "serve" && <div className={s.spinAt}><SpinPicker x={spin.x} y={spin.y} picture={BALL_ICON} label="Where on the ball you'll hit it"><span className={s.hint}>Hold R-click, move</span></SpinPicker></div>}
      {me === "toss" && m.maxPower && <div className={s.maxNote}>Max power</div>}

      {/* A point: the word in the scoring team's colour while the point plays out. */}
      {m.phase === "point" && m.pointTo !== null && <div key={a + b} className={s.word} style={{ "--team": TEAM_VAR[m.pointTo] } as CSSProperties}>
        <span>{m.pointTo === 0 ? "Point!" : "Their point"}</span>{m.switchPending && <small>Switch sides</small>}</div>}
      {!over && <GhostButton className={s.leave} onClick={stopVolley}>Leave</GhostButton>}
      {over && <>
        {won && <div className={s.confetti} aria-hidden="true">{Array.from({ length: 48 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, "--c": i % 3 === 2 ? "var(--ui-gold)" : TEAM_VAR[i % 2], "--d": `${2 + (i % 5) * 0.3}s`, "--w": `${(i % 7) * 0.12}s`, "--x": `${((i % 9) - 4) * 12}px` } as CSSProperties} />))}</div>}
        <div className={s.final} role="dialog" aria-label="Match over" data-won={won || undefined}>
          <img src={BALL_ICON} alt="" width={64} height={64} className={s.finalBall} />
          <h2>{won ? "You win!" : "Good game"}</h2>
          <p><span style={{ "--team": TEAM_VAR[0] } as CSSProperties}>{a}</span> – <span style={{ "--team": TEAM_VAR[1] } as CSSProperties}>{b}</span></p>
          {won && reward && reward.paid > 0 && <div className={s.coins}>+{reward.paid} coins</div>}
          {won && reward?.capped && <div className={s.quiet}>Today&apos;s coin wins are used up</div>}
          <div><DarkButton onClick={startVolleyAgain}>Play again</DarkButton><GhostButton onClick={stopVolley}>Leave</GhostButton></div>
        </div>
      </>}
    </div>
  );
}

/** The contact point the court's controls hold (VolleyMatch's; read for the picker). */
const spinNow = () => volley.controls?.spin ?? { x: 0, y: 0 };
