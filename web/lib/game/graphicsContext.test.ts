import { expect, it, vi } from "vitest";
import { createGraphicsContextStore } from "./graphicsContext";

it("suspends effects on context loss, permits restoration and detaches on unmount", () => {
  let lost = false;
  const canvas = new EventTarget();
  const store = createGraphicsContextStore({ isContextLost: () => lost }, canvas);
  const notify = vi.fn();
  const unsubscribe = store.subscribe(notify);
  expect(store.getSnapshot()).toBe(true);
  lost = true;
  const event = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(store.getSnapshot()).toBe(false);
  expect(notify).toHaveBeenCalledTimes(1);
  lost = false;
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(store.getSnapshot()).toBe(true);
  expect(notify).toHaveBeenCalledTimes(2);
  unsubscribe();
  canvas.dispatchEvent(new Event("webglcontextlost"));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(notify).toHaveBeenCalledTimes(2);
});
