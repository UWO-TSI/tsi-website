import { describe, expect, it } from "vitest";
import { addKick, applyKick, MOVE_HOOK, moveOk, speedBonus } from "./moveHooks";
import { createMoveState, MOVE_TUNING, type MoveWorld } from "@/lib/game/movement/sim";

const flat = { top: () => 0 } as unknown as MoveWorld;
const v = { mode: "ground", speed: 7.4, sinceDash: 9, vx: 0, vz: 7.4 };

describe("movement hooks (design sheet §1.1)", () => {
  it("reads the sim: sliding, airborne (or gliding), 0.35 s after a dash, above a run", () => {
    expect(moveOk(undefined, v)).toBe(true);
    expect(moveOk("sliding", v)).toBe(false);
    expect(moveOk("sliding", { ...v, mode: "slide" })).toBe(true);
    expect(moveOk("airborne", { ...v, mode: "glide" })).toBe(true);
    expect(moveOk("afterDash", { ...v, sinceDash: 0.3 })).toBe(true);
    expect(moveOk("afterDash", { ...v, sinceDash: 0.4 })).toBe(false);
    expect(moveOk("fast", { ...v, speed: 9.5 })).toBe(true);
  });
  it("scales power with carried speed: none at a walk, the full rider at 16 u/s", () => {
    expect(speedBonus(7.4, 0.5)).toBe(0);
    expect(speedBonus(16, 0.5)).toBe(0.5);
    expect(speedBonus(30, 0.5)).toBe(0.5);
    expect(speedBonus(11.7, 0.5)).toBeCloseTo(0.25);
  });
  it("pushes along the aim at most 4 u/s a frame's casts, and never past the 18 u/s ceiling", () => {
    const k = addKick(addKick(null, 3, 4, 3, 0), 3, 4, 3, 0);
    expect(k).toMatchObject({ dx: 0.6, dz: 0.8, speed: MOVE_HOOK.maxPush });
    const s = createMoveState(0, 0, flat);
    s.vx = 0; s.vz = 10;
    applyKick(s, { dx: 0, dz: 1, speed: 4, up: 0, hang: false }, MOVE_TUNING);
    expect(s.vz).toBeCloseTo(14);
    s.vz = 16;
    applyKick(s, { dx: 0, dz: 1, speed: 4, up: 0, hang: false }, MOVE_TUNING);
    expect(s.vz).toBeCloseTo(18);
    s.vz = 20; // tech already past the ceiling (downhill): kept, not slowed
    applyKick(s, { dx: 0, dz: 1, speed: 4, up: 0, hang: false }, MOVE_TUNING);
    expect(s.vz).toBeCloseTo(20);
  });
  it("a hop leaves the ground on the jump's gravity, reaching about its height", () => {
    const s = createMoveState(0, 0, flat);
    applyKick(s, { dx: 0, dz: 0, speed: 0, up: 0.8, hang: false }, MOVE_TUNING);
    expect(s.mode).toBe("air");
    const g = (2 * MOVE_TUNING.jumpHeight) / MOVE_TUNING.jumpApexTime ** 2;
    expect((s.vy * s.vy) / (2 * g)).toBeCloseTo(0.8);
  });
  it("a hang lifts a falling body a little, and does nothing on the ground", () => {
    const s = createMoveState(0, 0, flat);
    applyKick(s, { dx: 0, dz: 0, speed: 0, up: 0, hang: true }, MOVE_TUNING);
    expect(s.vy).toBe(0);
    s.mode = "air"; s.vy = -5;
    applyKick(s, { dx: 0, dz: 0, speed: 0, up: 0, hang: true }, MOVE_TUNING);
    expect(s.vy).toBe(MOVE_HOOK.hangLift);
  });
});
