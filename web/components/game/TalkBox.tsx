"use client";

/**
 * The dialogue box when you talk to a resident (specs/polish/reachability.md deliverable 1, row 123): the GUI sheet's
 * Dialogue (the recruit kit's NPCDialogue, as the HQ lead's greeting) at the foot of the screen with their name tag,
 * each line typed out in their own voice (dialogue blips pitched per resident) and the amber chevron bobbing once a
 * line is down. E, Enter, Space or a click finishes a line, then moves on; after the last they wave goodbye. Escape
 * leaves from anywhere. It opens through the one dialog system: focus comes in, the world's keys hold still.
 *
 * It steps the conversation (lib/game/residentTalk.ts) once a frame and writes the letters straight to the DOM; React
 * renders only when the line or its state changes. The resident's clip, mouth and face follow the same conversation
 * in the residents' frame (NPC.tsx). Only this viewer's: nothing here is sent anywhere.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { Dialogue } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { POST_TITLES, type ResidentPost } from "@/lib/content/residents";
import { blipAt, emptyTalkView, endTalk, leaveTalk, pressTalk, stepTalk, subscribeTalk, talkChanged, talkStore, talkView, voiceBlip } from "@/lib/game/residentTalk";
import styles from "./TalkBox.module.css";

/** Blips no closer than this (s): a voice, not a buzz. */
const BLIP_GAP = 0.055;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** E, Enter, Space or a click: finish the line, or the next one, or goodbye. */
function press() {
  const t = talkStore.active;
  if (!t) return;
  const r = pressTalk(t, performance.now() / 1000);
  if (!r) return;
  talkChanged();
  if (r === "next") AudioManager.playSFX("click", { rate: 1.35, gain: 0.22 });
}
/** Escape, or the dialog closing for any reason: goodbye now. */
function leave() {
  const t = talkStore.active;
  if (!t) return;
  leaveTalk(t, performance.now() / 1000);
  talkChanged();
}

/**
 * One frame of the talk: step it, write the letters that are showing (the rest stay in place, unseen, so the box never
 * reflows as a line grows), and say them. `seen` remembers the line and letters last drawn.
 */
function frame(seen: { line: number; typed: number; blip: number }, shown: HTMLSpanElement | null, rest: HTMLSpanElement | null, reduced: boolean) {
  const t = talkStore.active;
  if (!t) return;
  const now = performance.now() / 1000;
  // Reduced motion: each line whole, at once.
  if (reduced && t.phase === "speaking" && t.typed < t.lines[t.index].text.length) { t.typed = t.lines[t.index].text.length; talkChanged(); }
  const step = stepTalk(t, now);
  if (step === "ended") { endTalk(); return; }
  if (step === "turned" || step === "typed") talkChanged();
  if (t.phase !== "speaking" && t.phase !== "closing") return;
  const text = t.lines[t.index].text;
  if (t.index !== seen.line) { seen.line = t.index; seen.typed = -1; }
  if (t.typed === seen.typed) return;
  for (let i = Math.max(0, seen.typed); i < t.typed; i++) {
    if (!blipAt(text, i) || now - seen.blip < BLIP_GAP) continue;
    const v = voiceBlip(t.seed, text, i);
    AudioManager.playSFX(v.sfx, { rate: v.rate, gain: 0.3 });
    seen.blip = now;
  }
  seen.typed = t.typed;
  if (shown) shown.textContent = text.slice(0, t.typed);
  if (rest) rest.textContent = text.slice(t.typed);
}

export default function TalkBox() {
  const view = useSyncExternalStore(subscribeTalk, talkView, emptyTalkView);
  const open = view.activeId !== null;
  const panel = useWorldDialog<HTMLDivElement>(open, leave, [], true);
  const shown = useRef<HTMLSpanElement>(null), rest = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const seen = { line: -1, typed: -1, blip: 0 }, reduced = reducedMotion();
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); frame(seen, shown.current, rest.current, reduced); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);
  // The keys that move it on; Escape is the dialog system's (it leaves). A held key doesn't race through the lines.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== "e" && k !== "enter" && k !== " ") return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);
  const onBox = useCallback((e: MouseEvent) => { if (!(e.target as Element).closest("button")) press(); }, []);

  if (!open) return null;
  const line = talkStore.active?.lines[view.index]?.text ?? "";
  const title = view.post && view.post !== "villager" ? POST_TITLES[view.post as ResidentPost] : null;
  const last = view.index + 1 >= view.count;
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label={`Talking with ${view.name}`} data-gui-dialog className={styles.talk} data-phase={view.phase}
    data-ready={view.complete || undefined} data-testid="talk-box" onClick={onBox}>
    <Dialogue speaker={title ? `${view.name} · ${title}` : view.name} onContinue={press} continueLabel={last && view.complete ? "Bye" : "Next"}>
      <p className={styles.line} aria-hidden="true"><span ref={shown} /><span ref={rest} className={styles.rest} /></p>
      <p className={styles.sr} aria-live="polite">{view.phase === "speaking" ? line : ""}</p>
    </Dialogue>
  </div>;
}
