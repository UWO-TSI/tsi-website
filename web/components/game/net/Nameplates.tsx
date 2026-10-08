"use client";

/**
 * The other players' nameplates (specs/multiplayer.md §5.5): one pooled DOM overlay of 12 paper tags, not a drei
 * `<Html>` each (every one of those is its own React root with its own projection each frame). The re-tier hands the
 * plates out (lod.ts: every drawn player within 22 u, the nearest 12; a real player's plate always shows there, so
 * people read as people, not residents); after each frame is drawn, the camera final, the world's label layout
 * (lib/game/labelLayout.ts; world audit item 2) projects each plate through the curved world's bend, stacks one that
 * would cover a nearer plate above it (or shrinks it to a dot when the stack runs too tall), fades it behind a building,
 * and the plate is moved only when it moved more than half a pixel.
 *
 * The plates are plain elements beside drei's labels in the canvas's own box, stacked by distance on the same scale as
 * your nameplate's, so a nearer plate covers a farther one whichever kind they are. Their look is your plate's
 * (PlayerAvatar): the paper tag, the Tethos-blue dot for a TSI member (row 223), the level tab, the class icon and
 * mastery title with the mastery frame when they show their class, a small phone for someone resting on a phone
 * (row 299), and dimmed while they're away (dropped, inside the reconnection grace). World names only (row 222).
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { CHARACTER_HEIGHT } from "../character/Character";
import { LABEL_PRIORITY, worldLabels, type LabelLayout, type LabelSpec } from "@/lib/game/labelLayout";
import { classKit } from "@/lib/combat/classes";
import { masteryTitle } from "@/lib/combat/mastery";
import type { RemotePlayer } from "@/lib/net/types";
import type { RemoteRig } from "./drive";
import { LOD } from "./lod";
import styles from "./net.module.css";

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

/** A small phone, drawn in the paper kit's ink (not an emoji). */
const PHONE = '<svg viewBox="0 0 10 15" width="10" height="15"><rect x="0.9" y="0.9" width="8.2" height="13.2" rx="2.3"/><path d="M3.7 3h2.6"/><circle cx="5" cy="11.5" r="0.95"/></svg>';

interface Slot {
  root: HTMLDivElement; plate: HTMLDivElement; name: HTMLSpanElement; level: HTMLSpanElement; phone: HTMLSpanElement;
  cls: HTMLDivElement; icon: HTMLImageElement; title: HTMLSpanElement;
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
  const root = el("div", styles.plateAt), plate = el("div", styles.plate, root), row = el("div", styles.plateName, plate);
  root.setAttribute("aria-hidden", "true");
  root.style.display = "none";
  el("span", styles.dot, row);
  const name = el("span", styles.name, row), phone = el("span", styles.phone, row), level = el("span", styles.level, row);
  phone.innerHTML = PHONE;
  const cls = el("div", styles.plateClass, plate), icon = el("img", styles.classIcon, cls), title = el("span", "", cls);
  icon.alt = ""; icon.width = 22; icon.height = 22;
  return { root, plate, name, level, phone, cls, icon, title, player: null, x: NaN, y: NaN, z: NaN, shown: false, alpha: 1 };
}
const flag = (e: HTMLElement, name: string, on: boolean) => { if (e.hasAttribute(name) !== on) e.toggleAttribute(name, on); };

/** Write a player's card into a plate (on assignment and when their card or slow state changes, never per frame). */
function fill(s: Slot, p: RemotePlayer) {
  s.player = p;
  s.name.textContent = p.name;
  s.level.textContent = p.level > 0 ? `Lv ${p.level}` : "";
  s.level.hidden = !(p.level > 0);
  s.phone.hidden = !p.mobile;
  flag(s.plate, "data-member", p.member);
  flag(s.plate, "data-away", p.away);
  const kit = p.showClass ? classKit(p.kit) : null;
  s.cls.hidden = !kit;
  if (kit) {
    if (s.icon.getAttribute("src") !== kit.look.icon) s.icon.src = kit.look.icon;
    s.icon.style.boxShadow = `0 0 0 1.5px ${kit.look.ramp[1]}`;
    s.title.textContent = masteryTitle(kit.name, p.mastery);
  }
  const frame = p.showClass ? p.frame : null;
  if (frame) s.plate.dataset.frame = frame; else delete s.plate.dataset.frame;
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
        if (s.player !== r.entry.player) { fill(s, r.entry.player); measure = true; }
        if (this.debug && s.plate.dataset.tier !== TIER_TAG[r.lod.tier]) { s.plate.dataset.tier = TIER_TAG[r.lod.tier]; measure = true; }
        out.set(r.feet.current.x, plateY(r), r.feet.current.z);
        return true;
      },
      place: o => {
        if (o.shown !== s.shown) { s.shown = o.shown; s.root.style.display = o.shown ? "" : "none"; }
        if (!o.shown) return;
        // Its box, once its card is in (a dot's would be too small): read only when the card changed.
        if (measure && !o.dot) { measure = false; const b = s.plate.getBoundingClientRect(); size.w = b.width; size.h = b.height; }
        flag(s.plate, "data-dot", o.dot);
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
