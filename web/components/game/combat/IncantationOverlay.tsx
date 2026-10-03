"use client";

/**
 * Casting mode (rows C2, 52, 53): the rune floats over the world, which keeps
 * running; the caster stands still. Each stroke shows its start point and an
 * arrow for direction; trace with mouse or trackpad (drag). Accuracy reads out
 * live; under 50% fizzles, 95%+ is empowered. The dash key (the dodge) cancels.
 *
 * Under mouse-look (classes v2, the Priest's shapes) the pointer stays locked: the overlay sits in the middle of the
 * screen, the mouse's movement moves a pen dot instead of the camera (orbitCamera `pen`), the button draws, and the
 * pen waits on each stroke's numbered dot; WASD keeps moving you.
 *
 * Classes v2 shapes (the Priest, David 2026-10-02): a directional shape (the Holy Beam's line, Light Step's chevron) turns
 * to point the way the spell will go on screen (`angle`: 0 right, -π/2 up), so you draw the line the way the beam goes
 * and the chevron where you dash; the readout gives the spell's power for the accuracy (`power`: 60% for a rough
 * sketch up to 150% for a clean one).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DIRECTIONAL, runeById, scoreTrace, strokeGuides, turnRune, type Pt, type TracePt } from "@/lib/game/combat/runes";
import type { IncantationScore } from "@/lib/game/combat/contract";
import { keyName, useMoveKeys } from "@/lib/game/movement/keys";
import { capture, pen } from "@/lib/game/orbitCamera";
import styles from "../DefaultIslandWorld.module.css";

const SIZE = 320;
const toPath = (s: (Pt | TracePt)[]) => s.map(([x, y], i) => `${i ? "L" : "M"}${(x * SIZE).toFixed(1)} ${(y * SIZE).toFixed(1)}`).join(" ");

export default function IncantationOverlay({ runeId, title, effect, onDone, onCancel, angle, power }: { runeId: string; onDone: (score: IncantationScore) => void; onCancel: () => void;
  /** The kit ability being drawn (kits.ts), shown over the rune's own name. */
  title?: string; effect: string;
  /** Classes v2: where the spell goes on screen (radians, 0 right, -π/2 up): a directional shape turns to point there. */
  angle?: number;
  /** Classes v2: the spell's power for an accuracy (abilities.ts shapePotency), shown in the readout. */
  power?: (accuracy: number) => number }) {
  const [turn] = useState(() => (angle !== undefined && DIRECTIONAL.has(runeId) ? angle : 0)); // fixed when the drawing opens
  const rune = useMemo(() => turnRune(runeById(runeId), turn), [runeId, turn]), dash = keyName(useMoveKeys().dash);
  const [strokes, setStrokes] = useState<TracePt[][]>([]);
  // The stroke being drawn grows in place (no copy per pointer move); a new wrapper re-renders it. Its points live in a
  // ref: pointer and pen events come faster than React renders (a quick flick of a line or a chevron ended before the
  // first point had rendered, and was lost), and the pen's listeners are bound again on every render.
  const [current, setCurrent] = useState<{ pts: TracePt[] } | null>(null);
  const drawing = useRef<TracePt[] | null>(null);
  const [started] = useState(() => performance.now());
  const [left, setLeft] = useState(rune.timeLimitMs);
  const [result, setResult] = useState<IncantationScore | null>(null);
  const box = useRef<SVGSVGElement>(null);
  // The HUD re-renders ~10×/s; keep the latest callbacks without restarting timers.
  const handlers = useRef({ onDone, onCancel });
  useEffect(() => { handlers.current = { onDone, onCancel }; });
  const guides = useMemo(() => strokeGuides(rune), [rune]);
  // Mouse-look: the locked mouse is a pen on this overlay (no cursor to drag), parked on the next stroke's dot.
  const [locked] = useState(() => capture.state === "captured");
  const [penAt, setPenAt] = useState<[number, number]>(() => guides[0]?.start ?? [0.5, 0.5]);
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
    const stroke = drawing.current;
    drawing.current = null;
    setCurrent(null);
    if (!stroke || stroke.length < 2) return;
    const next = [...strokes, stroke];
    setStrokes(next);
    if (locked && guides[next.length]) setPenAt(guides[next.length].start); // the pen waits on the next numbered dot
    if (next.length >= rune.strokes.length) setResult(scoreTrace(rune, next));
  };
  const nextStroke = Math.min(strokes.length, rune.strokes.length - 1);
  useEffect(() => {
    if (!locked || result) return;
    let at = penAt;
    const stamp = (): TracePt => [at[0], at[1], performance.now() - started];
    pen.move = (dx, dy) => {
      at = [Math.min(1.05, Math.max(-0.05, at[0] + dx / SIZE)), Math.min(1.05, Math.max(-0.05, at[1] + dy / SIZE))];
      setPenAt(at);
      if (drawing.current) { drawing.current.push(stamp()); setCurrent({ pts: drawing.current }); }
    };
    const down = (e: MouseEvent) => { if (e.button === 0) { drawing.current = [stamp()]; setCurrent({ pts: drawing.current }); } };
    const up = (e: MouseEvent) => { if (e.button === 0 && drawing.current) finishStroke(); };
    document.addEventListener("mousedown", down); document.addEventListener("mouseup", up);
    return () => { pen.move = null; document.removeEventListener("mousedown", down); document.removeEventListener("mouseup", up); };
  });
  const shown = result ?? live;
  // Not a dialog under mouse-look: a dialog takes the cursor back (useOrbitInput), and the pen needs the lock.
  return <section className={styles.incantation} role={locked ? "group" : "dialog"} aria-label={`Incantation: ${rune.name}`} data-testid="incantation" data-outcome={result?.outcome} data-pen={locked || undefined}>
    <header><b>{title ? `${title} · ` : ""}{rune.name} · {rune.difficulty === "easy" ? "easy rune" : "hard rune"}</b><small>{effect}</small></header>
    <svg ref={box} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ touchAction: "none" }}
      onPointerDown={e => { if (result) return; e.currentTarget.setPointerCapture(e.pointerId); drawing.current = [at(e)]; setCurrent({ pts: drawing.current }); }}
      onPointerMove={e => { if (drawing.current) { drawing.current.push(at(e)); setCurrent({ pts: drawing.current }); } }}
      onPointerUp={finishStroke} onPointerCancel={finishStroke}>
      <defs><marker id="rune-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#725c4e" /></marker></defs>
      {rune.strokes.map((s, i) => <path key={i} d={toPath(s)} className={styles.runeGuide} data-done={i < strokes.length || undefined} data-next={i === nextStroke && !result || undefined} />)}
      {guides.map((g, i) => i >= strokes.length && <g key={i} opacity={i === nextStroke ? 1 : 0.45}>
        <line x1={g.start[0] * SIZE} y1={g.start[1] * SIZE} x2={g.start[0] * SIZE + Math.cos(g.angle) * 30} y2={g.start[1] * SIZE + Math.sin(g.angle) * 30} stroke="#725c4e" strokeWidth={3} markerEnd="url(#rune-arrow)" />
        <circle cx={g.start[0] * SIZE} cy={g.start[1] * SIZE} r={11} fill="#725c4e" />
        <text x={g.start[0] * SIZE} y={g.start[1] * SIZE + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fffbe7">{i + 1}</text>
      </g>)}
      {[...strokes, ...(current ? [current.pts] : [])].map((s, i) => <path key={`t${i}`} d={toPath(s)} className={styles.runeTrace} />)}
      {locked && !result && <circle cx={penAt[0] * SIZE} cy={penAt[1] * SIZE} r={6} fill="#fff6dc" stroke="#2b1d3d" strokeWidth={2} />}
    </svg>
    <div className={styles.runeTimer} aria-label="Time left"><span style={{ width: `${(left / rune.timeLimitMs) * 100}%` }} /></div>
    <p className={styles.runeReadout} role="status" data-testid="rune-readout">
      {result ? (result.outcome === "fail" ? (left <= 0 && result.accuracy === 0 ? "Out of time · fizzled" : `Fizzled · ${Math.round(result.accuracy)}%`)
        : `${result.outcome === "enhanced" ? "Empowered" : "Cast"} · ${Math.round(result.accuracy)}%${power ? ` · power ${Math.round(power(result.accuracy) * 100)}%` : ""}`)
        : shown ? `Accuracy ${Math.round(shown.accuracy)}%${power && shown.accuracy >= 50 ? ` · power ${Math.round(power(shown.accuracy) * 100)}%` : ""} · stroke ${strokes.length + 1} of ${rune.strokes.length}`
        : `Trace from the numbered dot, following the arrow · ${rune.strokes.length} stroke${rune.strokes.length > 1 ? "s" : ""}`}
    </p>
    <small className={styles.hint}>{locked ? "Hold the mouse button and move the mouse to draw · " : ""}{power ? "Under 50% fizzles · a rough sketch casts at 60%, a clean one up to 150%" : "Under 50% fizzles · 95% and up is empowered"} · {dash} dodges and cancels</small>
  </section>;
}
