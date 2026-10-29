"use client";

/**
 * Alice's keyboard tour (David's v2 and v3 reviews): the kit's small bare keyboard over the room, no panel (KeyPrompt).
 * A step at a time the key you need lights up and you press it, or hold it (a fill runs across the key), on your real
 * keyboard; there's no Next. Every key you touch sinks on the drawing too. Each step done brings its part of your
 * screen in, in its real place (`onShow`: the HUD's coins, the chat, the bag, the menu's entries, the minimap), which
 * springs in and rings (SlotPop): the HUD builds up a piece at a time. While it's up it takes every key, so nothing
 * opens behind it. The steps and words: lib/game/arrival/hq/uiTour.ts. `onDone` after the last, or on Skip.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Keycap } from "@/components/gui";
import { GhostButton, KeyBoard, KeyPrompt, SlotPop, boardLabel } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import { HOLD_MS, UI_TOUR, tourInput, tourSteps, tourTick, type HudPiece, type TourKeys, type TourProgress } from "@/lib/game/arrival/hq/uiTour";

/** A finished step stays lit this long before the next key lights up (ms); the last one, before it closes. */
const NEXT_MS = 650, END_MS = 1100;
const START: TourProgress = { step: 0, holdFrom: null };
/** Where each piece lands on screen (DefaultIslandWorld draws it there once shown). */
const PIECE_AT: Record<HudPiece, readonly string[]> = {
  hud: ['[data-hud-slot="coins"]', "[data-hud-right]"], chat: ['[data-testid="chat-dock"] button', '[data-testid="chat-dock"]'], bag: ['button[aria-label^="Open your bag"]'],
  collection: ['[data-testid="menu-dock"] [aria-label^="Collection"]'], quests: ['[data-testid="menu-dock"] [aria-label^="Quests"]'],
  map: ['[aria-label="Minimap"]', '[data-testid="menu-dock"] [aria-label^="Map"]'], mail: ['[data-testid="menu-dock"] [aria-label^="Mail"]'],
};

export default function KeyboardTour({ open, keys, onShow, onDone }: {
  open: boolean; keys: TourKeys;
  /** A step done brings its part of the screen in (shown until the tour closes). */
  onShow: (piece: HudPiece) => void;
  onDone: () => void;
}) {
  const steps = useMemo(() => tourSteps(keys), [keys]);
  const [p, setP] = useState<TourProgress>(START);
  /** The step just finished, lit up a moment before the next; the keys down now; a hold's fill (0 to 1). */
  const [won, setWon] = useState<number | null>(null);
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const [fill, setFill] = useState(0);
  const live = useRef({ p, won, count: steps.length, steps });
  useEffect(() => { live.current = { p, won, count: steps.length, steps }; }, [p, won, steps]);
  const doneRef = useRef(onDone), showRef = useRef(onShow);
  useEffect(() => { doneRef.current = onDone; showRef.current = onShow; }, [onDone, onShow]);
  /** The piece just brought in (it springs into its place). */
  const [popped, setPopped] = useState<HudPiece | null>(null);
  // A step done: lit a moment, its piece in, then the next key (or, after the last, the tour closes).
  const complete = useRef((from: number) => {
    setWon(from); setFill(0);
    AudioManager.playSFX("confirm", { rate: 1.15, gain: 0.45 });
    const piece = live.current.steps[from]?.piece;
    if (piece) { showRef.current(piece); setPopped(piece); AudioManager.playSFX("blip4", { rate: 1.4, gain: 0.4 }); }
    const last = from >= live.current.count - 1;
    window.setTimeout(() => { setWon(null); if (last) { setP(START); setPopped(null); doneRef.current(); } }, last ? END_MS : NEXT_MS);
  });

  // Every key goes to the tour while it's up: the lit one moves it on, the rest only sink on the drawing.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), isDown = e.type === "keydown";
      if (isDown) { e.preventDefault(); e.stopImmediatePropagation(); }
      setDown(d => { const n = new Set(d); if (isDown) n.add(k); else n.delete(k); return n; });
      if (isDown && !e.repeat) AudioManager.playSFX("keyswitch", { gain: 0.5 });
      const { p: cur, won: w } = live.current;
      if (w !== null) return;
      const next = tourInput(cur, steps, { type: isDown ? "down" : "up", key: k, repeat: e.repeat, at: performance.now() });
      if (next === cur) return;
      setP(next);
      if (next.holdFrom === null) setFill(0);
      if (next.step > cur.step) complete.current(cur.step);
    };
    const blur = () => setDown(new Set());
    window.addEventListener("keydown", on, true);
    window.addEventListener("keyup", on, true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", on, true); window.removeEventListener("keyup", on, true); window.removeEventListener("blur", blur); };
  }, [open, steps]);

  // A hold: its fill runs across the key, and it moves on once it's held long enough.
  useEffect(() => {
    if (!open || p.holdFrom === null) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now(), cur = live.current.p;
      setFill(Math.min(1, (now - (cur.holdFrom ?? now)) / HOLD_MS));
      const next = tourTick(cur, now);
      if (next !== cur) { setP(next); complete.current(cur.step); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, p.holdFrom]);

  const shown = won ?? Math.min(p.step, steps.length - 1), step = steps[shown];
  const cue = won !== null ? <><Check size={16} aria-hidden /> {won >= steps.length - 1 ? UI_TOUR.done : step.title}</>
    : <>{step.hold ? UI_TOUR.hold : UI_TOUR.press} <Keycap>{boardLabel(step.key)}</Keycap> {step.title}</>;
  return <>
    <KeyPrompt open={open} label={`${UI_TOUR.eyebrow}: ${step.title}`} cue={cue} note={step.text} steps={{ count: steps.length, at: shown }}
      testId="ui-tour" dataset={{ "data-step": step.id, "data-won": won !== null ? "" : undefined }}
      footer={<GhostButton onClick={() => { setP(START); setWon(null); setPopped(null); onDone(); }} data-testid="ui-tour-skip">{UI_TOUR.skip}</GhostButton>}>
      <KeyBoard lit={step.key} hold={step.hold} fill={fill} won={won !== null} done={steps.slice(0, p.step).map(s => s.key)} down={down} />
    </KeyPrompt>
    {open && popped && <SlotPop key={popped} to={PIECE_AT[popped]} />}
  </>;
}
