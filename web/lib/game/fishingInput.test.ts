import { describe, expect, it, vi } from "vitest";
import { bindFishingCastLifecycle, bindFishingInput } from "./fishingInput";

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

describe("cast lifecycle", () => {
  function casting() {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false });
    let phase = "idle";
    const start = vi.fn(() => { phase = "charging"; });
    const release = vi.fn();
    const cancel = vi.fn(() => { phase = "idle"; });
    const dispose = bindFishingCastLifecycle({ getPhase: () => phase, onStart: start, onRelease: release, onCancel: cancel, windowTarget: win, documentTarget: doc });
    const send = (type: string, props = {}) => {
      const event = Object.assign(new Event(type, { cancelable: true }), props);
      win.dispatchEvent(event); return event;
    };
    return { win, doc, start, release, cancel, dispose, send, setPhase: (next: string) => { phase = next; } };
  }

  it("retains a same-turn quick release and ignores competing starts", () => {
    const h = casting();
    h.send("tsi:fish-start", { detail: { x: 1, z: 2 } });
    h.send("keyup", { key: "E" });
    h.send("tsi:fish-start", { detail: { x: 50, z: 50 } });
    expect(h.release).toHaveBeenCalledOnce(); expect(h.start).toHaveBeenCalledExactlyOnceWith({ x: 1, z: 2 });
    h.dispose();
  });

  it("rejects invalid coordinates and unrelated releases", () => {
    const h = casting();
    for (const detail of [undefined, { x: 1 }, { x: NaN, z: 2 }, { x: 1, z: Infinity }]) h.send("tsi:fish-start", { detail });
    expect(h.start).not.toHaveBeenCalled();
    h.setPhase("charging"); h.send("keyup", { key: "w" }); h.send("pointerup", { button: 2 });
    expect(h.release).not.toHaveBeenCalled();
    h.send("pointerup", { button: 0 }); expect(h.release).toHaveBeenCalledOnce();
    h.setPhase("waiting"); h.send("keyup", { key: "e" }); expect(h.release).toHaveBeenCalledOnce();
    h.dispose();
  });

  it.each(["charging", "casting", "waiting", "bite", "caught", "missed"])("owns Escape during %s", (phase) => {
    const h = casting(); h.setPhase(phase);
    expect(h.send("keydown", { key: "Escape" }).defaultPrevented).toBe(true);
    expect(h.cancel).toHaveBeenCalledOnce(); h.dispose();
  });

  it("yields idle, reel and reveal Escape to their respective owners", () => {
    const h = casting();
    for (const phase of ["idle", "reeling", "revealing"]) {
      h.setPhase(phase); expect(h.send("keydown", { key: "Escape" }).defaultPrevented).toBe(false);
    }
    expect(h.cancel).not.toHaveBeenCalled(); h.dispose();
  });

  it("interrupts pending casts, preserves completed catches, and cleans up", () => {
    const h = casting();
    for (const type of ["blur", "pointercancel", "visibilitychange"]) {
      h.setPhase("waiting");
      if (type === "visibilitychange") { h.doc.hidden = true; h.doc.dispatchEvent(new Event(type)); }
      else h.send(type);
    }
    expect(h.cancel).toHaveBeenCalledTimes(3);
    h.setPhase("revealing"); h.send("blur"); expect(h.cancel).toHaveBeenCalledTimes(3);
    h.dispose(); h.setPhase("charging"); h.send("keyup", { key: "e" }); h.send("blur");
    expect(h.release).not.toHaveBeenCalled(); expect(h.cancel).toHaveBeenCalledTimes(3);
  });
});

describe("hook-to-reel input handoff", () => {
  it.each(["key", "pointer"])("immediately inherits a held %s and releases it normally", (kind) => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null });
    const input = { keys: new Set(kind === "key" ? ["e"] : []), pointers: new Set(kind === "pointer" ? [7] : []) };
    const hold = vi.fn();
    const dispose = bindFishingInput({ initialInput: input, onHold: hold, onCancel: vi.fn(), onPause: vi.fn(), windowTarget: win, documentTarget: doc });
    expect(hold).toHaveBeenLastCalledWith(true);
    win.dispatchEvent(Object.assign(new Event(kind === "key" ? "keyup" : "pointerup"), { key: "e", pointerId: 7 }));
    expect(hold).toHaveBeenLastCalledWith(false);
    dispose();
  });

  it("observes a release before the reel mounts and leaves the source lease intact during cleanup", () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null });
    const input = { keys: new Set(["e"]), pointers: new Set<number>() };
    const releaseCast = bindFishingCastLifecycle({ getPhase: () => "reeling", heldInput: input, onStart: vi.fn(), onRelease: vi.fn(), onCancel: vi.fn(), windowTarget: win, documentTarget: doc });
    const hold = vi.fn();
    const mount = () => bindFishingInput({ initialInput: input, onHold: hold, onCancel: vi.fn(), onPause: vi.fn(), windowTarget: win, documentTarget: doc });
    const first = mount(); expect(hold).toHaveBeenLastCalledWith(true);
    first(); expect(input.keys.has("e")).toBe(true);
    win.dispatchEvent(Object.assign(new Event("keyup"), { key: "E" }));
    expect(input.keys.size).toBe(0);
    const second = mount(); expect(hold).toHaveBeenLastCalledWith(false);
    second(); releaseCast();
  });
});
