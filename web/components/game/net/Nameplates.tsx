"use client";

/**
 * The other players' name tags (specs/v1-drop.md §3, lib/game/nameTags.ts; specs/multiplayer.md §5.5): one pooled DOM
 * overlay of 12 tags, not a drei `<Html>` each (every one of those is its own React root with its own projection each
 * frame). The re-tier hands the tags out (lod.ts: every drawn player within 8 u, the nearest 12; a real player's name
 * always shows there, so people read as people); after each frame is drawn, the camera final, the world's label layout
 * (lib/game/labelLayout.ts; world audit item 2) projects each tag through the curved world's bend, stacks one that
 * would cover a nearer tag above it (or shrinks it to a dot when the stack runs too tall), fades it behind a building,
 * and the tag is moved only when it moved more than half a pixel.
 *
 * The tags are plain elements beside drei's labels in the canvas's own box, stacked by distance on drei's scale, so a
 * nearer tag covers a farther one whichever kind they are. Small clean text with a soft shadow, no plate
 * (nameTags.module.css): the Tethos-blue dot for a TSI member (row 223), a small heart for a friend (v1), a small phone
 * for someone resting on a phone (row 299), dimmed while they're away (dropped, inside the reconnection grace). World
 * names only (row 222).
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { CHARACTER_HEIGHT } from "../character/Character";
import { LABEL_PRIORITY, worldLabels, type LabelLayout, type LabelSpec } from "@/lib/game/labelLayout";
import type { RemotePlayer } from "@/lib/net/types";
import { chatStore } from "@/lib/net/chat";
import { friendsStore } from "@/lib/net/friends";
import type { RemoteRig } from "./drive";
import { LOD } from "./lod";
import styles from "./net.module.css";
import tags from "../nameTags.module.css";

/** Over the head as yours is (PlayerAvatar: the character's height and 0.28; the leaf's open height clears an open leaf). */
export function plateY(r: RemoteRig): number {
  return (r.seated ? r.groundY : r.feet.current.y + Math.min(1, r.motion.leaf ?? 0) * 0.45) + CHARACTER_HEIGHT + 0.28;
}

/**
 * Who each slot shows after a re-tier, in place: a slot keeps its player while they still have a plate (and are still
 * in view), freed slots go to those who have none, nearest first as `rigs` comes.
 */
export function assignPlates(slots: (RemoteRig | null)[], rigs: readonly RemoteRig[], here: (r: RemoteRig) => boolean): void {
  for (let i = 0; i < slots.length; i++) { const r = slots[i]; if (r && (!r.lod.plate || !here(r))) slots[i] = null; }
  for (let k = 0; k < rigs.length; k++) {
    const r = rigs[k];
    if (!r.lod.plate || !here(r) || slots.includes(r)) continue;
    const free = slots.indexOf(null);
    if (free < 0) return;
    slots[free] = r;
  }
}

/** The plates' stacking, drei's for your nameplate (zIndexRange [40, 0]): linear in distance from near to far. */
export function plateZ(distance: number, near: number, far: number): number {
  const a = -40 / (far - near);
  return Math.round(a * distance - a * far);
}

/** A small heart by a friend's name (v1 friends), drawn, not an emoji. */
const HEART = '<svg viewBox="0 0 12 11" width="10" height="9" aria-hidden="true"><path d="M6 10.2 1.4 5.7A2.9 2.9 0 0 1 6 2.1a2.9 2.9 0 0 1 4.6 3.6Z"/></svg>';
/** A small phone, drawn in the paper kit's ink (not an emoji). */
const PHONE = '<svg viewBox="0 0 10 15" width="10" height="15"><rect x="0.9" y="0.9" width="8.2" height="13.2" rx="2.3"/><path d="M3.7 3h2.6"/><circle cx="5" cy="11.5" r="0.95"/></svg>';

interface Slot {
  root: HTMLDivElement; tag: HTMLDivElement; name: HTMLSpanElement; phone: HTMLSpanElement;
  /** Shown as your friend (the heart by the name). */
  friend: boolean;
  /** What it shows now, and what of theirs it was filled from. */
  player: RemotePlayer | null;
  x: number; y: number; z: number; shown: boolean; alpha: number;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = className;
  parent?.appendChild(e);
  return e;
};
function makeSlot(): Slot {
  const root = el("div", styles.plateAt), tag = el("div", `${tags.tag} ${styles.plate}`, root);
  root.setAttribute("aria-hidden", "true");
  root.style.display = "none";
  el("span", tags.dot, tag);
  el("span", tags.friend, tag).innerHTML = HEART;
  const name = el("span", tags.name, tag), phone = el("span", styles.phone, tag);
  phone.innerHTML = PHONE;
  return { root, tag, name, phone, friend: false, player: null, x: NaN, y: NaN, z: NaN, shown: false, alpha: 1 };
}
const flag = (e: HTMLElement, name: string, on: boolean) => { if (e.hasAttribute(name) !== on) e.toggleAttribute(name, on); };

/** Write a player's name into a tag (on assignment and when their card or slow state changes, never per frame). */
function fill(s: Slot, p: RemotePlayer) {
  s.player = p;
  s.name.textContent = p.name;
  s.phone.hidden = !p.mobile;
  flag(s.tag, "data-member", p.member);
  flag(s.tag, "data-away", p.away);
}

/** The island camera's clip range (DefaultIslandWorld), for the stacking scale. */
const CAMERA_NEAR = 0.1, CAMERA_FAR = 120;

const TIER_TAG = ["Full", "Reduced", "Hidden"] as const;

/** The pool: made once, filled on assignment, moved after each frame. */
export class PlatePool {
  readonly shows: (RemoteRig | null)[] = Array.from({ length: LOD.plates }, () => null);
  private slots: Slot[] = [];
  /** Development (`?lod=1`): each plate names its player's render tier. */
  private debug = false;

  /** Into the canvas's own box (where drei puts its labels), each plate a label in the layout; returns the removal. */
  mount(container: HTMLElement, here: (r: RemoteRig) => boolean, debug = false, labels: LabelLayout = worldLabels): () => void {
    this.debug = debug;
    this.slots = this.shows.map(() => makeSlot());
    const offs = this.slots.map((s, i) => { container.appendChild(s.root); return labels.add(this.label(s, i, here)); });
    return () => { offs.forEach(off => off()); for (const s of this.slots) s.root.remove(); this.slots = []; };
  }

  /** After a re-tier: who gets a plate (lod.plate), each kept in the slot it had. */
  assign(rigs: readonly RemoteRig[], here: (r: RemoteRig) => boolean) {
    assignPlates(this.shows, rigs, here);
  }

  /** Slot i as a label: anchored over its player's head, placed where the layout says. */
  private label(s: Slot, i: number, here: (r: RemoteRig) => boolean): LabelSpec {
    const size = { w: 0, h: 0 };
    let measure = true;
    return {
      priority: LABEL_PRIORITY.player, size,
      anchor: out => {
        const r = this.shows[i];
        if (!r || !here(r) || r.anchor.current?.visible !== true) return false;
        // While their speech bubble shows, it carries the name (SpeechBubbles.tsx).
        if (chatStore().bubble(r.sid, r.entry.player.uid)) return false;
        // A friend's name wears a small heart (a Set lookup a frame; the DOM only when it changes).
        const friend = friendsStore().isFriend(r.entry.player.uid);
        if (friend !== s.friend) { s.friend = friend; flag(s.tag, "data-friend", friend); measure = true; }
        if (s.player !== r.entry.player) { fill(s, r.entry.player); measure = true; }
        if (this.debug && s.tag.dataset.tier !== TIER_TAG[r.lod.tier]) { s.tag.dataset.tier = TIER_TAG[r.lod.tier]; measure = true; }
        out.set(r.feet.current.x, plateY(r), r.feet.current.z);
        return true;
      },
      place: o => {
        if (o.shown !== s.shown) { s.shown = o.shown; s.root.style.display = o.shown ? "" : "none"; }
        if (!o.shown) return;
        // Its box, once its card is in (a dot's would be too small): read only when the card changed.
        if (measure && !o.dot) { measure = false; const b = s.tag.getBoundingClientRect(); size.w = b.width; size.h = b.height; }
        flag(s.tag, "data-dot", o.dot);
        const y = o.y + o.dy;
        if (!(Math.abs(o.x - s.x) <= 0.5 && Math.abs(y - s.y) <= 0.5)) {
          s.x = o.x; s.y = y;
          s.root.style.transform = `translate3d(${o.x}px,${y}px,0)`;
        }
        const a = Math.round(o.alpha * 50) / 50;
        if (a !== s.alpha) { s.alpha = a; s.root.style.opacity = a < 1 ? String(a) : ""; }
        const z = plateZ(o.depth, CAMERA_NEAR, CAMERA_FAR);
        if (z !== s.z) { s.z = z; s.root.style.zIndex = String(z); }
      },
    };
  }
}

/** Mounts the pool beside the canvas; the world's label layout (LabelLayer) places it after every frame. */
export default function Nameplates({ pool, here }: { pool: PlatePool; here: (r: RemoteRig) => boolean }) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const box = gl.domElement.parentElement;
    if (!box) return;
    return pool.mount(box, here, process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("lod"));
  }, [gl, pool, here]);
  return null;
}
