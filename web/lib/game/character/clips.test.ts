import { describe, expect, it } from "vitest";
import { combatClip, locomotion, resolveClip, seatLift, tempo, type CombatView } from "./clips";

describe("character state machine", () => {
  it("picks locomotion from speed", () => {
    expect([0, 0.05, 3, 7.4, 9.5, 13.7].map(s => locomotion(s, 7.4))).toEqual(["Idle", "Idle", "Walk", "Walk", "Run", "Run"]);
    expect(tempo("Walk", 3.7, 7.4)).toBeCloseTo(0.5);
    expect(tempo("Idle", 5, 7.4)).toBe(1);
  });
  it("one-shot beats held pose beats locomotion; moving drops the pose", () => {
    expect(resolveClip({ speed: 0, walkSpeed: 7.4, pose: "Sit", oneShot: null })).toBe("Sit");
    expect(resolveClip({ speed: 0, walkSpeed: 7.4, pose: "FishHold", oneShot: "Fish" })).toBe("Fish");
    expect(resolveClip({ speed: 5, walkSpeed: 7.4, pose: "Sit", oneShot: null })).toBe("Walk");
    expect(resolveClip({ speed: 5, walkSpeed: 7.4, pose: null, oneShot: "Wave" })).toBe("Wave");
  });
  it("turns encounter edges into one-shots and holds Trace/Defeat", () => {
    const idle: CombatView = { alive: true, dodgeAge: null, hurt: 0, attackCd: 0 };
    expect(combatClip({ ...idle, attackCd: 0.42 }, idle, false, "melee")).toEqual({ pose: null, play: "AttackMelee" });
    expect(combatClip({ ...idle, attackCd: 0.3 }, { ...idle, attackCd: 0.31 }, false, "melee").play).toBeNull();
    expect(combatClip({ ...idle, attackCd: 0.6 }, idle, false, "bow").play).toBe("AttackBow");
    expect(combatClip({ ...idle, attackCd: 0.75 }, idle, false, "staff").play).toBe("AttackCast");
    expect(combatClip({ ...idle, dodgeAge: 0 }, idle, false, "melee").play).toBe("DodgeRoll");
    expect(combatClip({ ...idle, hurt: 0.35 }, idle, false, "melee").play).toBe("Hit");
    expect(combatClip(idle, idle, true, "melee")).toEqual({ pose: "Trace", play: null });
    expect(combatClip({ ...idle, alive: false }, idle, false, "melee")).toEqual({ pose: "Defeat", play: null });
  });
  it("lifts seat clips onto the furniture's measured seat height", () => {
    expect(seatLift("Sit", 0.45, 1.3)).toBeCloseTo(0.45 - 0.12 * 1.3);
    expect(seatLift("Sleep", 0.3, 1.3)).toBeCloseTo(0.3);
  });
});
