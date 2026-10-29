"use client";

/**
 * The emote wheel (specs/v1-drop.md §3), in the tool wheel's language (row 283, David's Animal Crossing UI kit: cream
 * circles for petals, the chosen one grows and turns butter yellow, its name in a teal pill, round keycaps).
 * Hold the emote key (G, rebindable in Settings): after a beat the ring opens round the screen's centre; a flick of the
 * mouse (its movement added up, under pointer lock or with a free cursor alike: lib/game/useWheelFlick) grows the petal
 * it points at, and letting go plays it. A quick tap plays the last emote again (with nothing to repeat it opens the ring for a click). The centre
 * flips the ring between the eight emotes and the eight dances (click it, or turn the mouse wheel, while the ring is
 * up). Esc closes it. On a phone, the emote button opens it and a tap chooses. The world keeps going: the wheel never
 * slows it (other people are there).
 * Input is the pure state machine in lib/game/emoteWheel.ts; what a pick does is lib/game/emotePlay.ts.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Armchair, Bot, CircleHelp, Droplets, Footprints, Hand, HandHeart, Laugh, Moon, Music, PartyPopper, PersonStanding, RotateCw, Smile, Sparkle, Waves, Zap, type LucideIcon } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";
import { slotPosition } from "@/lib/game/toolWheel";
import { useWheelFlick } from "@/lib/game/useWheelFlick";
import { keyName } from "@/lib/game/movement/keys";
import {
  TAP_MS, closeWheel, createWheel, flipRing, openForClick, pickAt, playChoice, pressWheel, releaseWheel, ringOf,
  type Ring, type WheelAct, type WheelEntry, type WheelState,
} from "@/lib/game/emoteWheel";
import styles from "./EmoteWheel.module.css";

/** Our icons for each petal (row 281: no emoji as UI). */
const ICON: Record<string, LucideIcon> = {
  wave: Hand, cheer: PartyPopper, clap: HandHeart, laugh: Laugh, sit: Armchair, sleep: Moon, bow: PersonStanding, shrug: CircleHelp,
  bounce: Music, spin: RotateCw, shuffle: Footprints, sway: Waves, wiggle: Sparkle, flail: Zap, robot: Bot, sprinkler: Droplets,
};
/** The petals' ring and the flick's reach (px: short, so a new direction takes over quickly); within DEAD of the centre is the centre. */
const RING = 112, REACH = 80, DEAD = 30;

const sfx = (name: Parameters<typeof AudioManager.playSFX>[0], rate: number, gain: number) => AudioManager.playSFX(name, { rate, gain });

/** The flower itself, open on a ring: the overlay below, and /lab/gui's showroom. */
export function EmoteWheelView({ ring, choice, last, onChoose, onPick, onFlip, standalone }: {
  ring: Ring; choice: number | null; last: WheelEntry | null;
  /** Shown on its own (the showroom), not inside the overlay that fades it in. */
  standalone?: boolean;
  onChoose?: (i: number | null) => void; onPick?: (i: number) => void; onFlip?: () => void;
}) {
  const entries = ringOf({ ring }), n = entries.length;
  const chosen = choice !== null ? entries[choice] : null;
  const [lx, ly] = choice !== null ? slotPosition(choice, n, RING) : [0, RING + 28];
  const label = chosen ? chosen.name : ring === "emotes" ? "Dances" : "Emotes";
  const FlipIcon = ring === "emotes" ? Music : Smile;
  return <div className={styles.flower} data-ring={ring} data-shown={standalone || undefined} key={ring} style={{ "--n": n } as CSSProperties}>
    {entries.map((e, i) => {
      const [x, y] = slotPosition(i, n, RING), Icon = ICON[e.id] ?? Smile;
      return <button key={e.id} role="menuitem" className={styles.petal} data-chosen={choice === i || undefined} data-last={last?.id === e.id || undefined}
        style={{ "--x": `${x}px`, "--y": `${y}px`, "--i": i } as CSSProperties} aria-label={e.name}
        onMouseEnter={() => onChoose?.(i)} onClick={ev => { ev.stopPropagation(); onPick?.(i); }}>
        <Icon size={30} strokeWidth={2.3} aria-hidden className={styles.icon} />
      </button>;
    })}
    <button role="menuitem" className={styles.centre} data-chosen={choice === null || undefined} aria-label={ring === "emotes" ? "Show the dances" : "Show the emotes"}
      onMouseEnter={() => onChoose?.(null)} onClick={ev => { ev.stopPropagation(); onFlip?.(); }}>
      <FlipIcon size={22} strokeWidth={2.4} aria-hidden />
    </button>
    <p className={styles.name} aria-live="polite" data-above={ly < -1 || undefined} data-centre={choice === null || undefined} style={{ "--lx": `${lx}px`, "--ly": `${ly}px` } as CSSProperties}>
      <b>{label}</b>{!chosen && <small>{ring === "emotes" ? "Emotes" : "Dances"} · click the middle to flip</small>}
    </p>
  </div>;
}

export default function EmoteWheel({ emoteKey, enabled, touch, onPlay }: {
  emoteKey: string; enabled: boolean; touch: boolean; onPlay: (entry: WheelEntry) => void;
}) {
  const [view, setView] = useState<WheelState>(createWheel);
  const [shown, setShown] = useState(false);
  const live = useRef({ s: createWheel(), timer: 0, enabled, onPlay });
  useEffect(() => { live.current.enabled = enabled; live.current.onPlay = onPlay; }, [enabled, onPlay]);

  /** Every change goes through here: the live copy for the handlers, React's for the view, and the act if any. */
  const commit = useCallback((next: WheelState, act?: WheelAct) => {
    const l = live.current, was = l.s;
    l.s = next;
    setView(next);
    if (next.choice !== was.choice && next.choice !== null && next.open) sfx("click", 1.55, 0.22);
    if (!next.open) { window.clearTimeout(l.timer); setShown(false); }
    if (act?.kind === "play") { sfx("confirm", 1.2, 0.4); l.onPlay(act.entry); }
  }, []);
  const show = useCallback(() => { setShown(true); sfx("blip3", 0.9, 0.42); }, []);

  // The emote key: down opens (after a beat), up plays the choice, or the last emote on a tap.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), l = live.current;
      if (l.s.open && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); commit(closeWheel(l.s)); return; }
      if (k !== emoteKey || e.metaKey || e.ctrlKey || e.altKey || !l.enabled) return;
      // Typing, or a sheet open: the key is theirs.
      if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']") || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      if (e.repeat) return;
      const next = pressWheel(l.s, performance.now());
      commit(next);
      if (next.open === "hold") { window.clearTimeout(l.timer); l.timer = window.setTimeout(show, TAP_MS); }
    };
    const up = (e: KeyboardEvent) => {
      const l = live.current;
      if (e.key.toLowerCase() !== emoteKey || l.s.open !== "hold") return;
      e.preventDefault();
      const r = releaseWheel(l.s, performance.now());
      commit(r.state, r.act);
      if (r.state.open === "click") show();
    };
    const blur = () => { if (live.current.s.open) commit(closeWheel(live.current.s)); };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); window.removeEventListener("blur", blur); };
  }, [emoteKey, commit, show]);
  // Closed when the world takes the player away (a sheet, a cutscene).
  useEffect(() => { if (!enabled && live.current.s.open) commit(closeWheel(live.current.s)); }, [enabled, commit]);

  // While it's up: the flick picks (held open by the key; open for a click, only under pointer lock, where the cursor
  // can't reach the petals), the wheel or a click on the middle flips the ring, a click on a petal plays it.
  const open = view.open;
  const resetFlick = useWheelFlick(!!open, open === "hold", () => ringOf(live.current.s).length,
    i => { if (i !== live.current.s.choice) commit(pickAt(live.current.s, i)); }, REACH, DEAD);
  useEffect(() => {
    if (!open) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); resetFlick(); commit(flipRing(live.current.s)); sfx("click", 1.1, 0.3); };
    // Under pointer lock the cursor never reaches the petals: a click acts on what the flick points at.
    const click = (e: MouseEvent) => {
      if (!document.pointerLockElement || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const l = live.current;
      if (l.s.choice === null) { resetFlick(); commit(flipRing(l.s)); sfx("click", 1.1, 0.3); return; }
      const r = playChoice(l.s);
      commit(r.state, r.act);
    };
    // The world's own click (the held tool's use) never sees a click meant for the wheel.
    const swallow = (e: PointerEvent) => { if (document.pointerLockElement && e.button === 0) e.stopPropagation(); };
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("mousedown", click, true);
    window.addEventListener("pointerdown", swallow, true);
    return () => {
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("mousedown", click, true); window.removeEventListener("pointerdown", swallow, true);
    };
  }, [open, commit, resetFlick]);
  useEffect(() => () => window.clearTimeout(live.current.timer), []);

  // The cursor's hover picks only when the ring is open for a click (held open by the key, the flick picks).
  const choose = useCallback((i: number | null) => { if (live.current.s.open === "click" && !document.pointerLockElement) commit(pickAt(live.current.s, i)); }, [commit]);
  const pick = useCallback((i: number) => { const r = playChoice(pickAt(live.current.s, i)); commit(r.state, r.act); }, [commit]);
  const flip = useCallback(() => { resetFlick(); commit(flipRing(live.current.s)); sfx("click", 1.1, 0.3); }, [commit, resetFlick]);
  const visible = open && (shown || open === "click");

  return <>
    {touch && !open && enabled && <button className={styles.touchButton} onClick={() => { commit(openForClick(live.current.s)); show(); }} aria-label="Open the emote wheel">
      <Smile size={24} strokeWidth={2.3} aria-hidden />
    </button>}
    {open && <div className={styles.wheel} data-shown={visible || undefined} role="menu" aria-label="Emote wheel"
      onClick={open === "click" ? () => commit(closeWheel(live.current.s)) : undefined}>
      <EmoteWheelView ring={view.ring} choice={view.choice} last={view.last} onChoose={choose} onPick={pick} onFlip={flip} />
      {open === "hold" && <p className={styles.hint}><span><kbd>{keyName(emoteKey)}</kbd>Let go to play</span><span><kbd>Scroll</kbd>Dances</span><span><kbd>Esc</kbd>Cancel</span></p>}
    </div>}
  </>;
}
