"use client";

/**
 * Speech bubbles (specs/v1-drop.md §3; lib/net/chat.ts): a chat line shows over its speaker for about 6 s, seen from
 * about 20 steps, and a "…" over someone writing one (FLAG.typing). One pooled DOM overlay of BUBBLES paper bubbles,
 * like the name tags (Nameplates.tsx): each is a label in the world's layout at speech priority, so it keeps its
 * place over the name tags (a speaker's own tag steps aside while their bubble carries the name), fades past its
 * range and behind buildings, and is moved only when it moved. Your own line bubbles over you too, and your mouth
 * moves with it (the others animate you from the line they get; nothing more goes on the wire).
 *
 * Every frame (after the remotes' driver) the pool hands its slots to whoever is speaking: a slot keeps its speaker
 * while they still speak, and a slot's content is written only when it changes.
 */
import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { CHARACTER_HEIGHT } from "../character/Character";
import { LABEL_PRIORITY, worldLabels, type LabelLayout, type LabelSpec } from "@/lib/game/labelLayout";
import { BUBBLE_RANGE, chatStore, type ChatStore } from "@/lib/net/chat";
import { localAvatar } from "@/lib/net/localAvatar";
import type { RemoteRig } from "./drive";
import { HIDDEN } from "./lod";
import { plateY } from "./Nameplates";
import { mouthSeconds } from "./talk";
import type { RigStore } from "./rigs";
import s from "./chat.module.css";

/** Bubbles at once (yours included). */
export const BUBBLES = 8;
/** Over the head: a line's tail just above it; the "…" above the name tag. */
const LINE_LIFT = -0.05, TYPING_LIFT = 0.6;
const SELF = "self";

type Speaker = RemoteRig | typeof SELF;
interface Slot {
  root: HTMLDivElement; bubble: HTMLDivElement; name: HTMLSpanElement; text: HTMLSpanElement; dots: HTMLSpanElement;
  who: Speaker | null;
  /** What it shows: `line:<start>` or `typing`, and its kind for the anchor's height. */
  key: string; typing: boolean;
  x: number; y: number; z: number; shown: boolean; alpha: number; measure: boolean;
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = className;
  parent?.appendChild(e);
  return e;
};
function makeSlot(): Slot {
  const root = el("div", s.bubbleAt), bubble = el("div", s.bubble, root);
  root.setAttribute("aria-hidden", "true");
  root.style.display = "none";
  const name = el("span", s.bubbleName, bubble), text = el("span", s.bubbleText, bubble), dots = el("span", s.dots, bubble);
  dots.innerHTML = "<i></i><i></i><i></i>";
  return { root, bubble, name, text, dots, who: null, key: "", typing: false, x: NaN, y: NaN, z: NaN, shown: false, alpha: 1, measure: true };
}

/** What a speaker shows now (speaking()'s answer, reused). */
const said: { line: { text: string; at: number } | null; typing: boolean } = { line: null, typing: false };
/** Who speaks now: their line, or the "…" while they write one; null when neither (allocates nothing). */
function speaking(who: Speaker, chat: ChatStore): typeof said | null {
  if (who === SELF) { const b = chat.selfBubble(); if (!b) return null; said.line = b; said.typing = false; return said; }
  if (who.lod.tier === HIDDEN || who.lod.dist > BUBBLE_RANGE + 2) return null;
  const p = who.entry.player, b = chat.bubble(who.sid, p.uid);
  if (b) { said.line = b; said.typing = false; return said; }
  if (!p.typing || chat.isMuted(p.uid)) return null;
  said.line = null; said.typing = true;
  return said;
}

export class BubblePool {
  readonly slots: Slot[] = [];
  private lastSelf = NaN;

  mount(container: HTMLElement, store: RigStore, you: RefObject<THREE.Vector3>, chat: ChatStore, labels: LabelLayout = worldLabels): () => void {
    for (let i = 0; i < BUBBLES; i++) this.slots.push(makeSlot());
    const offs = this.slots.map(slot => { container.appendChild(slot.root); return labels.add(this.label(slot, store, you)); });
    return () => { offs.forEach(off => off()); for (const slot of this.slots) slot.root.remove(); this.slots.length = 0; };
  }

  /** Hand the slots to whoever speaks (you first), keeping each speaker in their slot; write what changed. */
  update(store: RigStore, chat: ChatStore) {
    const slots = this.slots;
    if (!slots.length) return;
    for (const slot of slots) {
      const who = slot.who;
      if (who && (who === SELF || store.map.get(who.sid) === who) && speaking(who, chat)) continue;
      slot.who = null;
    }
    if (chat.selfBubble()) this.take(SELF);
    const list = store.list;
    for (let i = 0; i < list.length; i++) if (speaking(list[i], chat)) this.take(list[i]);
    for (const slot of slots) this.fill(slot, chat);
    // Your mouth moves with your own line.
    const mine = chat.selfBubble();
    if (mine && mine.at !== this.lastSelf) {
      this.lastSelf = mine.at;
      const m = localAvatar()?.motion.current;
      if (m) m.talk = mouthSeconds(mine.text);
    }
  }

  /** A slot for this speaker unless they have one (none free: they wait). */
  private take(who: Speaker) {
    let free: Slot | null = null;
    for (const slot of this.slots) {
      if (slot.who === who) return;
      if (!free && slot.who === null) free = slot;
    }
    if (free) free.who = who;
  }

  private fill(slot: Slot, chat: ChatStore) {
    const now = slot.who ? speaking(slot.who, chat) : null;
    const key = !now ? "" : now.line ? `line:${now.line.at}` : "typing";
    if (key === slot.key) return;
    slot.key = key;
    if (!now) return;
    slot.typing = now.typing;
    slot.measure = true;
    slot.bubble.toggleAttribute("data-typing", now.typing);
    slot.dots.hidden = !now.typing;
    slot.text.hidden = now.typing;
    const named = !now.typing && slot.who !== SELF;
    slot.name.hidden = !named;
    if (named) slot.name.textContent = (slot.who as RemoteRig).entry.player.name;
    if (now.line) slot.text.textContent = now.line.text;
    // Pop in, once per line.
    slot.bubble.removeAttribute("data-pop");
    void slot.bubble.offsetWidth;
    slot.bubble.setAttribute("data-pop", "");
  }

  private label(slot: Slot, store: RigStore, you: RefObject<THREE.Vector3>): LabelSpec {
    const size = { w: 0, h: 0 };
    return {
      priority: LABEL_PRIORITY.speech, size, range: BUBBLE_RANGE,
      anchor: out => {
        const who = slot.who;
        if (!who || !slot.key) return false;
        if (who === SELF) { const p = you.current; out.set(p.x, p.y + CHARACTER_HEIGHT + 0.22, p.z); return true; }
        if (store.map.get(who.sid) !== who || who.anchor.current?.visible !== true) return false;
        out.set(who.feet.current.x, plateY(who) + (slot.typing ? TYPING_LIFT : LINE_LIFT), who.feet.current.z);
        return true;
      },
      place: o => {
        if (o.shown !== slot.shown) { slot.shown = o.shown; slot.root.style.display = o.shown ? "" : "none"; }
        if (!o.shown) return;
        // Its box once its words are in. A line is told twice its height (it's drawn with its tail at the anchor, and the
        // speaker's tag steps aside for it), so the others keep clear of all of it; the "…" sits higher, clear of the
        // writer's own name tag, and is told its own height.
        if (slot.measure) { slot.measure = false; const b = slot.bubble.getBoundingClientRect(); size.w = b.width; size.h = slot.typing ? b.height : b.height * 2; }
        const y = o.y + o.dy;
        if (!(Math.abs(o.x - slot.x) <= 0.5 && Math.abs(y - slot.y) <= 0.5)) {
          slot.x = o.x; slot.y = y;
          slot.root.style.transform = `translate3d(${o.x}px,${y}px,0)`;
        }
        const a = o.dot ? 0 : Math.round(o.alpha * 50) / 50;
        if (a !== slot.alpha) { slot.alpha = a; slot.root.style.opacity = a < 1 ? String(a) : ""; }
        // Over the name tags (drei's scale: 40 near to 0 far), whatever their depth.
        if (slot.z !== 45) { slot.z = 45; slot.root.style.zIndex = "45"; }
      },
    };
  }
}

/** Mounts the pool beside the canvas and hands its slots out after the remotes' frame. */
export default function SpeechBubbles({ store, you }: { store: RigStore; you: RefObject<THREE.Vector3> }) {
  const gl = useThree(st => st.gl);
  const pool = useMemo(() => new BubblePool(), []);
  const chat = chatStore();
  useEffect(() => {
    const box = gl.domElement.parentElement;
    if (!box) return;
    return pool.mount(box, store, you, chat);
  }, [gl, pool, store, you, chat]);
  useFrame(() => pool.update(store, chat), -2);
  return null;
}
