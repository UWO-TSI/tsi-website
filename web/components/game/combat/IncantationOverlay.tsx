"use client";

/**
 * Casting mode (rows C2, 52, 53): the rune floats over the world, which keeps
 * running; the caster stands still. Each stroke shows its start point and an
 * arrow for direction; trace with mouse or trackpad (drag). Accuracy reads out
 * live; under 50% fizzles, 95%+ is empowered. The dash key (the dodge) cancels.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { runeById, scoreTrace, strokeGuides, type Pt, type TracePt } from "@/lib/game/combat/runes";
import type { IncantationScore } from "@/lib/game/combat/contract";
import { keyName, useMoveKeys } from "@/lib/game/movement/keys";
import styles from "../DefaultIslandWorld.module.css";

const SIZE = 320;
const toPath = (s: (Pt | TracePt)[]) => s.map(([x, y], i) => `${i ? "L" : "M"}${(x * SIZE).toFixed(1)} ${(y * SIZE).toFixed(1)}`).join(" ");

export default function IncantationOverlay({ runeId, title, effect, onDone, onCancel }: { runeId: string; onDone: (score: IncantationScore) => void; onCancel: () => void;
  /** The kit ability being drawn (kits.ts), shown over the rune's own name. */
  title?: string; effect: string }) {
  const rune = runeById(runeId), dash = keyName(useMoveKeys().dash);
  const [strokes, setStrokes] = useState<TracePt[][]>([]);
  // The stroke being drawn grows in place (no copy per pointer move); a new wrapper re-renders it.
  const [current, setCurrent] = useState<{ pts: TracePt[] } | null>(null);
  const [started] = useState(() => performance.now());
  const [left, setLeft] = useState(rune.timeLimitMs);
  const [result, setResult] = useState<IncantationScore | null>(null);
  const box = useRef<SVGSVGElement>(null);
  // The HUD re-renders ~10×/s; keep the latest callbacks without restarting timers.
  const handlers = useRef({ onDone, onCancel });
  useEffect(() => { handlers.current = { onDone, onCancel }; });
  const guides = useMemo(() => strokeGuides(rune), [rune]);
  // Scored when a stroke ends (pointer-up), not on every move or HUD render.
  const live = useMemo(() => (strokes.length ? scoreTrace({ ...rune, strokes: rune.strokes.slice(0, strokes.length) }, strokes) : null), [rune, strokes]);
  const at = (e: React.PointerEvent): TracePt => { const r = box.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, performance.now() - started]; };
  // Time limit (systems rune data): the bar drains; running out fizzles the cast.
  useEffect(() => {
    if (result) return;
    const t = window.setInterval(() => {
      const remaining = rune.timeLimitMs - (performance.now() - started);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) setResult({ accuracy: 0, coverage: 0, deviation: 1, order: 0, scribble: false, outcome: "fail", power: 0 });
    }, 100);
    return () => window.clearInterval(t);
  }, [result, rune.timeLimitMs, started]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") handlers.current.onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => handlers.current.onDone(result), 700);
    return () => window.clearTimeout(t);
  }, [result]);
  const finishStroke = () => {
    const stroke = current?.pts;
    setCurrent(null);
    if (!stroke || stroke.length < 2) return;
    const next = [...strokes, stroke];
    setStrokes(next);
    if (next.length >= rune.strokes.length) setResult(scoreTrace(rune, next));
  };
  const nextStroke = Math.min(strokes.length, rune.strokes.length - 1);
  const shown = result ?? live;
  return <section className={styles.incantation} role="dialog" aria-label={`Incantation: ${rune.name}`} data-testid="incantation" data-outcome={result?.outcome}>
    <header><b>{title ? `${title} · ` : ""}{rune.name} · {rune.difficulty === "easy" ? "easy rune" : "hard rune"}</b><small>{effect}</small></header>
    <svg ref={box} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ touchAction: "none" }}
      onPointerDown={e => { if (result) return; e.currentTarget.setPointerCapture(e.pointerId); setCurrent({ pts: [at(e)] }); }}
      onPointerMove={e => { if (current) { current.pts.push(at(e)); setCurrent({ pts: current.pts }); } }}
      onPointerUp={finishStroke} onPointerCancel={finishStroke}>
      <defs><marker id="rune-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffe08a" /></marker></defs>
      {rune.strokes.map((s, i) => <path key={i} d={toPath(s)} className={styles.runeGuide} data-done={i < strokes.length || undefined} data-next={i === nextStroke && !result || undefined} />)}
      {guides.map((g, i) => i >= strokes.length && <g key={i} opacity={i === nextStroke ? 1 : 0.45}>
        <line x1={g.start[0] * SIZE} y1={g.start[1] * SIZE} x2={g.start[0] * SIZE + Math.cos(g.angle) * 30} y2={g.start[1] * SIZE + Math.sin(g.angle) * 30} stroke="#ffe08a" strokeWidth={3} markerEnd="url(#rune-arrow)" />
        <circle cx={g.start[0] * SIZE} cy={g.start[1] * SIZE} r={11} fill="#ffe08a" />
        <text x={g.start[0] * SIZE} y={g.start[1] * SIZE + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2b1d3d">{i + 1}</text>
      </g>)}
      {[...strokes, ...(current ? [current.pts] : [])].map((s, i) => <path key={`t${i}`} d={toPath(s)} className={styles.runeTrace} />)}
    </svg>
    <div className={styles.runeTimer} aria-label="Time left"><span style={{ width: `${(left / rune.timeLimitMs) * 100}%` }} /></div>
    <p className={styles.runeReadout} role="status">
      {result ? (result.outcome === "fail" ? (left <= 0 && result.accuracy === 0 ? "Out of time · fizzled" : `Fizzled · ${Math.round(result.accuracy)}%`) : `${result.outcome === "enhanced" ? "Empowered" : "Cast"} · ${Math.round(result.accuracy)}%`)
        : shown ? `Accuracy ${Math.round(shown.accuracy)}% · stroke ${strokes.length + 1} of ${rune.strokes.length}` : `Trace from the numbered dot, following the arrow · ${rune.strokes.length} stroke${rune.strokes.length > 1 ? "s" : ""}`}
    </p>
    <small className={styles.hint}>Under 50% fizzles · 95% and up is empowered · {dash} dodges and cancels</small>
  </section>;
}
