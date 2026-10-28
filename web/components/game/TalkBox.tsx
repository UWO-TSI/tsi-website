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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Dialogue } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { POST_TITLES, type ResidentPost } from "@/lib/content/residents";
import { Gift } from "lucide-react";
import { HeartMeter, ItemCard, RoundButton, StatusLine } from "@/components/gui/flat";
import { giveGift, talkedTo, useFriendLevel, type FriendMove } from "@/lib/game/friendship";
import { loadBag, useBag } from "@/lib/game/bagStore";
import { itemInfo } from "@/lib/collections/bag";
import { iconUrl } from "@/lib/icons/keys";
import { ApiError } from "@/lib/apiClient";
import { parseTalkLine } from "@/lib/content/talk";
import { FRIEND_MAX, friendNote, tasteLine } from "@/lib/npc/friendship";
import { toast } from "./ToastHub";
import { blipAt, emptyTalkView, endTalk, leaveTalk, pressTalk, sayMore, stepTalk, subscribeTalk, talkChanged, talkStore, talkView, voiceBlip } from "@/lib/game/residentTalk";
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

/** A move that reached a whole heart says so (its letter, its coins). */
const noteMove = (f: FriendMove | null) => { const n = f && friendNote(f, f.name); if (n) toast(n); };
/** They answer in the talk going on ("[face] words"). */
const answer = (raw: string) => sayMore([parseTalkLine(raw)], performance.now() / 1000);

/**
 * Give them something from your bag (d-friends): your bag's items as small white cards; one, and they answer in the
 * talk (their taste) while the hearts move. One gift a day each: a second gets their "tomorrow, maybe?".
 */
function GiftPicker({ slug, onDone }: { slug: string; onDone: () => void }) {
  const bag = useBag();
  useEffect(() => { void loadBag(); }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = (bag.view?.items ?? []).filter(i => i.count > 0 && !i.locked);
  const give = async (key: string) => {
    setBusy(true); setError(null);
    try {
      const f = await giveGift(slug, key);
      AudioManager.playSFX(f.taste === "hate" ? "click" : "confirm");
      answer(tasteLine(f.taste ?? "meh"));
      noteMove(f);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "gift_done") { answer("[happy] You already gave me something today. Tomorrow, maybe?"); onDone(); return; }
      setError(e instanceof ApiError ? e.message : "Couldn't reach the island. Try again.");
      setBusy(false);
    }
  };
  return <div className={styles.gifts} role="group" aria-label="Give a gift" data-testid="gift-picker" onClick={e => e.stopPropagation()}>
    {bag.view && !items.length ? <StatusLine>Nothing in your bag to give yet.</StatusLine>
      : <div className={styles.giftRow}>{items.map(i => <ItemCard key={i.item_key} size="sm" arrow={false} picture={iconUrl(i.item_key)} px={34}
        name={itemInfo(i.item_key)?.name ?? i.item_key} pill={i.count > 1 ? `×${i.count}` : null} disabled={busy} onClick={() => void give(i.item_key)} />)}</div>}
    {error && <StatusLine error>{error}</StatusLine>}
  </div>;
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
  const [giving, setGiving] = useState(false);
  useEffect(() => {
    if (!open || giving) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== "e" && k !== "enter" && k !== " ") return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, giving]);
  // The day's first talk with them adds half a heart, as the talk opens (the hearts fill while you chat).
  const slug = view.slug, talkId = view.activeId;
  useEffect(() => { if (talkId && slug) void talkedTo(slug).then(noteMove); }, [talkId, slug]);
  if (!open && giving) setGiving(false);
  const onBox = useCallback((e: MouseEvent) => { if (!(e.target as Element).closest("button")) press(); }, []);
  // Focus comes into the box once it shows (it's hidden while they turn to you, when the dialog system first tries).
  const phase = view.phase;
  useEffect(() => {
    const el = panel.current;
    if (phase === "speaking" && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [phase, panel]);

  const friend = useFriendLevel(view.slug);
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
    {slug && <div className={styles.friend} onClick={e => e.stopPropagation()}>
      <span className={styles.hearts}><HeartMeter halves={friend} max={FRIEND_MAX} size={17} label={`Friendship with ${view.name}: ${friend / 2} of ${FRIEND_MAX} hearts`} /></span>
      <RoundButton label={giving ? "Put the gift away" : `Give ${view.name} a gift`} className={styles.give} aria-pressed={giving} onClick={() => setGiving(g => !g)} data-testid="give-gift">
        <Gift size={17} strokeWidth={2.2} aria-hidden="true" />
      </RoundButton>
    </div>}
    {giving && slug && <GiftPicker slug={slug} onDone={() => setGiving(false)} />}
  </div>;
}
