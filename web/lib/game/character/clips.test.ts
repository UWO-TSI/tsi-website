import { describe, expect, it } from "vitest";
import { airPhase, combatClip, contactCrossed, crossfade, locomotion, matchPhase, resolveClip, seatLift, tempo, type ClipName, type CombatView } from "./clips";
import { CLIPS, CLIP_BY_NAME } from "./look";

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
    expect(resolveClip({ speed: 9, walkSpeed: 7.4, pose: null, oneShot: null, move: "Fall" })).toBe("Fall");
    expect(resolveClip({ speed: 9, walkSpeed: 7.4, pose: null, oneShot: "Jump", move: "Fall" })).toBe("Jump");
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
    // Study and Stretch are authored on the same seat (study chair 0.52, bench 0.5).
    expect(seatLift("Study", 0.52, 1.3)).toBeCloseTo(0.52 - 0.12 * 1.3);
    expect(seatLift("Stretch", 0.5, 1.3)).toBeCloseTo(seatLift("Sit", 0.5, 1.3));
  });
  it("Stretch is its own seated 2 s loop in the clip catalogue", () => {
    expect(CLIP_BY_NAME.get("Stretch")).toMatchObject({ length: 2, loop: true, seatHeight: CLIP_BY_NAME.get("Sit")!.seatHeight });
  });
});

describe("movement feel: foot contacts and the air pose", () => {
  it("Walk and Run carry measured foot contacts, half a cycle apart; Air is posed by phase", () => {
    for (const name of ["Walk", "Run"]) {
      const c = CLIP_BY_NAME.get(name)!.contacts!;
      expect(c).toHaveLength(2);
      expect(Math.abs(((c[1] - c[0] + 1) % 1) - 0.5)).toBeLessThan(0.08);
    }
    expect(CLIP_BY_NAME.get("Air")).toMatchObject({ scrub: true, loop: false });
    expect(CLIP_BY_NAME.get("Jump")?.endsOn).toBe("Air");
    expect(CLIP_BY_NAME.get("LandHeavy")!.length).toBeGreaterThan(CLIP_BY_NAME.get("Land")!.length);
  });
  it("reports the contact the playhead passed this frame, across the loop's end too", () => {
    const c = [0.22, 0.72];
    expect(contactCrossed(c, 0.1, 0.2)).toBe(-1);
    expect(contactCrossed(c, 0.2, 0.25)).toBe(0);
    expect(contactCrossed(c, 0.7, 0.75)).toBe(1);
    expect(contactCrossed(c, 0.95, 0.23)).toBe(0); // wrapped
    expect(contactCrossed(c, 0.6, 0.3)).toBe(0); // a long hitch over both: the later one
    expect(contactCrossed(undefined, 0.1, 0.9)).toBe(-1);
    // A whole cycle at a steady pace passes each contact once.
    let steps = 0;
    for (let t = 0; t < 1; t += 1 / 37) steps += contactCrossed(c, t % 1, (t + 1 / 37) % 1) >= 0 ? 1 : 0;
    expect(steps).toBe(2);
  });
  it("the air pose follows vertical speed: take-off, apex tuck, reaching for the ground; a walk off an edge starts falling", () => {
    expect(airPhase(8.6, 8.6, true)).toBe(0);
    expect(airPhase(0, 8.6, true)).toBe(0.5);
    expect(airPhase(-8.6, 8.6, true)).toBe(1);
    expect(airPhase(-20, 8.6, true)).toBe(1);
    const rising = [8, 6, 4, 2, 0, -2, -4, -8].map(v => airPhase(v, 8.6, true));
    expect(rising).toEqual([...rising].sort((a, b) => a - b)); // never pops backwards through the arc
    expect(airPhase(0, 8.6, false)).toBe(0.75);
  });
});

describe("crouch and the slide (specs/movement-slide.md)", () => {
  it("has its clips in the catalogue: loops for the crouch and the slide, one-shots that hand over to what follows them", () => {
    for (const name of ["CrouchIdle", "CrouchWalk", "Slide"]) expect(CLIP_BY_NAME.get(name)?.loop, name).toBe(true);
    expect(Object.fromEntries(["SlideIn", "SlideInDash", "SlideUp", "SlideJump", "SlideStand"].map(n => [n, CLIP_BY_NAME.get(n)?.endsOn])))
      .toEqual({ SlideIn: "Slide", SlideInDash: "Slide", SlideUp: "Run", SlideJump: "Air", SlideStand: "CrouchIdle" });
    expect(CLIP_BY_NAME.get("SlideInDash")!.length).toBeLessThan(CLIP_BY_NAME.get("SlideIn")!.length); // the dash's drop is sharper
    expect(CLIP_BY_NAME.get("SlideBonk")).toMatchObject({ loop: false, endsNeutral: true });
    // Crouch walk carries its measured footfalls (the footstep dust comes from them), half a cycle apart.
    const c = CLIP_BY_NAME.get("CrouchWalk")!.contacts!;
    expect(c).toHaveLength(2);
    expect(Math.abs(((c[1] - c[0] + 1) % 1) - 0.5)).toBeLessThan(0.08);
    expect(tempo("CrouchWalk", 2.2, 7.4)).toBeCloseTo(1, 2);
  });
  it("crossfades run, slide, slide-jump, air and land-slide in a few hundredths; the crouch eases", () => {
    for (const [a, b] of [["Run", "SlideIn"], ["SlideIn", "Slide"], ["Slide", "SlideJump"], ["SlideJump", "Air"], ["Air", "SlideInDash"], ["Dash", "SlideInDash"], ["Slide", "SlideUp"]] as const)
      expect(crossfade(a, b), `${a} > ${b}`).toBeLessThanOrEqual(0.06);
    expect(crossfade("Idle", "CrouchIdle")).toBeGreaterThan(0.1);
    expect(crossfade(null, "Idle")).toBe(0.16);
  });
});

describe("the transition table and stride matching (movement feel milestone 2)", () => {
  const names = CLIPS.map(c => c.name as ClipName);
  it("gives every pair of clips a crossfade: quick for movement, a landing cuts into a fall, seats and lying down ease", () => {
    expect(names.length).toBeGreaterThan(40);
    for (const a of names) for (const b of names) {
      const t = crossfade(a, b);
      expect(t, `${a} > ${b}`).toBeGreaterThanOrEqual(0.03);
      expect(t, `${a} > ${b}`).toBeLessThanOrEqual(0.3);
    }
    for (const from of ["Air", "Fall"] as const) for (const to of ["Land", "LandHeavy", "Roll"] as const) expect(crossfade(from, to)).toBeLessThanOrEqual(0.05);
    for (const to of ["Sit", "Study", "Sleep"] as const) expect(crossfade("Walk", to)).toBeGreaterThanOrEqual(0.2);
    expect(crossfade("Run", "Hit")).toBe(0.04);
    expect(crossfade("Walk", "Jump")).toBeLessThanOrEqual(0.06);
  });
  it("hands walk, run and crouch-walk over in step, the same foot coming down; anything else starts at the top", () => {
    const walk = CLIP_BY_NAME.get("Walk")!.contacts!, run = CLIP_BY_NAME.get("Run")!.contacts!;
    expect(matchPhase("Walk", walk[0], "Run")).toBeCloseTo(run[0], 6); // the left foot down in both
    expect(matchPhase("Walk", walk[1], "Run")!).toBeCloseTo(((run[0] + walk[1] - walk[0]) % 1 + 1) % 1, 6);
    expect(matchPhase("Run", 0.3, "CrouchWalk")).not.toBeNull();
    expect(matchPhase("Idle", 0.3, "Walk")).toBeNull();
    expect(matchPhase("Walk", 0.3, "Jump")).toBeNull();
    for (let p = 0; p < 1; p += 0.13) { const q = matchPhase("Run", p, "Walk")!; expect(q).toBeGreaterThanOrEqual(0); expect(q).toBeLessThan(1); }
  });
  it("keeps the run down to 1.15x walking pace once running, so a speed on the line never flickers", () => {
    expect(locomotion(8.9, 7.4)).toBe("Walk");
    expect(locomotion(8.9, 7.4, "Run")).toBe("Run");
    expect(locomotion(8.4, 7.4, "Run")).toBe("Walk");
    expect(tempo("Walk", 1.5, 7.4)).toBeCloseTo(1.5 / 7.4, 6); // cadence follows a slow amble too
  });
});
