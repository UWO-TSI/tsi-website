import { describe, expect, it, vi } from "vitest";
import { bindGameKeys } from "./keyboardInput";

function harness() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null as Element | null });
  const keys: Record<string, boolean> = {};
  const onPress = vi.fn(), onReset = vi.fn();
  const dispose = bindGameKeys({ keys, accepted: ["w", "shift", "arrowleft", " "], onPress, onReset, windowTarget: win, documentTarget: doc });
  const key = (type: string, value: string, extra = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key: value, ...extra });
    win.dispatchEvent(event);
    return event;
  };
  return { win, doc, keys, onPress, onReset, dispose, key };
}

describe("world keyboard ownership", () => {
  it("tracks allowed keys case-insensitively and releases them even in controls", () => {
    const h = harness();
    h.key("keydown", "W"); h.key("keydown", "Shift"); h.key("keydown", "e");
    expect(h.keys).toEqual({ w: true, shift: true });
    h.doc.activeElement = { closest: () => ({}) } as unknown as Element;
    h.key("keyup", "W"); expect(h.keys.w).toBe(false);
    h.dispose();
  });
  it.each(["blur", "visibilitychange", "focusin"])("clears held movement and pending travel on %s", (event) => {
    const h = harness();
    h.key("keydown", "w"); h.key("keydown", "ArrowLeft");
    if (event === "visibilitychange") h.doc.hidden = true;
    if (event === "focusin") h.doc.activeElement = { closest: () => ({}) } as unknown as Element;
    (event === "blur" ? h.win : h.doc).dispatchEvent(new Event(event));
    expect(h.keys.w).toBe(false); expect(h.keys.arrowleft).toBe(false); expect(h.onReset).toHaveBeenCalledOnce();
    h.doc.hidden = false; h.doc.activeElement = null;
    expect(h.keys.w).toBe(false);
    h.dispose();
  });
  it.each(["metaKey", "ctrlKey", "altKey"])("leaves %s shortcuts to the browser", (modifier) => {
    const h = harness();
    h.key("keydown", "w"); h.key("keydown", "w", { [modifier]: true });
    expect(h.keys.w).toBe(false); expect(h.onPress).toHaveBeenCalledTimes(1);
    h.dispose();
  });
  it("does not consume control or already-handled key presses", () => {
    const h = harness();
    h.doc.activeElement = { closest: () => null, isContentEditable: true } as unknown as Element;
    h.key("keydown", " ");
    h.doc.activeElement = null;
    const event = Object.assign(new Event("keydown", { cancelable: true }), { key: "w" });
    event.preventDefault(); h.win.dispatchEvent(event);
    expect(h.onPress).not.toHaveBeenCalled(); expect(h.keys.w).not.toBe(true);
    h.dispose();
  });
  it("removes listeners and clears state on unmount", () => {
    const h = harness(); h.key("keydown", "w"); h.dispose();
    h.key("keydown", "w"); h.win.dispatchEvent(new Event("blur"));
    expect(h.keys.w).toBe(false); expect(h.onPress).toHaveBeenCalledOnce(); expect(h.onReset).toHaveBeenCalledOnce();
  });
});
