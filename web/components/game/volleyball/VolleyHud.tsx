"use client";

/**
 * The match's HUD (specs/minigames/beach-volleyball.md §7), on the flat kit: the score top centre (you are home), the
 * serve timer under it while someone serves, the action bar at the foot (each move's silhouette, name and key: bump,
 * set and dive on the sand, swapping to spike, jump set and block the moment you leave it), the triangle serve meter
 * and the spin picker either side of the bar while you serve (low, out of the view), the point's word (the touches' grades are VolleyStamps'), and the final card with
 * the score, the coins and Play again and Leave. Only the player in the match has it.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ActionBar, ActionIcon, DarkButton, GhostButton, ServeMeter, SpinPicker, type ActionSlot } from "@/components/gui/flat";
import { volley, startVolleyAgain, stopVolley, useVolley } from "@/lib/game/volleyball/session";
import { HAND, diveTarget, meetOf, reachOf, sideOfPlayer, type Match } from "@/lib/game/volleyball/match";
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
  call: "Mine!", dive: "Dive", jump: "Jump",
};
const KEY: Record<Control, string> = { left: "Left click", e: "E", right: "Right click", jump: "Space", dash: "Q" };
const MOUSE: Partial<Record<Control, "left" | "right">> = { left: "left", right: "right" };
/** The rows the bar stacks (one shows at a time). */
const ROWS: Stance[] = ["serve", "toss", "ground", "air"];

/** The row the bar shows: your stance the moment it changes (a jump swaps at take-off and back at touchdown); between points the last row stays. */
export const shownStance = (shown: Stance, now: Stance): Stance => (now === "idle" ? shown : now);

/** Whether a move would connect now (its slot lifts and rings gold). */
function readyOf(m: Match, a: Action): boolean {
  const me = m.players[0], b = m.ball;
  if (m.phase !== "rally") return a === "serve" ? m.phase === "toss" : false;
  if (me.pend) return a === me.pend.how;
  const mySide = sideOfPlayer(m, 0), coming = sideOf(b.z) === mySide || (m.landing !== null && sideOf(m.landing.z) === mySide);
  if (a === "bump" || a === "set") {
    if (reachOf(m, 0, a) !== null) return true;
    const t = timeToHeight(b, me.s.y + HAND[a]);
    return coming && t !== null && t < VB_FEEL.timing.buffer;
  }
  if (a === "spike" || a === "jumpset") {
    const kind = a === "jumpset" ? "set" : a, mt = me.s.mode === "air" ? meetOf(m, 0, kind, VB_FEEL.air.buffer) : null;
    return !!mt && mt.off <= 0.85 + VB_FEEL.air.reach && Math.abs(mt.dy) <= 0.5 + VB_FEEL.air.band;
  }
  if (a === "block") return me.s.mode === "air" && Math.abs(me.s.z) < VB_FEEL.block.nearNet && me.block <= 0 && m.touchTeam !== me.team;
  if (a === "dive") { const t = diveTarget(m, 0); return !!t && t.t < 0.5 && reachOf(m, 0, "bump") === null; }
  return false;
}

/** The bar's rows for this frame. */
function rowsOf(m: Match): Record<string, ActionSlot[]> {
  const out: Record<string, ActionSlot[]> = {};
  for (const st of ROWS) out[st] = BAR[st].map(a => {
    const c = controlOf(st, a)!;
    return { id: a, label: LABEL[a], keycap: KEY[c], mouse: MOUSE[c], icon: <ActionIcon move={a} />, ready: readyOf(m, a), off: stanceOf(m, 0) === "idle" };
  });
  return out;
}

export default function VolleyHud() {
  const on = useVolley();
  const m = volley.match;
  const [, tick] = useState(0);
  const [shown, setShown] = useState<Stance>("ground");
  const timer = useRef<HTMLDivElement>(null), stack = useRef<HTMLDivElement>(null);
  const live = useRef({ key: "", shown: "ground" as Stance });

  // The match's sounds, while it's on.
  useEffect(() => (on ? bindVolleySfx() : undefined), [on]);

  // Per frame, only what moves: the timer's number, and a re-render when the bar, the meter or the spin change.
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      const mm = volley.match, l = live.current;
      if (mm) {
        const t = timer.current;
        if (t) { const v = Math.ceil(mm.serveTimer); t.textContent = `${v}`; t.toggleAttribute("data-low", v <= 3); }
        const next = shownStance(l.shown, stanceOf(mm, 0));
        if (next !== l.shown) {
          // The swap this frame, ahead of React's render (which then agrees).
          l.shown = next;
          stack.current?.querySelectorAll<HTMLElement>("[data-row]").forEach(el => el.toggleAttribute("data-active", el.dataset.row === next));
          setShown(next);
        }
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
        <ActionBar rows={rowsOf(m)} active={shown} flash={flash} stackRef={stack} />
      </div>}

      {m.meter !== null && <div className={s.meter}><ServeMeter value={meterPower(m.meter)} max={VB_FEEL.serve.maxPower} label="Serve power" /></div>}
      {me === "serve" && <div className={s.spinAt}><SpinPicker x={spin.x} y={spin.y} picture={BALL_ICON} label="Where on the ball you'll hit it"><span className={s.hint}>Hold R-click, move</span></SpinPicker></div>}

      {/* A point: the word in the scoring team's colour while the point plays out. */}
      {m.phase === "point" && m.pointTo !== null && <div key={a + b} className={s.word} data-them={m.pointTo !== 0 || undefined} style={{ "--team": TEAM_VAR[m.pointTo] } as CSSProperties}>
        <em className={s.plus}>+1</em><span>{m.pointTo === 0 ? "Point!" : "Their point"}</span>{m.switchPending && <small>Switch sides</small>}</div>}
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
