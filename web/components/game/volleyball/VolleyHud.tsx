"use client";

/**
 * The match's HUD (specs/minigames/beach-volleyball.md §7), on the flat kit and minimal: the score top centre (you are
 * home), the serve timer under it while someone serves, one key cue at a time when it matters, the power bar while you
 * hold the serve, a word on a point, and the final score with Play again and Leave. Only the player in the match has it.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DarkButton, GhostButton, PowerMeter } from "@/components/gui/flat";
import { Keycap } from "@/components/gui";
import { volley, startVolleyAgain, stopVolley, useVolley } from "@/lib/game/volleyball/session";
import { serverOf, sideOfPlayer, type Match } from "@/lib/game/volleyball/match";
import { meterPower } from "@/lib/game/volleyball/timing";
import { sideOf } from "@/lib/game/volleyball/court";
import { CAST } from "@/lib/game/fishing";
import s from "./volley.module.css";

const TEAM_VAR = ["var(--ui-home)", "var(--ui-away)"];

type Cue = "serve" | "toss" | "receive" | "air" | null;
/** The one cue that matters now (none most of the time). */
export function cueOf(m: Match): Cue {
  const me = m.players[0];
  if (serverOf(m) === 0 && m.phase === "serve") return "serve";
  if (serverOf(m) === 0 && m.phase === "toss") return "toss";
  if (m.phase !== "rally") return null;
  if (me.s.mode === "air") return "air";
  const mine = m.landing && sideOf(m.landing.z) === sideOfPlayer(m, 0) && m.receiver[0] === 0;
  return mine ? "receive" : null;
}

export default function VolleyHud() {
  const on = useVolley();
  const m = volley.match;
  const [, tick] = useState(0);
  const timer = useRef<HTMLDivElement>(null);
  const last = useRef({ cue: null as Cue, meter: false });

  // Per frame, only what moves: the timer's number, the cue and the power bar (re-rendered when they change).
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      const mm = volley.match;
      if (mm) {
        const t = timer.current;
        if (t) { const v = Math.ceil(mm.serveTimer); t.textContent = `${v}`; t.toggleAttribute("data-low", v <= 3); }
        const cue = cueOf(mm), meter = mm.meter !== null;
        if (cue !== last.current.cue || meter || meter !== last.current.meter) { last.current.cue = cue; last.current.meter = meter; tick(n => n + 1); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on || !m) return null;
  const [a, b] = m.score.points, cue = cueOf(m), over = m.phase === "over", serving = m.phase === "serve" || m.phase === "toss";
  const won = over && a > b;
  return (
    <div className={s.hud} data-testid="volley-hud">
      <div className={s.score} aria-label={`Home ${a}, away ${b}`}>
        <span className={s.team} style={{ "--team": TEAM_VAR[0] } as CSSProperties} data-serving={m.score.serving === 0 || undefined}><i />Home</span>
        <span className={s.points}><span key={`a${a}`} data-pop={a > 0 || undefined}>{a}</span><em>–</em><span key={`b${b}`} data-pop={b > 0 || undefined}>{b}</span></span>
        <span className={s.team} style={{ "--team": TEAM_VAR[1] } as CSSProperties} data-serving={m.score.serving === 1 || undefined}>Away<i /></span>
      </div>
      {serving && <div ref={timer} className={s.timer} aria-label="Serve timer">{Math.ceil(m.serveTimer)}</div>}
      {cue && !over && <div className={s.cue}>
        {cue === "serve" && <span><Keycap>Click</Keycap>Hold to serve</span>}
        {cue === "toss" && <span><Keycap>Click</Keycap>As the ring closes</span>}
        {cue === "receive" && <><span><Keycap>Click</Keycap>Bump</span><span><Keycap>E</Keycap>Set</span></>}
        {cue === "air" && <><span><Keycap>Click</Keycap>Spike</span><span><Keycap>Right</Keycap>Block</span></>}
      </div>}
      {m.meter !== null && <div className={s.meter}><PowerMeter value={meterPower(m.meter)} tip={CAST.maxZone} label="Serve power" /></div>}
      {/* A point: the word in the scoring team's colour while the point plays out. */}
      {m.phase === "point" && m.pointTo !== null && <div key={a + b} className={s.word} style={{ "--team": TEAM_VAR[m.pointTo] } as CSSProperties}>{m.switchPending ? "Point · switch sides" : "Point"}</div>}
      {!over && <GhostButton className={s.leave} onClick={stopVolley}>Leave</GhostButton>}
      {over && <>
        {won && <div className={s.confetti} aria-hidden="true">{Array.from({ length: 40 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, "--c": TEAM_VAR[i % 2], "--d": `${2 + (i % 5) * 0.3}s`, "--w": `${(i % 7) * 0.12}s`, "--x": `${((i % 9) - 4) * 12}px` } as CSSProperties} />))}</div>}
        <div className={s.final} role="dialog" aria-label="Match over">
          <h2>{won ? "You win!" : "Good game"}</h2>
          <p>{a} – {b}</p>
          <div><DarkButton onClick={startVolleyAgain}>Play again</DarkButton><GhostButton onClick={stopVolley}>Leave</GhostButton></div>
        </div>
      </>}
    </div>
  );
}
