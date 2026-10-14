"use client";

/**
 * The arrival (specs/v1-drop.md §1): one continuous sequence after the title screen, once per account. This is its
 * page side: it runs the sequence (lib/game/arrival/sequence.ts) on its own clock (the island's canvas is paused under
 * the creator), fades in on Bram's boat, shows the reflection creator, starts the crossing's boat and veils its ends in
 * golden mist, takes the skip keys, and shows the tutorial's one-time keycap glyphs and its way out. Inside the island's
 * canvas, ArrivalWorld frames the crossing and walks Bram through the tutorial.
 *
 * Every beat is skippable but the choice in the water: Space, Enter, E or Escape (or a tap on the pill) skips the beat
 * showing; the crossing skips to the landing under a quick mist; the tour can be left in one click (principle 7).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Fish, BookOpen } from "lucide-react";
import { Keycap } from "@/components/gui";
import { holdCreatorOpen } from "@/lib/game/character/creatorPresence";
import type { CharacterLook } from "@/lib/game/character/look";
import { isTyping } from "@/lib/game/useWorldDialog";
import { escapeEndedCapture } from "@/lib/game/orbitCamera";
import { worldNow } from "@/lib/game/worldClock";
import { myTrip, tripChanged } from "@/lib/game/myTrip";
import { TRIP, skipCrossing } from "@/lib/game/boatTrip";
import { ARRIVAL_TIMES, skipArrival, startArrival, stepArrival, type ArrivalPhase } from "@/lib/game/arrival/sequence";
import { arrivalChanged, arrivalRun, readArrival, resetArrival, subscribeArrival } from "@/lib/game/arrival/arrivalStore";
import ReflectionCreator from "./ReflectionCreator";
import s from "./Arrival.module.css";

const SKIP_KEYS = [" ", "enter", "e", "escape"];
const SKIPPABLE: ReadonlySet<ArrivalPhase> = new Set(["aboard", "clearing", "crossing"]);
/** The beats the creator's canvas covers the island in (it pauses the island's drawing). */
const COVERED: ReadonlySet<ArrivalPhase> = new Set(["aboard", "creator", "clearing"]);
const GLYPH_MS = 4800;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How thick the golden mist is now (0..1): up as Yes clears the water, thinning off the island in the drone shot, up again as the boat docks and off you on the pier. */
function mistNow(phase: ArrivalPhase, since: number, skipAt: number | null): number {
  const trip = myTrip.current;
  let m = 0;
  if (phase === "clearing") m = smooth(ARRIVAL_TIMES.clearing - 0.7, ARRIVAL_TIMES.clearing, since);
  else if (phase === "crossing") {
    const t = trip?.crossing ? Math.max(0, (worldNow() - trip.at) / 1000) : 0;
    m = !trip?.crossing || trip.phase === "load" ? 1 : trip.phase === "cross" ? 1 - smooth(0.3, 4.6, t) * 0.97 : trip.phase === "dock" ? smooth(TRIP.dock - 0.55, TRIP.dock, t) : 1;
  } else if (phase === "landing") m = 1 - smooth(0.3, 1.2, since);
  if (skipAt !== null) m = Math.max(m, smooth(0, 0.28, (performance.now() - skipAt) / 1000));
  return m;
}

export default function Arrival({ play, look, askName, touch, keys, onCross, onSaveLook, onDone }: {
  /** Start it (once) when this turns true: the island is up and this account hasn't arrived. */
  play: boolean;
  look: CharacterLook;
  askName?: { current: string };
  touch: boolean;
  /** The keys the glyphs show (the player's own bindings). */
  keys: { wheel: string; bag: string };
  /** The crossing begins: the boat in from far out (useTripControl's arrival with `crossing`). */
  onCross: () => void;
  onSaveLook: (look: CharacterLook, name: string | null) => void;
  /** It's over (the tour walked or left): the flag, the reward, the objective. */
  onDone: () => void;
}) {
  const key = useSyncExternalStore(subscribeArrival, readArrival, () => "");
  const phase = key ? (key.split("|")[0] as ArrivalPhase) : null;
  const mist = useRef<HTMLDivElement>(null);
  const skipAt = useRef<number | null>(null);
  const crossed = useRef(false);
  const [glyph, setGlyph] = useState<{ key: "wheel" | "bag"; at: number } | null>(null);
  const onDoneRef = useRef(onDone), onCrossRef = useRef(onCross);
  useEffect(() => { onDoneRef.current = onDone; onCrossRef.current = onCross; }, [onDone, onCross]);

  // Start once.
  useEffect(() => {
    if (!play || arrivalRun.current) return;
    crossed.current = false;
    arrivalRun.current = startArrival(performance.now());
    arrivalChanged();
  }, [play]);

  // The island stops drawing under the creator's canvas (it resumes for the crossing).
  const covered = !!phase && COVERED.has(phase);
  useEffect(() => (covered ? holdCreatorOpen() : undefined), [covered]);

  // The sequence's clock: its timed beats, its signals from the boat and the tour, the mist.
  useEffect(() => {
    if (!phase || phase === "done") return;
    let raf = 0;
    const frame = () => {
      const a = arrivalRun.current;
      if (!a) return;
      const now = performance.now(), trip = myTrip.current;
      const sig = arrivalRun.signals;
      if (crossed.current) {
        sig.landed ||= !trip || (!!trip.crossing && (trip.phase === "land" || trip.phase === "done"));
        sig.ashore ||= !trip;
      }
      if (stepArrival(a, now, sig)) arrivalChanged();
      if (mist.current) mist.current.style.opacity = mistNow(a.phase, (now - a.at) / 1000, skipAt.current).toFixed(3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // The crossing begins: the boat; the landing: the skip's mist lifts.
  useEffect(() => {
    if (phase === "crossing" && !crossed.current) { crossed.current = true; onCrossRef.current(); }
    if (phase === "landing") skipAt.current = null;
    if (phase === "done") { onDoneRef.current(); resetArrival(); }
  }, [phase]);

  // The tutorial's glyphs (arrivalStore), each once.
  useEffect(() => {
    const g = arrivalRun.glyph;
    if (!g || (glyph && glyph.at === g.at)) return;
    setGlyph(g);
    const t = window.setTimeout(() => setGlyph(null), GLYPH_MS);
    return () => window.clearTimeout(t);
  }, [key, glyph]);

  const skip = () => {
    const a = arrivalRun.current;
    if (!a) return;
    if (a.phase === "crossing") {
      const trip = myTrip.current;
      if (!trip?.crossing || skipAt.current !== null) return;
      // A quick mist comes up, then the boat is at the pier.
      skipAt.current = performance.now();
      window.setTimeout(() => { const t = myTrip.current; if (t && skipCrossing(t, worldNow())) tripChanged(); }, 300);
      return;
    }
    if (skipArrival(a, performance.now())) arrivalChanged();
  };
  const skipRef = useRef(skip);
  useEffect(() => { skipRef.current = skip; });
  // Dev (evidence scripts): where the arrival is, and a press to skip.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __arrival: {
      state: () => { const a = arrivalRun.current, t = myTrip.current; return a && { phase: a.phase, t: (performance.now() - a.at) / 1000, choices: a.choices, tutorial: arrivalRun.tutorial && { stop: arrivalRun.tutorial.stop, stage: arrivalRun.tutorial.stage, done: arrivalRun.tutorial.done }, trip: t && { phase: t.phase, t: (worldNow() - t.at) / 1000 } }; },
      skip: () => skipRef.current(),
      /** How many choices made (each sharpens the world): tuning the creator's look at a given clarity. */
      choices: (n: number) => { if (arrivalRun.current) arrivalRun.current.choices = n; },
    } });
  }, []);
  useEffect(() => {
    if (!phase || !SKIPPABLE.has(phase)) return;
    const press = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.repeat || !SKIP_KEYS.includes(k) || isTyping(e.target as Element)) return;
      if (k === "escape" && escapeEndedCapture()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      skipRef.current();
    };
    window.addEventListener("keydown", press, true);
    return () => window.removeEventListener("keydown", press, true);
  }, [phase]);

  if (!phase || phase === "done") return null;
  const creator = phase === "aboard" || phase === "creator" || phase === "clearing";
  const cinematic = phase === "crossing" || phase === "landing";
  return <div className={`${s.arrival} gui`} data-phase={phase} data-testid="arrival">
    {creator && <ReflectionCreator phase={phase} initial={look} askName={askName} onYes={(l, name) => { onSaveLook(l, name); arrivalRun.signals.yes = true; }} />}
    {/* The opening: black lifting off Bram's boat. */}
    {phase === "aboard" && <div className={s.fadeIn} aria-hidden="true" style={{ "--fade-ms": `${ARRIVAL_TIMES.fadeIn * 1000}ms` } as CSSProperties} />}
    {cinematic && <div className={s.letterbox} aria-hidden="true"><i /><i /></div>}
    <div ref={mist} className={s.mist} aria-hidden="true" style={{ opacity: 0 }} />
    {SKIPPABLE.has(phase) && <button type="button" key={phase} className={s.skip} data-touch={touch || undefined} onClick={skip} data-testid="arrival-skip">
      {touch ? "Tap to skip" : <><Keycap aria-hidden="true">Space</Keycap>Skip</>}
    </button>}
    {phase === "tutorial" && glyph && <div key={glyph.at} className={s.glyph} role="status" data-glyph={glyph.key} style={{ "--glyph-ms": `${GLYPH_MS}ms` } as CSSProperties}>
      {touch ? null : <Keycap>{glyph.key === "wheel" ? keys.wheel : keys.bag}</Keycap>}
      {glyph.key === "wheel" ? <Fish size={18} aria-hidden /> : <BookOpen size={18} aria-hidden />}
      <span>{glyph.key === "wheel" ? (touch ? "Your tools: pick the rod" : "Hold for your tools") : "What you've collected"}</span>
    </div>}
    {phase === "tutorial" && <button type="button" className={s.leave} onClick={() => { arrivalRun.signals.toured = true; }} data-testid="arrival-leave-tour">Skip the walk</button>}
  </div>;
}
