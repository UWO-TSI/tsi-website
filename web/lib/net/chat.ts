/**
 * World chat on the client (specs/v1-drop.md §3, specs/multiplayer.md §6): what the chat bar, the fading lines, the
 * log, the speech bubbles and the talking animation read. One store per page (`chatStore()`); the net store feeds it
 * every `line` the room sends (yours included: your copy is the acceptance) and every `sys {kind: "refused"}`, while a
 * restart notice stays the net store's own (lib/net/netStore.ts). Nothing here touches the wire or React: the room
 * store sends, components subscribe (useSyncExternalStore) and the frame loop reads bubbles directly.
 *
 * - The log keeps the session's last CHAT_LOG_MAX entries: lines, and a refusal's kind notice, never mixed up.
 * - The bottom left shows the last RECENT_LINES lines said within RECENT_MS, fading.
 * - A line bubbles over its speaker for BUBBLE_MS (the latest replaces the last), for the player who said it: a bubble
 *   names the uid as well as the sid, so a sid handed to someone new isn't theirs.
 * - Mute is this session only: a muted player's lines and bubbles stop and what they said is hidden, back on unmute.
 *   A block (POST /api/world/blocks; the server stops lines both ways) takes what was already said out of the log.
 * - The typing flag (`s {typing}`) goes up with the first letter, down when the bar empties, on a send, on a close or
 *   after TYPING_IDLE_MS without a keystroke; each method returns the value to send, or null for no change.
 * - A refused line comes back to the bar if it was sent within RESTORE_MS (`takeRestore`), so a filtered word can be
 *   fixed rather than retyped.
 */
import { CHAT, type ChatLine, type ChatRefusal } from "./protocol";

export const CHAT_LOG_MAX = 50;
export const RECENT_LINES = 5;
export const RECENT_MS = 12_000;
/** A speech bubble's life (about 6 s, specs/v1-drop.md §3), and how near it shows (about 20 steps). */
export const BUBBLE_MS = 6000;
export const BUBBLE_RANGE = 20;
export const TYPING_IDLE_MS = 5000;
export const RESTORE_MS = 4000;
export const CHAT_MAX = CHAT.maxLength;

export type ChatEntry =
  | { kind: "line"; id: string; sid: number; uid: string; name: string; area: number; text: string; at: number; mine: boolean }
  | { kind: "notice"; id: string; reason: ChatRefusal; text: string; at: number };
export interface Bubble { text: string; uid: string; at: number }

/** The client's own words for a refusal the server sent without text (it always sends some; this is the floor). */
export const REFUSAL_TEXT: Readonly<Record<ChatRefusal, string>> = {
  muted: "You can't chat right now.",
  fast: "Slow down a little.",
  slow: `New accounts can send ${CHAT.slowModePerMinute} lines a minute on their first day.`,
  repeat: "You just said that.",
  long: `Keep it under ${CHAT.maxLength} characters.`,
  empty: "Write something first.",
  filtered: "Please keep chat friendly.",
  url: "Links unlock after your first week.",
};

export class ChatStore {
  private log: ChatEntry[] = [];
  private snapshot: readonly ChatEntry[] = [];
  private listeners = new Set<() => void>();
  private muted = new Set<string>();
  private bubbles = new Map<number, Bubble>();
  private self: string | null = null;
  private pending: { text: string; at: number } | null = null;
  private restore: string | null = null;
  private lastKey = -Infinity;
  private notices = 0;
  /** The typing flag as last sent. */
  typing = false;

  constructor(private readonly now: () => number = Date.now) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  entries = () => this.snapshot;
  private shows = (e: ChatEntry) => e.kind !== "line" || !this.muted.has(e.uid);
  private changed() {
    this.snapshot = this.log.filter(this.shows);
    for (const l of this.listeners) l();
  }

  /** Your uid (the roster's entry for your session): your lines are `mine` and bubble over you. */
  setSelf(uid: string | null) { this.self = uid; }
  get selfUid() { return this.self; }

  /** A `line` from the room. False when it was dropped (a muted player's). */
  receive(l: ChatLine): boolean {
    if (this.muted.has(l.uid)) return false;
    const at = this.now(), mine = l.uid === this.self;
    if (mine) this.pending = null;
    this.push({ kind: "line", id: l.id, sid: l.sid, uid: l.uid, name: l.name, area: l.area, text: l.text, at, mine });
    this.bubbles.set(l.sid, { text: l.text, uid: l.uid, at });
    return true;
  }

  /** `sys {kind: "refused"}`: your last line wasn't sent. */
  refused(reason: ChatRefusal, text: string) {
    const at = this.now();
    if (this.pending && at - this.pending.at <= RESTORE_MS) this.restore = this.pending.text;
    this.pending = null;
    this.push({ kind: "notice", id: `notice-${++this.notices}`, reason, text: text || REFUSAL_TEXT[reason], at });
  }

  /** The words of a refused line, once (to put back in the bar), or null. */
  takeRestore(): string | null {
    const r = this.restore;
    this.restore = null;
    return r;
  }

  private push(e: ChatEntry) {
    this.log.push(e);
    if (this.log.length > CHAT_LOG_MAX) this.log.splice(0, this.log.length - CHAT_LOG_MAX);
    this.changed();
  }

  /** The bottom left's lines: the last RECENT_LINES said within RECENT_MS. */
  recent(): ChatEntry[] { return recentOf(this.snapshot, this.now()); }

  /** Their lines stop and what they said is hidden (back on unmute); their bubble goes. */
  mute(uid: string) {
    if (uid === this.self || this.muted.has(uid)) return;
    this.muted.add(uid);
    for (const [sid, b] of this.bubbles) if (b.uid === uid) this.bubbles.delete(sid);
    this.changed();
  }
  unmute(uid: string) {
    if (this.muted.delete(uid)) this.changed();
  }
  isMuted = (uid: string) => this.muted.has(uid);
  /** You blocked them (the server stops lines from now on): what they already said goes too. */
  blocked(uid: string) { this.forget(uid); }
  private forget(uid: string) {
    this.log = this.log.filter(e => e.kind !== "line" || e.uid !== uid);
    for (const [sid, b] of this.bubbles) if (b.uid === uid) this.bubbles.delete(sid);
    this.changed();
  }

  /** The bubble over player `sid` (who must be `uid`) now, with its age in ms and when it began, or null. Allocates nothing. */
  bubble(sid: number, uid: string): BubbleNow | null {
    const b = this.bubbles.get(sid);
    if (!b || b.uid !== uid || this.muted.has(uid)) return null;
    const age = this.now() - b.at;
    if (age >= BUBBLE_MS) return null;
    out.text = b.text; out.age = age; out.at = b.at;
    return out;
  }
  /** Your own bubble now, or null. */
  selfBubble(): BubbleNow | null {
    if (!this.self) return null;
    for (const [sid, b] of this.bubbles) if (b.uid === this.self) return this.bubble(sid, this.self);
    return null;
  }

  // ── The typing flag ──────────────────────────────────────────────
  private flag(on: boolean): boolean | null {
    if (on === this.typing) return null;
    this.typing = on;
    return on;
  }
  /** The bar's text changed. */
  draft(text: string): boolean | null {
    this.lastKey = this.now();
    return this.flag(text.length > 0);
  }
  /** Call now and then while the bar is open: a quiet spell lowers the flag. */
  idle(): boolean | null {
    return this.typing && this.now() - this.lastKey >= TYPING_IDLE_MS ? this.flag(false) : null;
  }
  /** The bar closed. */
  close(): boolean | null { return this.flag(false); }
  /** A line went up: the flag drops with it (the server sees the line), and it's kept a moment in case it's refused. */
  sent(text: string) {
    this.pending = { text, at: this.now() };
    this.restore = null;
    this.typing = false;
  }

  /** Tests and a page leave: forget everything. */
  reset() {
    this.log = []; this.bubbles.clear(); this.muted.clear(); this.pending = null; this.restore = null; this.typing = false;
    this.changed();
  }
}
/** The last RECENT_LINES of `entries` (oldest first, as the log keeps them) said within RECENT_MS of `now`. */
export function recentOf(entries: readonly ChatEntry[], now: number): ChatEntry[] {
  const out: ChatEntry[] = [];
  for (let i = entries.length - 1; i >= 0 && out.length < RECENT_LINES; i--) {
    if (now - entries[i].at >= RECENT_MS) break;
    out.push(entries[i]);
  }
  return out.reverse();
}
/** A bubble now: its words, how long it has shown (ms) and when it began (the store's clock). */
export interface BubbleNow { text: string; age: number; at: number }
/** bubble()'s answer, reused. */
const out: BubbleNow = { text: "", age: 0, at: 0 };

/** The page's one chat store (kept on globalThis, as the net store is, through Strict Mode and Fast Refresh). */
export function chatStore(): ChatStore {
  const g = globalThis as unknown as { __tsiChat?: ChatStore };
  return (g.__tsiChat ??= new ChatStore());
}

// ── The talking animation ─────────────────────────────────────────

/** A seeded 0..1 for beat `k` of speaker `seed`. */
function jitter(seed: number, k: number): number {
  let h = (seed * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Seconds a hop takes, and how high it goes (world units). */
const HOP_S = 0.32, HOP_H = 0.12;
const GESTURES = [0.25, 2.6, 5.0], HOPS = [1.35, 3.9];

/**
 * The speaker's body while their bubble shows, between `t0` and `t1` seconds into it: `gesture` when a small talking
 * gesture starts in that span (an upper-body Chat), `hop` the lift of a little hop (0 when none). Gestures come soon
 * after the line and every couple of seconds; one or two hops, the second on half the speakers. Seeded per speaker,
 * so two people talking don't move in step. The mouth is Character's (motion.talk).
 */
export function talkBeat(t0: number, t1: number, seed: number, into: TalkBeat = beat): TalkBeat {
  const end = BUBBLE_MS / 1000;
  let gesture = false, hop = 0;
  for (let k = 0; k < GESTURES.length; k++) {
    const at = GESTURES[k] + (k ? (jitter(seed, k) - 0.5) * 0.6 : 0);
    if (at > t0 && at <= t1 && at < end) gesture = true;
  }
  for (let k = 0; k < HOPS.length; k++) {
    if (k === 1 && jitter(seed, 9) < 0.5) continue;
    const at = HOPS[k] + (jitter(seed, k + 5) - 0.5) * 0.8, u = (t1 - at) / HOP_S;
    if (u > 0 && u < 1 && t1 < end) hop = Math.sin(u * Math.PI) * HOP_H;
  }
  into.gesture = gesture; into.hop = hop;
  return into;
}
export interface TalkBeat { gesture: boolean; hop: number }
/** talkBeat's answer, reused (the frame loop asks for every speaker every frame). */
const beat: TalkBeat = { gesture: false, hop: 0 };
