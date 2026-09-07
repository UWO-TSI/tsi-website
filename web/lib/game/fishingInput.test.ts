import { describe, expect, it, vi } from "vitest";
import { bindFishingInput } from "./fishingInput";

function harness() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null as Element | null });
  const hold = vi.fn(), cancel = vi.fn(), pause = vi.fn(), focus = vi.fn();
  const dispose = bindFishingInput({ onHold: hold, onCancel: cancel, onPause: pause, onPointerFocus: focus, windowTarget: win, documentTarget: doc });
  const key = (type: string, key: string, extra = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key, ...extra });
    win.dispatchEvent(event); return event;
  };
  const pointer = (type: string, pointerId = 1, button = 0, target?: Element) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId, button });
    if (target) Object.defineProperty(event, "target", { value: target });
    win.dispatchEvent(event); return event;
  };
  return { win, doc, hold, cancel, pause, focus, dispose, key, pointer };
}

describe("fishing input ownership", () => {
  it("keeps holding until every key and pointer is released", () => {
    const h = harness();
    h.key("keydown", "E"); h.key("keydown", " "); h.pointer("pointerdown");
    h.key("keyup", "e"); h.key("keyup", " ");
    expect(h.hold).toHaveBeenLastCalledWith(true);
    h.pointer("pointerup", 2); expect(h.hold).toHaveBeenLastCalledWith(true);
    h.pointer("pointercancel"); expect(h.hold).toHaveBeenLastCalledWith(false);
    h.dispose();
  });

  it.each(["blur", "visibilitychange", "focusin"])("releases and pauses on %s without reviving stale input", (event) => {
    const h = harness(); h.key("keydown", "e"); h.pointer("pointerdown");
    if (event === "visibilitychange") h.doc.hidden = true;
    if (event === "focusin") h.doc.activeElement = { closest: () => ({}) } as unknown as Element;
    (event === "blur" ? h.win : h.doc).dispatchEvent(new Event(event));
    expect(h.hold).toHaveBeenLastCalledWith(false); expect(h.pause).toHaveBeenLastCalledWith(true);
    h.key("keydown", "e"); expect(h.hold).toHaveBeenLastCalledWith(false);
    h.doc.hidden = false; h.doc.activeElement = null;
    (event === "blur" ? h.win : h.doc).dispatchEvent(new Event(event === "blur" ? "focus" : event));
    expect(h.pause).toHaveBeenLastCalledWith(false); expect(h.hold).toHaveBeenLastCalledWith(false);
    h.dispose();
  });

  it.each(["metaKey", "ctrlKey", "altKey"])("preserves %s shortcuts", (modifier) => {
    const h = harness(); h.key("keydown", "e");
    const event = h.key("keydown", "e", { [modifier]: true });
    expect(event.defaultPrevented).toBe(false); expect(h.hold).toHaveBeenLastCalledWith(false);
    h.dispose();
  });

  it("leaves other buttons and secondary clicks alone, and focuses on a reel press", () => {
    const h = harness();
    const button = { closest: () => ({}) } as unknown as Element;
    expect(h.pointer("pointerdown", 1, 0, button).defaultPrevented).toBe(false);
    expect(h.pointer("pointerdown", 1, 2).defaultPrevented).toBe(false);
    expect(h.focus).not.toHaveBeenCalled();
    expect(h.pointer("pointerdown").defaultPrevented).toBe(true);
    expect(h.focus).toHaveBeenCalledOnce(); expect(h.hold).toHaveBeenLastCalledWith(true);
    h.dispose();
  });

  it("concedes on Escape and removes input listeners on cleanup", () => {
    const h = harness(); h.key("keydown", "e");
    expect(h.key("keydown", "Escape").defaultPrevented).toBe(true);
    expect(h.cancel).toHaveBeenCalledOnce(); expect(h.hold).toHaveBeenLastCalledWith(false);
    h.dispose(); h.key("keydown", "e"); h.pointer("pointerdown"); h.key("keydown", "Escape");
    expect(h.hold).toHaveBeenLastCalledWith(false); expect(h.cancel).toHaveBeenCalledOnce();
  });
});
