import { describe, expect, it } from "vitest";
import { heldScale, toolByKey } from "./tools";
import { ROD_SCALE, rodByKey } from "./rods";

describe("heldScale (rods.ts ROD_SCALE)", () => {
  it("draws the Tidewarden bigger in the hand, its own model and its awakened ones (David 2026-11-26)", () => {
    const k = ROD_SCALE.rod_tidewarden!;
    expect(k).toBeGreaterThan(1);
    expect(heldScale(toolByKey("rod_tidewarden")!.model)).toBe(k);
    for (const a of rodByKey("rod_tidewarden")!.awakenings) if (a.model) expect(heldScale(a.model)).toBe(k);
  });
  it("leaves every other rod and tool at 1", () => {
    expect(heldScale(toolByKey("rod_flimsy")!.model)).toBe(1);
    expect(heldScale("/assets/game/tools/net-1.glb")).toBe(1);
    expect(heldScale("/assets/game/tools/nothing.glb")).toBe(1);
  });
});
