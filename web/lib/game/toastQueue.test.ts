import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastQueue, type GameToast } from "./toastQueue";

describe("world notification queue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the newest three notifications and cancels the dropped timer", () => {
    let entries: readonly GameToast[] = [];
    const queue = createToastQueue((next) => { entries = next; });
    for (const text of ["one", "two", "three", "four"]) queue.push({ text });
    expect(entries.map((item) => item.text)).toEqual(["two", "three", "four"]);
    expect(vi.getTimerCount()).toBe(3);
    vi.advanceTimersByTime(2600); expect(entries).toEqual([]); expect(vi.getTimerCount()).toBe(0);
  });

  it("lets each notification expire without removing a newer one", () => {
    let entries: readonly GameToast[] = [];
    const queue = createToastQueue((next) => { entries = next; });
    queue.push({ text: "first" });
    vi.advanceTimersByTime(1000); queue.push({ text: "second" });
    vi.advanceTimersByTime(1600); expect(entries.map((item) => item.text)).toEqual(["second"]);
    vi.advanceTimersByTime(1000); expect(entries).toEqual([]);
  });

  it("ignores malformed event data instead of rendering invalid React children", () => {
    const publish = vi.fn(); const queue = createToastQueue(publish);
    for (const detail of [undefined, null, 5, "text", {}, { text: [] }, { text: "  " }]) queue.push(detail);
    expect(publish).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("trims text, ignores malformed icons and preserves text markup as a string", () => {
    const publish = vi.fn(); const queue = createToastQueue(publish);
    queue.push({ text: "  <b>A note</b>  ", icon: {} });
    expect(publish).toHaveBeenLastCalledWith([expect.objectContaining({ text: "<b>A note</b>", icon: undefined })]);
  });

  it("bounds long notifications without splitting emoji and gives them longer to read", () => {
    let entries: readonly GameToast[] = [];
    const queue = createToastQueue((next) => { entries = next; });
    queue.push({ text: "🌸".repeat(400) });
    expect(Array.from(entries[0].text)).toHaveLength(280);
    expect(entries[0].text.endsWith("🌸…")).toBe(true);
    expect(entries[0].duration).toBe(12000);
    vi.advanceTimersByTime(2600); expect(entries).toHaveLength(1);
    vi.advanceTimersByTime(9400); expect(entries).toEqual([]);
  });

  it("clears all timers on unmount and ignores later events", () => {
    const publish = vi.fn(); const queue = createToastQueue(publish);
    queue.push({ text: "one" }); queue.push({ text: "two" });
    queue.dispose(); expect(vi.getTimerCount()).toBe(0);
    publish.mockClear(); queue.push({ text: "late" }); vi.runAllTimers();
    expect(publish).not.toHaveBeenCalled();
  });
});
