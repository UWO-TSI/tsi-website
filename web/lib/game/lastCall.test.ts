import { describe, expect, it } from "vitest";
import { lastCall } from "./lastCall";

describe("lastCall (entry-perf: the scene's renders before it first commits)", () => {
  it("gives the last result while the arguments are the same, and works again when one changes", () => {
    let runs = 0;
    const f = lastCall((a: object, n: number) => ({ a, n, run: ++runs }));
    const a = {}, b = {};
    const first = f(a, 1);
    expect(f(a, 1)).toBe(first);
    expect(runs).toBe(1);
    expect(f(a, 2).run).toBe(2);
    expect(f(b, 2).run).toBe(3);
    expect(f(b, 2).run).toBe(3);
  });
});
