import { afterEach, describe, expect, it } from "vitest";
import { GUIDE_FADE, GUIDE_NEAR, clearGuide, guideNow, guideView, showGuide } from "./guideArrow";

afterEach(() => { clearGuide("a"); clearGuide("b"); });

describe("the guide arrow", () => {
  it("shows nothing until a guide is set", () => {
    expect(guideNow()).toBeNull();
  });

  it("points at the newest guide, and back at the one under it once that's cleared", () => {
    showGuide("a", { x: 1, z: 2 });
    const clearB = showGuide("b", { x: 5, z: 6 }, { near: 3 });
    expect(guideNow()).toEqual({ owner: "b", at: { x: 5, z: 6 }, near: 3 });
    clearB();
    expect(guideNow()).toEqual({ owner: "a", at: { x: 1, z: 2 }, near: GUIDE_NEAR });
    clearGuide("a");
    expect(guideNow()).toBeNull();
  });

  it("an owner showing again replaces its own guide", () => {
    showGuide("a", { x: 1, z: 1 });
    showGuide("b", { x: 2, z: 2 });
    showGuide("a", { x: 3, z: 3 });
    expect(guideNow()?.at).toEqual({ x: 3, z: 3 });
    clearGuide("a");
    expect(guideNow()?.owner).toBe("b");
  });

  it("reads a moving target each time, and a null target hides it", () => {
    let at: { x: number; z: number } | null = { x: 0, z: 9 };
    showGuide("a", () => at);
    expect(guideNow()?.at).toEqual({ x: 0, z: 9 });
    at = null;
    expect(guideNow()).toBeNull();
  });

  it("a stale clear never removes the owner's newer guide", () => {
    const old = showGuide("a", { x: 1, z: 1 });
    showGuide("a", { x: 2, z: 2 });
    old();
    expect(guideNow()?.at).toEqual({ x: 2, z: 2 });
  });

  it("heads toward the target and fades in past `near`", () => {
    expect(guideView({ x: 0, z: 0 }, { x: 0, z: 20 }, 8).yaw).toBeCloseTo(0);
    expect(guideView({ x: 0, z: 0 }, { x: 20, z: 0 }, 8).yaw).toBeCloseTo(Math.PI / 2);
    expect(guideView({ x: 0, z: 0 }, { x: 0, z: 5 }, 8).alpha).toBe(0);
    expect(guideView({ x: 0, z: 0 }, { x: 0, z: 8 + GUIDE_FADE / 2 }, 8).alpha).toBeCloseTo(0.5);
    expect(guideView({ x: 0, z: 0 }, { x: 0, z: 40 }, 8).alpha).toBe(1);
  });
});
