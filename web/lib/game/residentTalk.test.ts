import { describe, expect, it } from "vitest";
import { villageIsland } from "./defaultIsland";
import { village } from "./villageMap";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import { RESIDENT_WALK, ResidentDay, daySpan, navGrid, newPose, planResidents } from "./residentRoutine";
import {
  CATCH_UP, TALK_CLOSE_S, TALK_PITCH, TALK_RANGE, TALK_SHOT, TALK_TURN_S, beginTalk, blipAt, endTalk, leaveTalk, nearestTalker, onTalkScript, pressTalk, routineLag, startTalk, steerTalkShot, stepTalk, talkCameraYaw, talkStore,
  talkTyping, typeMs, typedAt,
} from "./residentTalk";

const WREN = { id: "r-wren", slug: "wren", name: "Alice", post: "hq_lead", seed: 7 };
const LINES = [{ text: "Oh! Hi there.", face: "happy" as const }, { text: "Club goals are coming along.", face: null }];

describe("talking to residents: approach", () => {
  const list = [
    { id: "a", x: 3, z: 0, hidden: false },
    { id: "b", x: 0, z: 1.2, hidden: false },
    { id: "c", x: 0, z: 0.6, hidden: true },
  ];
  it("offers nobody until you are within reach, then the nearest one you can see", () => {
    expect(nearestTalker(list, 0, -3)).toBe(-1);
    expect(nearestTalker(list, 0, 0)).toBe(1); // c is nearer but indoors (hidden)
    expect(nearestTalker(list, 2.6, 0)).toBe(0);
    expect(nearestTalker(list, 0, 1.2 - TALK_RANGE + 0.05)).toBe(1);
    expect(nearestTalker(list, 0, 1.2 - TALK_RANGE - 0.05)).toBe(-1);
  });
});

describe("talking to residents: E, the turn, the lines", () => {
  it("E: they stop and turn to you first; the box opens once they have turned", () => {
    const t = beginTalk(WREN, LINES, 100);
    expect(t.phase).toBe("turning");
    expect(stepTalk(t, 100 + TALK_TURN_S / 2)).toBeNull();
    expect(talkTyping(t)).toBe(false);
    expect(stepTalk(t, 100 + TALK_TURN_S)).toBe("turned");
    expect(t).toMatchObject({ phase: "speaking", index: 0, typed: 0 });
    // A press while they are still turning does nothing (the box isn't up yet).
    const early = beginTalk(WREN, LINES, 0);
    expect(pressTalk(early, 0.1)).toBeNull();
    expect(early.phase).toBe("turning");
  });

  it("each line types out, a press finishes it, the next press moves on, and after the last they say goodbye", () => {
    const t = beginTalk(WREN, LINES, 0);
    stepTalk(t, TALK_TURN_S);
    const start = t.lineAt;
    expect(stepTalk(t, start + 0.1)).toBe("typing");
    expect(talkTyping(t)).toBe(true);
    expect(t.typed).toBeGreaterThan(0);
    expect(t.typed).toBeLessThan(LINES[0].text.length);
    expect(pressTalk(t, start + 0.15)).toBe("finish");
    expect(t.typed).toBe(LINES[0].text.length);
    expect(talkTyping(t)).toBe(false);
    expect(pressTalk(t, start + 0.4)).toBe("next");
    expect(t).toMatchObject({ index: 1, typed: 0, phase: "speaking" });
    // Left alone, the line finishes by itself and waits for you.
    expect(stepTalk(t, t.lineAt + typeMs(LINES[1].text) / 1000 + 0.01)).toBe("typed");
    expect(t.typed).toBe(LINES[1].text.length);
    expect(stepTalk(t, t.lineAt + 30)).toBeNull();
    expect(pressTalk(t, 50)).toBe("close");
    expect(t.phase).toBe("closing");
    expect(stepTalk(t, 50 + TALK_CLOSE_S / 2)).toBeNull();
    expect(stepTalk(t, 50 + TALK_CLOSE_S)).toBe("ended");
  });

  it("Escape leaves from anywhere, straight to the goodbye", () => {
    const t = beginTalk(WREN, LINES, 0);
    stepTalk(t, TALK_TURN_S);
    leaveTalk(t, 1);
    expect(t.phase).toBe("closing");
    expect(stepTalk(t, 1 + TALK_CLOSE_S)).toBe("ended");
  });

  it("an empty conversation still says something", () => {
    const t = beginTalk(WREN, [], 0);
    expect(t.lines.length).toBeGreaterThan(0);
    expect(t.lines[0].text.length).toBeGreaterThan(0);
  });

  it("types at a talking pace and breathes at punctuation", () => {
    const plain = "abcdefghij abcdefghij", dotted = "abcdefghij. abcdefghi";
    expect(typeMs(plain)).toBeGreaterThan(300);
    expect(typeMs(plain)).toBeLessThan(900);
    expect(typeMs(dotted)).toBeGreaterThan(typeMs(plain) + 150);
    expect(typedAt(plain, 0)).toBe(0);
    expect(typedAt(plain, typeMs(plain))).toBe(plain.length);
    // Monotonic.
    let last = 0;
    for (let ms = 0; ms < 1200; ms += 7) { const n = typedAt(dotted, ms); expect(n).toBeGreaterThanOrEqual(last); last = n; }
  });

  it("the voice blips on syllables, never on spaces or punctuation", () => {
    const text = "Oh! Hi there.";
    const blips = [...text].map((_, i) => blipAt(text, i));
    expect(blips[0]).toBe(true); // a word's first letter
    expect(blips[2]).toBe(false); // "!"
    expect(blips[3]).toBe(false); // " "
    expect(blips.filter(Boolean).length).toBeGreaterThanOrEqual(3);
    expect(blips.filter(Boolean).length).toBeLessThan(text.length / 1.5);
  });
});

describe("talking to residents: a scripted conversation (row 312)", () => {
  it("tells the island its script as it ends, said through or left early; a usual talk tells nothing", () => {
    const heard: string[] = [];
    const off = onTalkScript((script, slug) => heard.push(`${slug}:${script}`));
    startTalk(beginTalk(WREN, LINES, 0, "hq"));
    expect(talkStore.active?.script).toBe("hq");
    endTalk();
    startTalk(beginTalk(WREN, LINES, 0));
    endTalk();
    const left = beginTalk({ ...WREN, slug: "curator" }, LINES, 0, "tool:net:offer");
    startTalk(left); leaveTalk(left, 1); endTalk();
    off();
    startTalk(beginTalk(WREN, LINES, 0, "hq")); endTalk();
    expect(heard).toEqual(["wren:hq", "curator:tool:net:offer"]);
  });
});

describe("talking to residents: the camera", () => {
  it("looks over your shoulder at them, turning no more than it must, the shorter way", () => {
    // They stand straight ahead (+z) of you: the camera steps off the line between you, to the side it was nearer.
    const a = talkCameraYaw(0, 0, 0, 2, 0.1);
    expect(a).toBeGreaterThan(0.7);
    expect(a).toBeLessThan(1);
    expect(talkCameraYaw(0, 0, 0, 2, -0.1)).toBeLessThan(-0.7);
    // Already looking past your shoulder at them: it stays where it is.
    expect(talkCameraYaw(0, 0, 0, 2, 0.95)).toBeCloseTo(0.95);
    expect(talkCameraYaw(0, 0, 2, 0, Math.PI / 2 - 1)).toBeCloseTo(Math.PI / 2 - 1);
    // Never so close to the line between you that your head hides their face (a three-quarter view of it).
    expect(Math.abs(talkCameraYaw(0, 0, 0, 2, 0.1))).toBeGreaterThanOrEqual(0.75);
    // They're behind you (the camera would see their back): it comes round the shorter way until they're in view.
    const behind = talkCameraYaw(0, 0, 0, -2, 0.3);
    expect(Math.abs(Math.atan2(Math.sin(behind - Math.PI), Math.cos(behind - Math.PI)))).toBeLessThanOrEqual(1.2 + 1e-9);
    expect(behind).toBeLessThan(Math.PI);
    expect(TALK_PITCH).toBeGreaterThan(0.35);
    expect(TALK_PITCH).toBeLessThan(0.6);
    expect(behind).toBeGreaterThan(0.3); // turned left (the shorter way from 0.3 toward pi)
  });

  it("the conversation shot glides down to face level and in to the two-shot while the camera sits idle", () => {
    const o = { target: { yaw: 0.9, pitch: 0.6, zoom: 1 }, idle: 5 };
    for (let i = 0; i < 300; i++) steerTalkShot(1 / 60, i / 60, 0, 0, 0, 2, 0, o);
    expect(o.target.pitch).toBeCloseTo(TALK_SHOT.pitch, 1);
    expect(o.target.zoom).toBeCloseTo(TALK_SHOT.zoom, 1);
    // The sway keeps the heading near the shoulder, never wandering.
    expect(Math.abs(o.target.yaw)).toBeGreaterThan(0.7);
    expect(Math.abs(o.target.yaw)).toBeLessThan(1.3);
  });

  it("the player's own look wins: a touched camera is not steered", () => {
    const o = { target: { yaw: 0.2, pitch: 0.6, zoom: 1 }, idle: 0 };
    steerTalkShot(1 / 60, 0, 0, 0, 0, 2, 0, o);
    expect(o.target).toEqual({ yaw: 0.2, pitch: 0.6, zoom: 1 });
  });

  it("each line said pushes a little closer, and the push stops growing", () => {
    const settle = (line: number) => {
      const o = { target: { yaw: 0.9, pitch: 0.6, zoom: 1 }, idle: 5 };
      for (let i = 0; i < 300; i++) steerTalkShot(1 / 60, i / 60, 0, 0, 0, 2, line, o);
      return o.target.zoom;
    };
    expect(settle(2)).toBeLessThan(settle(0));
    expect(settle(TALK_SHOT.pushMax + 3)).toBeCloseTo(settle(TALK_SHOT.pushMax), 2);
  });
});

describe("talking to residents: the routine holds and resumes where it left off", () => {
  const v = village(), island = villageIsland(v), nav = navGrid(island, v);
  const sorted = [...PROPOSED_RESIDENTS].sort((a, b) => a.slug.localeCompare(b.slug)), plans = planResidents(sorted, v, island);
  const T = Date.parse("2026-10-01T16:00:00Z") / 1000, span = daySpan(T * 1000);

  it("routineLag: holding adds the time, letting go catches up a little brisker until level", () => {
    expect(routineLag(0, true, 0.5)).toBeCloseTo(0.5);
    expect(routineLag(1, false, 1)).toBeCloseTo(1 - CATCH_UP);
    expect(routineLag(0.1, false, 1)).toBe(0);
  });

  it("a resident stopped mid-walk stays put through the talk, then walks on from the same spot without a jump", () => {
    // Find someone walking in the afternoon.
    let found: { day: ResidentDay; t: number } | null = null;
    for (const plan of plans) {
      const day = new ResidentDay(plan, nav), pose = newPose();
      for (let t = span.t0 + 12 * 3600; t < span.t0 + 15 * 3600 && !found; t += 5) if (day.at(t, null, pose).moving && pose.speed > RESIDENT_WALK * 0.8) found = { day, t };
      if (found) break;
    }
    expect(found).not.toBeNull();
    const { day, t: t0 } = found!, dt = 1 / 30, pose = newPose();
    const at = (t: number, lag: number) => { day.at(t - lag, null, pose); return [pose.x, pose.z, pose.moving] as const; };
    const [x0, z0] = at(t0, 0);
    let lag = 0, t = t0;
    // Six seconds of talk: the routine holds.
    for (let i = 0; i < 180; i++) { t += dt; lag = routineLag(lag, true, dt); const [x, z] = at(t, lag); expect(Math.hypot(x - x0, z - z0)).toBeLessThan(1e-4); }
    expect(lag).toBeCloseTo(6, 5);
    // Let go: from the same spot, never faster than a brisk stroll, until the routine is level with the world clock.
    let [px, pz] = [x0, z0];
    let frames = 0;
    while (lag > 0 && frames < 10000) {
      t += dt; lag = routineLag(lag, false, dt); frames++;
      const [x, z] = at(t, lag);
      expect(Math.hypot(x - px, z - pz)).toBeLessThanOrEqual(RESIDENT_WALK * (1 + CATCH_UP) * dt + 1e-6);
      px = x; pz = z;
    }
    expect(lag).toBe(0);
    expect(frames * dt).toBeCloseTo(6 / CATCH_UP, 0);
  });
});

describe("a step back as a talk opens, in their face (David's playtest)", () => {
  it("only when too close, straight away from them, to a comfortable distance", async () => {
    const { TALK_COMFORT, stepBack } = await import("./residentTalk");
    const them = { x: 10, z: 5 };
    expect(stepBack({ x: 10 + TALK_COMFORT, z: 5 }, them)).toBeNull();
    expect(stepBack({ x: 10, z: 5 + 1.5 }, them)).toBeNull();
    const to = stepBack({ x: 10.3, z: 5.4 }, them)!;
    expect(Math.hypot(to.x - them.x, to.z - them.z)).toBeCloseTo(TALK_COMFORT, 5);
    // The same way as you stood from them.
    expect(Math.atan2(to.x - them.x, to.z - them.z)).toBeCloseTo(Math.atan2(0.3, 0.4), 5);
  });
  it("half a step where the full one doesn't fit, none where neither does", async () => {
    const { TALK_COMFORT, stepBack } = await import("./residentTalk");
    const them = { x: 0, z: 0 }, me = { x: 0, z: 0.5 };
    const half = stepBack(me, them, (_x, z) => z < 1)!;
    expect(half.z).toBeCloseTo((TALK_COMFORT + 0.5) / 2, 5);
    expect(stepBack(me, them, () => false)).toBeNull();
  });
});
