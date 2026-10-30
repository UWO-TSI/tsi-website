/**
 * The court's keys and mouse while you play (specs/minigames/beach-volleyball.md §3). The court owns the mouse in a
 * match: its listeners sit on the window's capture phase and stop the events they use, so the island's mouse-look (the
 * orbit camera's right-click hold, which lets the pointer go), the held tool's click and the wheels never see them.
 * Keys go through the world's own key binding (bindGameKeys). The island's avatar stands back in a match (its keys
 * are frozen), so Space, Q and Ctrl reach the court rather than being taken first.
 *
 * Where the mouse's movement goes depends on your stance: the camera's look; while serving with the right button held,
 * the contact point on the ball (the curve); during your toss, the cursor in the timing ring (the serve's direction).
 */
import { bindGameKeys } from "@/lib/game/keyboardInput";
import type { Stance } from "./actions";

export interface CourtControls {
  keys: Record<string, boolean>;
  /** Edges since the frame last took them. */
  presses: { jump: boolean; dash: boolean; left: boolean; leftUp: boolean; right: boolean; e: boolean; ctrl: boolean };
  left: boolean; right: boolean;
  /** Mouse movement for the camera since the last frame (pixels, pointer locked). */
  look: { dx: number; dy: number };
  /** The cursor in the serve's timing ring and the contact point on the ball: −1..1, x right, y up, inside the unit circle. */
  ring: { x: number; y: number }; spin: { x: number; y: number };
}

export const newControls = (): CourtControls => ({
  keys: {}, presses: { jump: false, dash: false, left: false, leftUp: false, right: false, e: false, ctrl: false },
  left: false, right: false, look: { dx: 0, dy: 0 }, ring: { x: 0, y: 0 }, spin: { x: 0, y: 0 },
});

/** Pixels of mouse travel across the ring's or the ball's radius. */
export const CURSOR_PX = { ring: 140, spin: 110 } as const;

const nudge = (p: { x: number; y: number }, dx: number, dy: number, px: number) => {
  p.x += dx / px; p.y -= dy / px;
  const l = Math.hypot(p.x, p.y);
  if (l > 1) { p.x /= l; p.y /= l; }
};

type Doc = EventTarget & Pick<Document, "activeElement" | "hidden"> & { pointerLockElement: Element | null };
interface Bindings { forward: string; left: string; back: string; right: string; jump: string; dash: string; sprint: string }

export function bindCourtControls(c: CourtControls, o: {
  el: HTMLElement; bindings: Bindings; stance: () => Stance; win?: EventTarget; doc?: Doc;
}) {
  const win = o.win ?? window, doc = o.doc ?? (document as unknown as Doc), el = o.el, b = o.bindings, p = c.presses;
  const unbind = bindGameKeys({
    keys: c.keys, windowTarget: win, documentTarget: doc,
    accepted: [b.forward, b.left, b.back, b.right, b.jump, b.dash, b.sprint, "e", "control"],
    onPress: (e) => {
      const k = e.key.toLowerCase();
      if (k === b.jump || k === b.dash || k === "e" || k === "control" || e.ctrlKey) e.preventDefault();
      if (e.repeat) return;
      if (k === b.jump) p.jump = true;
      if (k === b.dash) p.dash = true;
      if (k === "e") p.e = true;
      if (k === "control") p.ctrl = true;
    },
    onReset: () => { c.left = c.right = false; },
  });
  /** The court's mouse event: pointer locked to the canvas, or a click on it. HUD buttons keep theirs. */
  const ours = (e: Event) => doc.pointerLockElement === el || e.target === el;
  const down = (event: Event) => {
    const e = event as MouseEvent;
    if (!ours(e)) return;
    e.stopPropagation();
    if (e.button === 0) { p.left = true; c.left = true; }
    if (e.button === 2) { p.right = true; c.right = true; }
    // The first click also takes the mouse (as the island's mouse-look does); it still counts.
    if (doc.pointerLockElement !== el) { try { Promise.resolve(el.requestPointerLock?.()).catch(() => {}); } catch { /* not offered here */ } }
  };
  const up = (event: Event) => {
    const e = event as MouseEvent;
    // A release always lets go (wherever it lands), and the orbit camera never sees the right button's.
    if (e.button === 0 && c.left) { c.left = false; p.leftUp = true; }
    if (e.button === 2) { c.right = false; e.stopPropagation(); }
  };
  const move = (event: Event) => {
    const e = event as MouseEvent;
    if (doc.pointerLockElement !== el) return;
    e.stopPropagation();
    const st = o.stance();
    if (st === "serve" && c.right) nudge(c.spin, e.movementX, e.movementY, CURSOR_PX.spin);
    else if (st === "toss") nudge(c.ring, e.movementX, e.movementY, CURSOR_PX.ring);
    else { c.look.dx += e.movementX; c.look.dy += e.movementY; }
  };
  const menu = (e: Event) => { if (ours(e)) { e.preventDefault(); e.stopPropagation(); } };
  const opts = { capture: true } as const;
  win.addEventListener("mousedown", down, opts);
  win.addEventListener("mouseup", up, opts);
  win.addEventListener("mousemove", move, opts);
  win.addEventListener("contextmenu", menu, opts);
  return () => {
    unbind();
    win.removeEventListener("mousedown", down, opts);
    win.removeEventListener("mouseup", up, opts);
    win.removeEventListener("mousemove", move, opts);
    win.removeEventListener("contextmenu", menu, opts);
  };
}

/** Take this frame's edges (and clear them). */
export function takePresses(c: CourtControls) {
  const p = { ...c.presses };
  for (const k of Object.keys(c.presses) as (keyof CourtControls["presses"])[]) c.presses[k] = false;
  return p;
}
