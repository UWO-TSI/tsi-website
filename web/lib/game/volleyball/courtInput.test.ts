import { describe, expect, it } from "vitest";
import { bindCourtControls, newControls, takePresses } from "./courtInput";
import type { Stance } from "./actions";

const BINDINGS = { forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift" };

function harness(stance: Stance = "ground", locked = true) {
  const win = new EventTarget();
  const el = Object.assign(new EventTarget(), { requestPointerLock: () => { doc.pointerLockElement = el as unknown as Element; } }) as unknown as HTMLElement;
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null as Element | null, pointerLockElement: (locked ? el : null) as Element | null });
  const c = newControls();
  let st = stance;
  const dispose = bindCourtControls(c, { el, bindings: BINDINGS, stance: () => st, win, doc });
  const key = (type: string, value: string, extra = {}) => { const e = Object.assign(new Event(type, { cancelable: true }), { key: value, ...extra }); win.dispatchEvent(e); return e; };
  /** A mouse event on the window, its target the canvas unless said otherwise (as a click on it would be). */
  const mouse = (type: string, extra: Record<string, unknown> = {}) => {
    const e = new Event(type, { cancelable: true });
    for (const [k, v] of Object.entries({ button: 0, movementX: 0, movementY: 0, target: el, ...extra })) Object.defineProperty(e, k, { value: v });
    win.dispatchEvent(e);
    return e;
  };
  return { c, el, doc, key, mouse, dispose, setStance: (s: Stance) => { st = s; } };
}

describe("the court's controls (real key and mouse events)", () => {
  it("Space, Q, E and Ctrl are presses; WASD and Shift are held", () => {
    const h = harness();
    for (const k of [" ", "q", "e", "Control", "w", "Shift"]) h.key("keydown", k);
    expect(takePresses(h.c)).toMatchObject({ jump: true, dash: true, e: true, ctrl: true });
    expect(h.c.keys).toMatchObject({ w: true, shift: true });
    expect(takePresses(h.c)).toMatchObject({ jump: false, dash: false, e: false, ctrl: false });
    h.dispose();
  });
  it("a held key's repeat is not a second press", () => {
    const h = harness();
    h.key("keydown", "e"); takePresses(h.c);
    h.key("keydown", "e", { repeat: true });
    expect(takePresses(h.c).e).toBe(false);
  });
  it("Space and Ctrl keep the page's default (no scroll, no shortcut)", () => {
    const h = harness();
    expect(h.key("keydown", " ").defaultPrevented).toBe(true);
    expect(h.key("keydown", "Control", { ctrlKey: true }).defaultPrevented).toBe(true);
  });
  it("left and right buttons press and hold, and the island never sees them under the lock", () => {
    const h = harness();
    const down = h.mouse("mousedown", { button: 2 });
    expect(down.cancelBubble).toBe(true);
    expect(h.c.right).toBe(true);
    h.mouse("mousedown", { button: 0 });
    expect(takePresses(h.c)).toMatchObject({ left: true, right: true });
    const up = h.mouse("mouseup", { button: 2 });
    expect(up.cancelBubble).toBe(true);
    h.mouse("mouseup", { button: 0 });
    expect(h.c.left || h.c.right).toBe(false);
    expect(takePresses(h.c).leftUp).toBe(true);
  });
  it("the first click takes the pointer lock and still counts", () => {
    const h = harness("ground", false);
    h.mouse("mousedown", { button: 0 });
    expect(h.doc.pointerLockElement).toBe(h.el);
    expect(takePresses(h.c).left).toBe(true);
  });
  it("a click on the HUD (not the canvas, no lock) is left alone", () => {
    const h = harness("ground", false);
    const e = h.mouse("mousedown", { button: 0, target: new EventTarget() });
    expect(e.cancelBubble).toBe(false);
    expect(takePresses(h.c).left).toBe(false);
  });
  it("mouse movement turns the camera, curves the serve with the right button held, and aims the toss's ring", () => {
    const h = harness("ground");
    h.mouse("mousemove", { movementX: 10, movementY: -4 });
    expect(h.c.look).toEqual({ dx: 10, dy: -4 });
    h.setStance("serve");
    h.mouse("mousedown", { button: 2 });
    h.mouse("mousemove", { movementX: 60, movementY: -30 });
    expect(h.c.spin.x).toBeGreaterThan(0.4);
    expect(h.c.spin.y).toBeGreaterThan(0.2);
    expect(h.c.look.dx).toBe(10);
    h.setStance("toss");
    h.mouse("mousemove", { movementX: -500, movementY: 0 });
    expect(h.c.ring.x).toBeCloseTo(-1);
    expect(Math.hypot(h.c.ring.x, h.c.ring.y)).toBeLessThanOrEqual(1 + 1e-9);
  });
  it("unbinding (the match ends) drops held buttons and keys", () => {
    const h = harness();
    h.key("keydown", "w"); h.mouse("mousedown", { button: 0 });
    h.dispose();
    expect(h.c.keys.w).toBe(false);
    expect(h.c.left).toBe(false);
  });
});
