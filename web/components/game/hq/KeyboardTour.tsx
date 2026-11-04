"use client";

/**
 * Alice's keyboard tour (David's v2, v3 and v4 reviews): round 3's card with the kit's keyboard, made light (a light
 * Spotlight: a small white card, no scrim; only the key and a word or two, "less uncessary text"). A step at a time the key you need lights up and you press it, or hold it (a fill runs across the key), on your real
 * keyboard; there's no Next. Every key you touch sinks on the drawing too. Each step done brings its part of your
 * screen in, in its real place (`onShow`: the HUD's coins, the chat, the bag, the menu's entries, the minimap), which
 * springs in and rings (SlotPop): the HUD builds up a piece at a time. While it's up it takes every key, so nothing
 * opens behind it. While a key the tour knows is down, a peek at what it brings up pops beside the
 * card (TourPeek: the bag's slots filling, the emote wheel picking...; David's v5 and round 6 reviews; the tool wheel's,
 * round 6's drawing, above the card, round 8) and fades when you let go, after a beat for a quick press. The HUD and the
 * minimap have no peek card and aren't on screen before their key (round 9, David: "the hud doesnt exist, you press it
 * it shows off above the keyboard and it flies to where it usually sits"): the key's press brings the real ones in
 * (`onShow`), they pop up above the card, show off a beat and fly to their place (FlyHome), and the next key waits for
 * them to land. The last key is the phone's, which slides in bottom right with all its apps. The steps and words:
 * lib/game/arrival/hq/uiTour.ts. `onDone` after the last, or on Skip.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Keycap } from "@/components/gui";
import { FLY_HOME_MS, FlyHome, GhostButton, KeyBoard, KeywordLine, SlotPop, Spotlight, boardLabel, type PeekKind } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import TourPeek from "./TourPeek";
import { FLY_PIECES, HOLD_MS, UI_TOUR, tourInput, tourSteps, tourTick, type HudPiece, type TourKeys, type TourProgress } from "@/lib/game/arrival/hq/uiTour";

/** A finished step stays lit this long before the next key lights up (ms); the last one, before it closes. */
const NEXT_MS = 650, END_MS = 1100;
/** A peek stays at least this long (a quick press still shows it), then fades out over PEEK_FADE_MS. */
const PEEK_MIN_MS = 1100, PEEK_FADE_MS = 240;
const START: TourProgress = { step: 0, holdFrom: null };
/** Where each piece lands on screen (DefaultIslandWorld draws it there once shown). */
const PIECE_AT: Record<HudPiece, readonly string[]> = {
  hud: ["[data-hud-wallet]", "[data-hud-right]"], phone: ['[data-testid="phone"]'], chat: ['[data-testid="chat-dock"] button', '[data-testid="chat-dock"]'], bag: ['button[aria-label^="Open your bag"]'],
  collection: ['[data-testid="phone"] [aria-label^="Collection"]'], quests: ['[data-testid="phone"] [aria-label^="Quests"]'],
  map: ['[aria-label="Minimap"]'], mail: ['[data-testid="phone"] [aria-label^="Mail"]'],
};
/** What flies in from above the card: the bars top left, the quest line, the time and the wallet; the minimap. */
const FLY_TO: Partial<Record<HudPiece, readonly string[]>> = {
  hud: ['[data-testid="hud-bars"]', "[data-hud-quest]", "[data-minimap] > p", "[data-hud-wallet]"], map: ['[aria-label="Minimap"]'],
};
const FLY_TOTAL = FLY_HOME_MS.pop + FLY_HOME_MS.show + FLY_HOME_MS.fly;
const CARD = '[data-testid="ui-tour"]';
/** The steps with no peek card: their real piece comes in instead. */
const NO_PEEK = new Set(["hud", "map", "phone"]);
/** The peeks that sit above the card instead of on its right. */
const ABOVE = new Set<PeekKind>(["wheel"]);

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
  /** The peek showing (the step whose key went down), and whether it's fading out. */
  const [peek, setPeek] = useState<{ kind: PeekKind; out: boolean } | null>(null);
  const peekAt = useRef({ since: 0, timers: [] as number[] });
  /** The piece flying in from above the card (the HUD, the minimap), and when it lands; the ones already flown. */
  const [flying, setFlying] = useState<HudPiece | null>(null);
  const flown = useRef({ pieces: new Set<HudPiece>(), lands: 0 });
  const flyIn = useRef((piece: HudPiece) => {
    if (flown.current.pieces.has(piece)) return;
    flown.current.pieces.add(piece); flown.current.lands = performance.now() + FLY_TOTAL;
    showRef.current(piece); setFlying(piece); AudioManager.playSFX("blip4", { rate: 1.25, gain: 0.4 });
  });
  // A step done: lit a moment, its piece in, then the next key (or, after the last, the tour closes).
  const complete = useRef((from: number) => {
    setWon(from); setFill(0);
    AudioManager.playSFX("confirm", { rate: 1.15, gain: 0.45 });
    const piece = live.current.steps[from]?.piece;
    const flies = !!piece && FLY_PIECES.has(piece);
    if (piece && !flies) { showRef.current(piece); setPopped(piece); AudioManager.playSFX("blip4", { rate: 1.4, gain: 0.4 }); }
    if (flies) flyIn.current(piece);
    const last = from >= live.current.count - 1;
    // A piece in flight lands before the next key lights up.
    const wait = last ? END_MS : flies ? Math.max(NEXT_MS, flown.current.lands - performance.now() + 150) : NEXT_MS;
    window.setTimeout(() => { setWon(null); if (last) { setP(START); setPopped(null); setFlying(null); flown.current.pieces.clear(); doneRef.current(); } }, wait);
  });

  // Every key goes to the tour while it's up: the lit one moves it on, the rest only sink on the drawing.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), isDown = e.type === "keydown";
      if (isDown) { e.preventDefault(); e.stopImmediatePropagation(); }
      setDown(d => { const n = new Set(d); if (isDown) n.add(k); else n.delete(k); return n; });
      if (isDown && !e.repeat) AudioManager.playSFX("keyswitch", { gain: 0.5 });
      // The peek: in on the key's press, out once it's let go (after PEEK_MIN_MS in all).
      const known = live.current.steps.find(s => s.key === k);
      // The HUD and the minimap come in at their key's press (a hold's too), the lit one only.
      const lit = live.current.steps[live.current.p.step];
      if (isDown && !e.repeat && lit?.key === k && lit.piece && FLY_PIECES.has(lit.piece) && live.current.won === null) flyIn.current(lit.piece);
      if (known && !e.repeat && !NO_PEEK.has(known.id)) {
        const pk = peekAt.current;
        pk.timers.forEach(t => window.clearTimeout(t)); pk.timers = [];
        if (isDown) { pk.since = performance.now(); setPeek({ kind: known.id as PeekKind, out: false }); }
        else {
          const wait = Math.max(0, PEEK_MIN_MS - (performance.now() - pk.since));
          pk.timers.push(window.setTimeout(() => setPeek(v => v && { ...v, out: true }), wait), window.setTimeout(() => setPeek(null), wait + PEEK_FADE_MS));
        }
      }
      const { p: cur, won: w } = live.current;
      if (w !== null) return;
      const next = tourInput(cur, steps, { type: isDown ? "down" : "up", key: k, repeat: e.repeat, at: performance.now() });
      if (next === cur) return;
      setP(next);
      if (next.holdFrom === null) setFill(0);
      if (next.step > cur.step) complete.current(cur.step);
    };
    const blur = () => { setDown(new Set()); setPeek(null); };
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
  // The step's word carries its library icon (round 7: the bag, the map... the same drawing everywhere).
  const title = <KeywordLine line={step.title} />;
  const lead = won !== null ? <><Check size={16} aria-hidden /> {won >= steps.length - 1 ? UI_TOUR.done : title}</>
    : <>{step.hold ? UI_TOUR.hold : UI_TOUR.press} <Keycap>{boardLabel(step.key)}</Keycap> {title}</>;
  return <>
    <Spotlight light open={open} label={`${UI_TOUR.eyebrow}: ${step.title}`} lead={lead} steps={{ count: steps.length, at: shown }}
      testId="ui-tour" dataset={{ "data-step": step.id, "data-won": won !== null ? "" : undefined }}
      aside={peek && <TourPeek key={peek.kind} kind={peek.kind} out={peek.out} testId="ui-tour-peek" />} asideAt={peek && ABOVE.has(peek.kind) ? "top" : "right"}
      footer={<GhostButton onClick={() => { setP(START); setWon(null); setPopped(null); setFlying(null); flown.current.pieces.clear(); onDone(); }} data-testid="ui-tour-skip">{UI_TOUR.skip}</GhostButton>}>
      <KeyBoard lit={step.key} hold={step.hold} fill={fill} won={won !== null} done={steps.slice(0, p.step).map(s => s.key)} down={down} />
    </Spotlight>
    {open && popped && <SlotPop key={popped} to={PIECE_AT[popped]} />}
    {open && flying && <FlyHome key={flying} to={FLY_TO[flying] ?? PIECE_AT[flying]} from={CARD} />}
  </>;
}
