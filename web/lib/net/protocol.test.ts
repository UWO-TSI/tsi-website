import { describe, expect, expectTypeOf, it } from "vitest";
import { MOVE_TUNING, NO_INPUT, STEP, createMoveState, slopeAt, stepMove, type MoveEventKind, type MoveInput, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import { EMOTE_CLIPS, type ClipName } from "@/lib/game/character/clips";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { FAMILIES } from "@/lib/game/oracle/family";
import { village } from "@/lib/game/villageMap";
import { createRuins } from "@/lib/game/ruins";
import type { Family } from "@/lib/oracle/engine";
import type { Frame } from "@/lib/combat/mastery";
import type { Phase } from "@/lib/study/rules";
import type { WheelKind } from "@/lib/game/toolWheel";
import {
  AREAS, AREA_BOUNDS, CARD_BADGES, CARD_FAMILIES, CARD_FRAMES, CHAT, CLOCK, CLOSE, EMOTE_CLIP_NAMES, EV, EV_DT_MAX_MS, EV_KINDS, EV_MAX, FLAG,
  HELD_KINDS, HTTP_REFUSAL, INTEREST, INTERP_DELAY_MS, MOVE_CLIPS, NET_MOVE, NET_PLAYER_FIELDS, NET_ROSTER_FIELDS, PACKET_FLAG, PATCH_RATE_MS, POSE_FIELDS,
  POSE_LEN, PRIVATE_AREAS, PROTOCOL, RATE_LIMITS, RECONNECT_GRACE_S, REJOIN_BACKOFF_S, RESTART_JITTER_MS, SANITY, SEND, SHARD, STUDY_STATES, SYS_TEXT_MAX,
  TIME_MAX, cardBadge, cardFamily, cardFrame, createPose, decodeEvent, decodePose, dequantAir, dequantLeaf, dequantLift, dequantPos, dequantVel,
  dequantYaw, encodeEvent, encodePose, estimateClockOffset, hasFlag, heldOf, inAreaBounds, isClipEv, isEmoteClip, isHeld, isPrivateArea, joinRefusal,
  moveIndex, parseHeld, parseJoinOptions, parsePing, parsePong, parseSlowState, parseSys, pushEv, quantAir, quantLeaf, quantLift, quantPos, quantTime,
  quantVel, quantYaw, roomTime, seqAfter, studyIndex,
  type CardFamily, type CardFrame, type ClockSample, type EvKind, type HeldKind, type MoveClip, type NetPlayer, type Pose, type PosePacket,
  type RosterEntry, type StudyState,
} from "./protocol";

/** mulberry32: a seeded generator, so the random cases are the same every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = 2 * Math.PI;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("append-only tables (wire indexes: add at the end, never reorder, rename or remove)", () => {
  const locked = (table: readonly unknown[], v1: readonly unknown[]) => expect(table.slice(0, v1.length)).toEqual(v1);
  it("AREAS", () => {
    locked(AREAS, ["village", "cafe", "hq", "museum", "oracle", "ruins", "home", "house"]);
    expect(PRIVATE_AREAS).toEqual(["ruins", "home", "house"]);
    expect(AREAS.filter(isPrivateArea)).toEqual(["ruins", "home", "house"]);
  });
  it("MOVE_CLIPS", () => {
    locked(MOVE_CLIPS, [null, "Air", "Fall", "Glide", "Skid", "Slide", "CrouchWalk", "CrouchIdle"]);
    // Every one is a real clip on the rig, and the type is a subset of ClipName.
    for (const c of MOVE_CLIPS) if (c) expect(CLIP_BY_NAME.has(c)).toBe(true);
    expectTypeOf<MoveClip>().toExtend<ClipName>();
  });
  it("EV_KINDS: the motion one-shots, then every movement juice kind but recover", () => {
    locked(EV_KINDS, ["play", "upper", "ghost", "stop", "jump", "hop", "long", "dashjump", "land", "dash", "slide", "dashslide", "landslide", "slidejump",
      "stand", "glide", "furl", "mantle", "roll", "skid", "bonk", "splash", "respawn"]);
    expectTypeOf<Exclude<EvKind, "play" | "upper" | "ghost" | "stop">>().toEqualTypeOf<Exclude<MoveEventKind, "recover">>();
    EV_KINDS.forEach((k, i) => expect(EV[k]).toBe(i));
  });
  it("STUDY_STATES, CARD_BADGES, CARD_FAMILIES, CARD_FRAMES", () => {
    locked(STUDY_STATES, ["none", "seated", "focus", "break"]);
    locked(CARD_BADGES, [null, "member"]);
    locked(CARD_FAMILIES, [null, "Arcane", "Ranger", "Vanguard", "Warden"]);
    locked(CARD_FRAMES, [null, "bronze", "silver", "gold"]);
    expectTypeOf<Exclude<StudyState, "none">>().toEqualTypeOf<Exclude<Phase, "ended">>();
    expectTypeOf<CardFamily>().toEqualTypeOf<Family>();
    expectTypeOf<CardFrame>().toEqualTypeOf<Frame>();
    expect(new Set(CARD_FAMILIES.slice(1))).toEqual(new Set(Object.keys(FAMILIES)));
  });
  it("flags", () => {
    expect(FLAG).toEqual({ away: 1, afk: 2, mobile: 4, showClass: 8, typing: 16, armed: 32 });
    expect(PACKET_FLAG).toEqual({ teleport: 128 });
    expect(hasFlag(FLAG.afk | FLAG.mobile, FLAG.mobile)).toBe(true);
    expect(hasFlag(FLAG.afk, FLAG.away)).toBe(false);
  });
  it("held kinds are the tool wheel's", () => {
    locked(HELD_KINDS, ["rod", "net", "shovel", "pin", "weapon"]);
    expectTypeOf<HeldKind | "glider">().toEqualTypeOf<WheelKind>();
  });
});

describe("enum helpers", () => {
  it("moveIndex: a move clip's index, anything else none", () => {
    expect(moveIndex("Glide")).toBe(3);
    expect(moveIndex(null)).toBe(0);
    expect(moveIndex(undefined)).toBe(0);
    expect(moveIndex("Swim")).toBe(0);
  });
  it("studyIndex: the study phase, ended or none is 0", () => {
    expect(["seated", "focus", "break", "ended", null, undefined, "nap"].map(studyIndex)).toEqual([1, 2, 3, 0, 0, 0, 0]);
  });
  it("card helpers map the card's keys to indexes (the world nameplate draws only mastery frames)", () => {
    expect([cardBadge("member"), cardBadge(null), cardBadge("staff")]).toEqual([1, 0, 0]);
    expect([cardFamily("Warden"), cardFamily(null), cardFamily("warden")]).toEqual([4, 0, 0]);
    expect(["mastery:bronze", "mastery:silver", "mastery:gold", "ranger-fletching", null].map(cardFrame)).toEqual([1, 2, 3, 0, 0]);
  });
  it("emotes are the emote menu's clips", () => {
    expect(new Set(EMOTE_CLIP_NAMES)).toEqual(new Set(Object.values(EMOTE_CLIPS)));
    expect(isEmoteClip("Wave")).toBe(true);
    expect(isEmoteClip("Jump")).toBe(false);
    expect(isEmoteClip(3)).toBe(false);
    expect(isClipEv(EV.play) && isClipEv(EV.upper) && !isClipEv(EV.land)).toBe(true);
  });
  it("held strings", () => {
    expect(heldOf("rod", "rod-2")).toBe("rod:rod-2");
    expect(heldOf("glider", "leaf-glider")).toBe("glider");
    expect(heldOf("weapon", "bad key")).toBe("");
    expect(heldOf("hat", "x")).toBe("");
    expect(parseHeld("shovel:shovel-1")).toEqual({ kind: "shovel", key: "shovel-1" });
    expect(parseHeld("glider")).toEqual({ kind: "glider", key: "" });
    expect(["", "glider", "pin:wood_branch", "weapon:sword-driftwood"].every(isHeld)).toBe(true);
    expect(["rod", "rod:", "glider:x", "hat:x", "rod:a b", `rod:${"k".repeat(65)}`, 3, null].some(isHeld)).toBe(false);
  });
});

describe("quantization: exact on the wire, within half a step from floats", () => {
  const r = rng(7);
  it("positions: int16 centimetres, ±327.67 u", () => {
    for (let q = -32768; q <= 32767; q += 7) expect(quantPos(dequantPos(q))).toBe(q);
    expect(quantPos(dequantPos(32767))).toBe(32767);
    for (let i = 0; i < 4000; i++) {
      const u = (r() * 2 - 1) * 327;
      expect(Math.abs(dequantPos(quantPos(u)) - u)).toBeLessThanOrEqual(0.005 + 1e-9);
    }
    expect([quantPos(400), quantPos(-400), quantPos(NaN), quantPos(Infinity), quantPos(-Infinity)]).toEqual([32767, -32768, 0, 32767, -32768]);
    expect(Object.is(quantPos(-0.001), 0)).toBe(true); // never -0 on the wire
  });
  it("velocities: centimetres a second, clamped to ±40 u/s", () => {
    for (let q = -4000; q <= 4000; q++) expect(quantVel(dequantVel(q))).toBe(q);
    for (let i = 0; i < 4000; i++) {
      const v = (r() * 2 - 1) * 40;
      expect(Math.abs(dequantVel(quantVel(v)) - v)).toBeLessThanOrEqual(0.005 + 1e-9);
    }
    expect([quantVel(55), quantVel(-41), quantVel(NaN)]).toEqual([4000, -4000, 0]);
  });
  it("yaw: uint16 turns, any angle in, [0, 2π) out", () => {
    for (let q = 0; q < 65536; q += 3) expect(quantYaw(dequantYaw(q))).toBe(q);
    for (let i = 0; i < 4000; i++) {
      const a = (r() * 2 - 1) * 60, d = dequantYaw(quantYaw(a));
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(TAU);
      expect(Math.abs(wrapAngle(d - a))).toBeLessThanOrEqual(Math.PI / 65536 + 1e-9);
    }
    expect([quantYaw(TAU), quantYaw(-Math.PI / 2), quantYaw(NaN), quantYaw(Infinity), quantYaw(-1e-9)]).toEqual([0, 49152, 0, 0, 0]);
  });
  it("leaf: 0..1.3 in a byte", () => {
    for (let b = 0; b <= 255; b++) expect(quantLeaf(dequantLeaf(b))).toBe(b);
    for (let i = 0; i < 2000; i++) {
      const l = r() * 1.3;
      expect(Math.abs(dequantLeaf(quantLeaf(l)) - l)).toBeLessThanOrEqual(1.3 / 510 + 1e-9);
    }
    expect([quantLeaf(2), quantLeaf(-1), quantLeaf(NaN)]).toEqual([255, 0, 0]);
    expect(dequantLeaf(255)).toBeCloseTo(1.3, 12);
  });
  it("air: 0..1 in a byte", () => {
    for (let b = 0; b <= 255; b++) expect(quantAir(dequantAir(b))).toBe(b);
    for (let i = 0; i < 2000; i++) {
      const a = r();
      expect(Math.abs(dequantAir(quantAir(a)) - a)).toBeLessThanOrEqual(1 / 510 + 1e-9);
    }
    expect([quantAir(1.5), quantAir(-0.2)]).toEqual([255, 0]);
  });
  it("lift: int16 millimetres", () => {
    for (let q = -32768; q <= 32767; q += 5) expect(quantLift(dequantLift(q))).toBe(q);
    for (let i = 0; i < 2000; i++) {
      const u = (r() * 2 - 1) * 30;
      expect(Math.abs(dequantLift(quantLift(u)) - u)).toBeLessThanOrEqual(0.0005 + 1e-9);
    }
    expect([quantLift(40), quantLift(-40)]).toEqual([32767, -32768]);
  });
  it("time: uint32 milliseconds since the room epoch", () => {
    expect([quantTime(-5), quantTime(2 ** 32), quantTime(1234.4), quantTime(1234.5), quantTime(NaN)]).toEqual([0, TIME_MAX, 1234, 1235, 0]);
    const epoch = 1_791_000_000_000;
    expect(roomTime(epoch + 1500.6, epoch)).toBe(1501);
    expect(roomTime(epoch - 20, epoch)).toBe(0);
  });
  it("seq: uint16 serial order across the wrap", () => {
    expect(seqAfter(5, 4)).toBe(true);
    expect(seqAfter(4, 5)).toBe(false);
    expect(seqAfter(0, 65535)).toBe(true);
    expect(seqAfter(65535, 0)).toBe(false);
    expect(seqAfter(7, 7)).toBe(false);
  });
});

describe("pose packet codec", () => {
  const sample = (): Pose => ({
    seq: 7, t: 123_456, x: 12.3412, y: 0.8, z: -20.5, vx: 7.4, vy: -3.2, vz: 0.01, yaw: 2.5, move: moveIndex("Glide"), air: 0.42, leaf: 1.1, lift: 0.35,
    flags: PACKET_FLAG.teleport, ev: [EV.play, "Wave", 12, EV.land, 1.25, 40, EV.ghost, 0, 0],
  });
  it("lays out the §4.2 array", () => {
    expect(POSE_FIELDS).toEqual(["seq", "t", "x", "y", "z", "vx", "vy", "vz", "yaw", "move", "air", "leaf", "lift", "flags"]);
    expect(POSE_LEN).toBe(14);
    expect(encodePose(sample())).toEqual([7, 123456, 1234, 80, -2050, 740, -320, 1, quantYaw(2.5), 3, 107, 216, 350, 128,
      [EV.play, "Wave", 12, EV.land, 125, 40, EV.ghost, 0, 0]]);
  });
  it("round-trips a sample within each field's step, and a packet exactly", () => {
    const s = sample(), pkt = encodePose(s), p = decodePose(pkt);
    expect(p).not.toBeNull();
    const d = p!;
    expect([d.seq, d.t, d.move, d.flags]).toEqual([7, 123456, 3, 128]);
    for (const k of ["x", "y", "z", "vx", "vy", "vz"] as const) expect(Math.abs(d[k] - s[k])).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(Math.abs(wrapAngle(d.yaw - s.yaw))).toBeLessThanOrEqual(Math.PI / 65536 + 1e-9);
    expect(Math.abs(d.air - s.air)).toBeLessThanOrEqual(1 / 510 + 1e-9);
    expect(Math.abs(d.leaf - s.leaf)).toBeLessThanOrEqual(1.3 / 510 + 1e-9);
    expect(Math.abs(d.lift - s.lift)).toBeLessThanOrEqual(0.0005 + 1e-9);
    expect(d.ev).toEqual([EV.play, "Wave", 12, EV.land, 1.25, 40, EV.ghost, 0, 0]);
    expect(encodePose(d)).toEqual(pkt);
  });
  it("writes into the caller's array: no ev element without events, one reused ev list with them", () => {
    const out: PosePacket = [], s = sample();
    expect(encodePose(s, out)).toBe(out);
    const ev = out[14];
    expect(Array.isArray(ev)).toBe(true);
    s.ev.length = 0;
    encodePose(s, out);
    expect(out.length).toBe(POSE_LEN);
    pushEv(s.ev, EV.jump, 0, 3);
    encodePose(s, out);
    expect(out[14]).toBe(ev);
    expect(out[14]).toEqual([EV.jump, 0, 3]);
  });
  it("keeps at most EV_MAX events, drops malformed ones, clamps dtMs", () => {
    const s = createPose();
    expect(pushEv(s.ev, EV.jump, 0, 1)).toBe(true);
    s.ev.push(EV.play, "not a clip!", 2, 99, 0, 3, EV.land, "x", 4, EV.dash, 0, -50, EV.roll, 2, 9999.6);
    for (let i = 0; i < 6; i++) s.ev.push(EV.hop, 0, 5);
    const pkt = encodePose(s);
    expect(pkt[14]).toEqual([EV.jump, 0, 1, EV.dash, 0, 0, EV.roll, 200, EV_DT_MAX_MS, EV.hop, 0, 5]);
    expect((pkt[14] as unknown[]).length).toBe(EV_MAX * 3);
  });
  it("pushEv refuses past EV_MAX", () => {
    const ev: Pose["ev"] = [];
    expect(Array.from({ length: 6 }, () => pushEv(ev, EV.stop, 0, 0))).toEqual([true, true, true, true, false, false]);
    expect(ev.length).toBe(12);
  });
  it("wraps seq, masks unknown packet flags, maps out-of-range moves to none", () => {
    const s = { ...createPose(), seq: 65537, flags: 0xff, move: 42 };
    expect(encodePose(s).slice(0, 14)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128]);
    expect(encodePose({ ...s, seq: -1, move: 2.5 })[0]).toBe(65535);
    expect(encodePose({ ...s, move: 2.5 })[9]).toBe(0);
  });
  it("decodes into a caller-owned pose and leaves it untouched on a reject", () => {
    const out = createPose(), ev = out.ev;
    expect(decodePose(encodePose(sample()), out)).toBe(out);
    expect(out.ev).toBe(ev);
    expect(out.x).toBeCloseTo(12.34, 9);
    const before = { ...out, ev: [...out.ev] };
    expect(decodePose([...encodePose(sample()).slice(0, 13), 3], out)).toBeNull();
    expect({ ...out, ev: [...out.ev] }).toEqual(before);
    expect(decodePose(encodePose({ ...sample(), ev: [] }), out)!.ev).toEqual([]);
  });
});

describe("decodePose rejects", () => {
  const good = (): unknown[] => {
    const p = encodePose({ ...createPose(), seq: 1, t: 1000, x: 1, move: 1, ev: [EV.play, "Wave", 5, EV.land, 0.5, 10] });
    return [...p.slice(0, POSE_LEN), [...(p[POSE_LEN] as unknown[])]];
  };
  const swap = (i: number, v: unknown) => { const p = good(); p[i] = v; return p; };
  const swapEv = (ev: unknown[]) => swap(POSE_LEN, ev);
  it("a good packet (control)", () => expect(decodePose(good())).not.toBeNull());
  it("non-arrays and wrong lengths", () => {
    for (const x of [null, undefined, 3, "p", {}, { length: 14 }]) expect(decodePose(x)).toBeNull();
    expect(decodePose(good().slice(0, 13))).toBeNull();
    expect(decodePose([...good(), 0])).toBeNull();
    expect(decodePose([])).toBeNull();
  });
  it("NaN, Infinity and fractions anywhere", () => {
    for (let i = 0; i < POSE_LEN; i++) for (const v of [NaN, Infinity, -Infinity, 0.5]) expect(decodePose(swap(i, v))).toBeNull();
  });
  it("wrong types", () => {
    for (let i = 0; i < POSE_LEN; i++) for (const v of ["1", null, true, [1], {}]) expect(decodePose(swap(i, v))).toBeNull();
    for (const v of ["ev", 3, {}, null]) expect(decodePose(swapEv(v as never))).toBeNull();
  });
  it("out-of-range values and enums", () => {
    const cases: [number, number][] = [[0, 65536], [0, -1], [1, -1], [1, 2 ** 32], [2, 32768], [3, -32769], [5, 4001], [7, -4001], [8, 65536], [8, -1],
      [9, MOVE_CLIPS.length], [9, -1], [10, 256], [11, 256], [11, -1], [12, 32768], [13, 1], [13, 64], [13, 256]];
    for (const [i, v] of cases) expect(decodePose(swap(i, v)), `${POSE_FIELDS[i]} = ${v}`).toBeNull();
    expect(decodePose(swap(13, 128))).not.toBeNull();
  });
  it("a bad ev list", () => {
    const bad: unknown[][] = [
      [], [EV.jump, 0], [EV.jump, 0, 1, 2],
      Array.from({ length: 5 }, () => [EV.hop, 0, 1]).flat(), // five events
      [EV_KINDS.length, 0, 0], [-1, 0, 0], [1.5, 0, 0], ["play", "Wave", 0],
      [EV.play, 3, 0], [EV.upper, "", 0], [EV.play, "Wave!", 0], [EV.play, "W".repeat(49), 0], [EV.play, "9Lives", 0],
      [EV.land, "x", 0], [EV.land, 0.5, 0], [EV.land, 40000, 0], [EV.land, NaN, 0],
      [EV.jump, 0, -1], [EV.jump, 0, EV_DT_MAX_MS + 1], [EV.jump, 0, 1.5], [EV.jump, 0, "1"],
    ];
    for (const ev of bad) expect(decodePose(swapEv(ev)), JSON.stringify(ev)).toBeNull();
  });
});

describe("slow state `s`", () => {
  it("accepts any non-empty subset of the known fields and copies only them", () => {
    expect(parseSlowState({ area: AREAS.indexOf("cafe") })).toEqual({ area: 1 });
    const full = { area: 0, held: "rod:rod-2", weapon: "sword-driftwood", pose: "Sit", seat: "study:plaza-picnic#2", study: 2, studyEnds: 1_500_000, showClass: false, afk: true };
    expect(parseSlowState(full)).toEqual(full);
    expect(parseSlowState({ held: "", weapon: "", pose: "", seat: "" })).toEqual({ held: "", weapon: "", pose: "", seat: "" });
    expect(parseSlowState(full)).not.toBe(full);
  });
  it("rejects anything else", () => {
    const bad: unknown[] = [null, undefined, 3, "s", [], [0], {},
      { area: AREAS.length }, { area: -1 }, { area: 1.5 }, { area: "cafe" },
      { held: "sword" }, { held: "rod:" }, { held: "glider:x" }, { held: 3 },
      { weapon: "a b" }, { weapon: "k".repeat(65) }, { pose: "1Sit" }, { pose: "S".repeat(49) }, { seat: "a b" }, { seat: "s".repeat(65) },
      { study: STUDY_STATES.length }, { study: -1 }, { studyEnds: -1 }, { studyEnds: 2 ** 32 }, { studyEnds: 1.5 },
      { showClass: 1 }, { afk: "yes" }, { area: 0, extra: 1 }, { toString: 1 },
    ];
    for (const s of bad) expect(parseSlowState(s), JSON.stringify(s)).toBeNull();
  });
});

describe("other messages", () => {
  it("ping [clientMs] and pong [clientMs, serverMs]", () => {
    expect(parsePing([1234.5])).toBe(1234.5);
    for (const x of [[], [NaN], [-1], ["1"], [1, 2], { 0: 1 }, null]) expect(parsePing(x)).toBeNull();
    expect(parsePong([12, 1_791_000_000_000])).toEqual({ client: 12, server: 1_791_000_000_000 });
    for (const x of [[1], [1, Infinity], [1, "2"], [1, 2, 3], null]) expect(parsePong(x)).toBeNull();
  });
  it("sys {kind, text}", () => {
    expect(parseSys({ kind: "restart", text: "" })).toEqual({ kind: "restart", text: "" });
    expect(parseSys({ kind: "notice", text: "Please keep it friendly." })).toEqual({ kind: "notice", text: "Please keep it friendly." });
    for (const x of [{ kind: "party", text: "" }, { kind: "notice" }, { kind: "notice", text: "x".repeat(SYS_TEXT_MAX + 1) }, { kind: "notice", text: "", x: 1 }, null, []])
      expect(parseSys(x)).toBeNull();
  });
  it("e [sid, t, kind, value]: lengths in centimetres on the wire, units decoded", () => {
    const wire = encodeEvent({ sid: 3, t: 5000.4, kind: EV.land, value: 1.23 });
    expect(wire).toEqual([3, 5000, EV.land, 123]);
    expect(decodeEvent(wire)).toEqual({ sid: 3, t: 5000, kind: EV.land, value: 1.23 });
    expect(decodeEvent(encodeEvent({ sid: 0, t: 0, kind: EV.upper, value: "CastForward_Staff" }))).toEqual({ sid: 0, t: 0, kind: EV.upper, value: "CastForward_Staff" });
    const out: (number | string)[] = [];
    expect(encodeEvent({ sid: 1, t: 1, kind: EV.stop, value: 0 }, out)).toBe(out);
    expect(encodeEvent({ sid: 1, t: 1, kind: EV.play, value: 3 })).toBeNull();
    expect(encodeEvent({ sid: 1, t: 1, kind: EV.land, value: "x" })).toBeNull();
    expect(encodeEvent({ sid: 1, t: 1, kind: EV_KINDS.length, value: 0 })).toBeNull();
    for (const x of [[65536, 0, 0, 0], [0, -1, 0, 0], [0, 0, EV_KINDS.length, 0], [0, 0, EV.play, 1], [0, 0, EV.land, "x"], [0, 0, EV.land, 0.5], [0, 0, 0], null])
      expect(decodeEvent(x), JSON.stringify(x)).toBeNull();
  });
  it("join options", () => {
    expect(parseJoinOptions({ v: PROTOCOL, area: 1, mobile: true, showClass: false })).toEqual({ v: PROTOCOL, area: 1, mobile: true, showClass: false });
    expect(parseJoinOptions({ v: 99, area: 0 })).toEqual({ v: 99, area: 0, mobile: false, showClass: true });
    for (const x of [null, {}, { v: 1.5, area: 0 }, { v: PROTOCOL, area: 8 }, { v: PROTOCOL, area: 0, mobile: "yes" }, { v: PROTOCOL }])
      expect(parseJoinOptions(x), JSON.stringify(x)).toBeNull();
  });
});

describe("join refusals and close codes", () => {
  it("codes", () => {
    expect(CLOSE).toEqual({ auth: 4001, removed: 4002, kicked: 4003, replaced: 4004, version: 4006, busy: 4007, restart: 4010 });
    expect(HTTP_REFUSAL).toEqual({ auth: 401, origin: 403 });
  });
  it("one table for the HTTP and WebSocket refusals and the in-game closes", () => {
    const table = [401, 403, 4001, 4002, 4003, 4004, 4006, 4007, 4010].map(c => [c, joinRefusal(c).kind, joinRefusal(c).retry]);
    expect(table).toEqual([
      [401, "auth", "token-once"], [403, "origin", "never"], [4001, "auth", "token-once"], [4002, "removed", "never"], [4003, "kicked", "never"],
      [4004, "replaced", "never"], [4006, "version", "never"], [4007, "busy", "backoff"], [4010, "restart", "jitter"],
    ]);
  });
  it("anything else is a dropped connection: back off and rejoin", () => {
    for (const c of [1000, 1001, 1006, 4005, 4999, 500, 503, 0, NaN]) expect(joinRefusal(c)).toEqual({ kind: "unknown", retry: "backoff" });
  });
  it("backoff and jitter", () => {
    expect(REJOIN_BACKOFF_S).toEqual([2, 4, 8, 16, 30]);
    expect(RESTART_JITTER_MS).toBe(3000);
  });
});

describe("schema", () => {
  it("NET_PLAYER_FIELDS: §4.1 in order (the server's schema test matches it exactly), with `seat`", () => {
    expect(NET_PLAYER_FIELDS.map(([n, t]) => `${n}:${t}`).join(" ")).toBe(
      "sid:uint16 uid:string name:string badge:uint8 look:string level:uint8 family:uint8 kit:string mastery:uint8 aura:string frame:uint8 "
      + "area:uint8 flags:uint8 held:string weapon:string pose:string seat:string study:uint8 studyEnds:uint32 "
      + "t:uint32 x:int16 y:int16 z:int16 vx:int16 vy:int16 vz:int16 yaw:uint16 move:uint8 air:uint8 leaf:uint8 lift:int16");
    expect(NET_ROSTER_FIELDS.map(([n, t]) => `${n}:${t}`).join(" ")).toBe("uid:string name:string badge:uint8 area:uint8 flags:uint8");
    // The motion fields carry the pose packet's names, so the server copies a decoded packet's integers straight in.
    const names = NET_PLAYER_FIELDS.map(([n]) => n as string);
    for (const f of POSE_FIELDS.slice(1, 13)) expect(names).toContain(f);
  });
  it("the plain interfaces have exactly those fields and types", () => {
    type Fields<L extends readonly (readonly [string, string])[]> = { [E in L[number] as E[0]]: E[1] extends "string" ? string : number };
    expectTypeOf<NetPlayer>().toEqualTypeOf<Fields<typeof NET_PLAYER_FIELDS>>();
    expectTypeOf<RosterEntry>().toEqualTypeOf<Fields<typeof NET_ROSTER_FIELDS>>();
  });
});

describe("limits", () => {
  it("rates, interest, interpolation, shards, reconnection, chat (§4.3, §4.4, §4.6, §5.3, §3, §6)", () => {
    expect(SEND).toEqual({ groundHz: 10, moveHz: 15, eventGapMs: 30 });
    expect(PATCH_RATE_MS).toBe(50);
    expect(INTEREST).toEqual({ radiusIn: 50, radiusOut: 60, rebuildMs: 500 });
    expect(INTERP_DELAY_MS).toEqual({ min: 120, max: 300, initial: 200 });
    expect(SHARD).toEqual({ lock: 30, unlock: 26, max: 40 });
    expect(RECONNECT_GRACE_S).toEqual({ desktop: 20, phone: 120 });
    expect(RATE_LIMITS).toEqual({ p: { perSecond: 20, burst: 30 }, s: { perSecond: 5 }, area: { perSecond: 3, perMinute: 30 }, events: { perSecond: 8 },
      emotes: { perSecond: 1, perMinute: 20 }, refresh: { everyMs: 10_000 }, ping: { perSecond: 2 }, maxMessagesPerSecond: 60 });
    expect(CHAT).toMatchObject({ maxLength: 200, perMinute: 6, perHour: 60, gapMs: 1500, repeatMs: 30_000 });
    expect(CLOCK).toEqual({ burst: 5, burstGapMs: 200, everyMs: 15_000, window: 16, best: 5, applyOverMs: 100 });
  });
  it("sanity numbers (§4.5)", () => {
    expect(SANITY).toEqual({ dtMinMs: 20, dtMaxMs: 2000, speed: 32, speedAvg: 26, speedAvgWindowMs: 1000, rise: 12, fall: 22,
      teleportDist: 6, teleportWindowMs: 300, teleportGapMs: 2000, teleportPerMinute: 15, strikeDecayMs: 10_000, strikeKick: 10 });
    expect(AREA_BOUNDS.village).toEqual({ half: 40, yMin: -3, yMax: 25 });
    for (const a of ["cafe", "hq", "museum", "oracle", "house"] as const) expect(AREA_BOUNDS[a]).toEqual({ half: 20, yMin: -3, yMax: 25 });
    for (const a of ["ruins", "home"] as const) expect(AREA_BOUNDS[a]).toEqual(AREA_BOUNDS.village);
    expect([inAreaBounds("village", 40, 25, -40), inAreaBounds("village", 40.01, 0, 0), inAreaBounds("village", 0, -3.01, 0), inAreaBounds("cafe", 0, 0, 20.5)])
      .toEqual([true, false, false, false]);
  });
  it("the bounds hold the shipped worlds: the village's land plus a glide out to sea, and the ruins map", () => {
    // A glide off the coast flies about 12 tiles (MOVE_TUNING's glider notes; the farthest found on the shipped map is 8.2).
    // If David paints the land past ±28 this fails: widen the village bound before players get struck for gliding.
    const b = village().bounds;
    expect(Math.max(-b.minX, b.maxX, -b.minZ, b.maxZ) + 12).toBeLessThanOrEqual(AREA_BOUNDS.village.half);
    const { map } = createRuins();
    const reach = Math.max(Math.abs(map.originX - 0.5), Math.abs(map.originX + map.width - 0.5), Math.abs(map.originZ - 0.5), Math.abs(map.originZ + map.depth - 0.5));
    expect(reach).toBeLessThanOrEqual(AREA_BOUNDS.ruins.half);
  });
});

describe("the sanity caps follow the movement kit", () => {
  it("NET_MOVE is MOVE_TUNING's (and sim.ts's steepest slope, 1.6)", () => {
    for (const k of ["dashSpeed", "momentumCeiling", "downhillCeiling", "jumpHeight", "jumpApexTime", "maxFallSpeed"] as const) expect(NET_MOVE[k], k).toBe(MOVE_TUNING[k]);
    const plane = (g: number): MoveWorld => ({ top: x => g * x, wet: () => false });
    expect(slopeAt(plane(1.59), 0, 0)[0]).toBeCloseTo(1.59, 9);
    expect(slopeAt(plane(1.61), 0, 0)[0]).toBe(0);
    expect(NET_MOVE.maxGrade).toBe(1.6);
  });
  it("the caps are the kit's limits with 20% slack, rounded up; the 1 s average has none", () => {
    const t = MOVE_TUNING, sine = 1.6 / Math.hypot(1, 1.6);
    const top = Math.max(t.dashSpeed, t.momentumCeiling + t.downhillCeiling * sine), rise = (2 * t.jumpHeight) / t.jumpApexTime;
    expect(SANITY.speed).toBe(Math.ceil(top * 1.2));
    expect(SANITY.speedAvg).toBe(Math.floor(top));
    expect(SANITY.rise).toBe(Math.ceil(rise * 1.2));
    expect(SANITY.fall).toBe(Math.ceil(t.maxFallSpeed * 1.2));
    for (const s of [t.walkSpeed, t.sprintSpeed, t.dashSpeed, t.momentumCeiling, t.glideSpeed]) expect(s).toBeLessThan(SANITY.speedAvg);
    // No speed a sample can carry is beyond the wire's ±40 u/s.
    expect(SANITY.speed).toBeLessThan(40);
  });
  it("stepMove at its extremes stays inside them, sampled as the sender may (events 30 ms apart, the ground rate after a mantle)", () => {
    const run = (w: MoveWorld, s0: MoveState, input: (i: number, s: MoveState) => MoveInput, steps: number) => {
      const trace = [s0];
      for (let i = 0; i < steps; i++) trace.push(stepMove(trace[i], input(i, trace[i]), STEP, w));
      return trace;
    };
    const rates = (trace: MoveState[], ms: number) => {
      const n = Math.ceil(ms / 1000 / STEP), dt = n * STEP, avgN = Math.round(1 / STEP);
      let speed = 0, rise = 0, fall = 0, avg = 0;
      for (let i = n; i < trace.length; i++) {
        const a = trace[i - n], b = trace[i];
        speed = Math.max(speed, Math.hypot(b.x - a.x, b.z - a.z) / dt);
        rise = Math.max(rise, (b.y - a.y) / dt);
        fall = Math.max(fall, (a.y - b.y) / dt);
      }
      for (let i = avgN; i < trace.length; i++) avg = Math.max(avg, Math.hypot(trace[i].x - trace[i - avgN].x, trace[i].z - trace[i - avgN].z));
      return { speed, rise, fall, avg };
    };
    const within = (r: ReturnType<typeof rates>) => {
      expect(r.speed).toBeLessThanOrEqual(SANITY.speed);
      expect(r.avg).toBeLessThanOrEqual(SANITY.speedAvg);
      expect(r.rise).toBeLessThanOrEqual(SANITY.rise);
      expect(r.fall).toBeLessThanOrEqual(SANITY.fall);
    };
    const go = (o: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...o });
    const flat: MoveWorld = { top: () => 0, wet: () => false };
    // Tech on flat ground: sprint, dash every half second, slides, held hops.
    within(rates(run(flat, createMoveState(0, 0, flat), i => go({ x: 1, sprint: true, dashPressed: i % 60 === 0, sneak: i % 120 > 60, jump: i % 90 > 80, jumpPressed: i % 90 === 81 }), 1200), SEND.eventGapMs));
    // A slide down the steepest ground the grid sustains (one 0.75 level per cell): 24 u/s along, 18 u/s down.
    const hill: MoveWorld = { top: x => 200 - 0.75 * x, wet: () => false };
    const slide = rates(run(hill, createMoveState(0, 0, hill), i => go({ x: 1, sprint: true, sneak: i > 60, dashPressed: i === 50 }), 900), SEND.eventGapMs);
    within(slide);
    expect(slide.avg).toBeGreaterThan(20); // the case really is the fast one
    // A fall from 20 u, and a jump.
    const ledge: MoveWorld = { top: x => (x < 1 ? 20 : 0), wet: () => false };
    within(rates(run(ledge, createMoveState(0, 0, ledge), () => go({ x: 1 }), 600), SEND.eventGapMs));
    within(rates(run(flat, createMoveState(0, 0, flat), i => go({ jump: true, jumpPressed: i === 0 }), 120), SEND.eventGapMs));
    // A full-height mantle: a jump beside a 2.4 u wall catches the lip near the apex and climbs ~1.15 u. Its event sends the
    // grab, and the next sample comes a ground interval later (a mantle sets no move clip).
    const wall: MoveWorld = { top: x => (x > 0.5 ? 2.4 : 0), wet: () => false };
    const mantle = run(wall, createMoveState(0.25, 0, wall), i => go({ x: 1, jump: i < 60, jumpPressed: i === 0 }), 240);
    const grab = mantle.find(s => s.mode === "mantle");
    expect(grab && grab.to[1] - grab.from[1]).toBeGreaterThan(1);
    within(rates(mantle, 1000 / SEND.groundHz));
  });
});

describe("world clock offset (§4.7)", () => {
  it("median offset of the 5 lowest-RTT samples among the last 16", () => {
    const offset = 1234.5, r = rng(11);
    const samples: ClockSample[] = [];
    let now = 50_000;
    for (let i = 0; i < 40; i++) {
      const up = 15 + r() * 120, down = 15 + r() * 120;
      samples.push({ sent: now, received: now + up + down, server: now + up + offset });
      now += 200 + r() * 15_000;
    }
    const est = estimateClockOffset(samples);
    expect(est).not.toBeNull();
    expect(Math.abs(est! - offset)).toBeLessThan(20);
  });
  it("is exact on symmetric paths, and ignores samples older than the window", () => {
    const at = (sent: number, rtt: number, off: number): ClockSample => ({ sent, received: sent + rtt, server: sent + rtt / 2 + off });
    const old = Array.from({ length: 10 }, (_, i) => at(i * 100, 1, -9999)); // fast but stale
    const fresh = Array.from({ length: CLOCK.window }, (_, i) => at(10_000 + i * 100, 40 + i, 500));
    expect(estimateClockOffset([...old, ...fresh])).toBe(500);
  });
  it("takes the median of the best, so one lucky outlier doesn't move it", () => {
    const s = (rtt: number, off: number): ClockSample => ({ sent: 0, received: rtt, server: rtt / 2 + off });
    expect(estimateClockOffset([s(10, 100), s(11, 102), s(12, 104), s(13, 900), s(14, 106), s(80, 0), s(90, 0)])).toBe(104);
    expect(estimateClockOffset([s(10, 100), s(20, 110)])).toBe(105);
    expect(estimateClockOffset([s(10, 100)])).toBe(100);
  });
  it("skips broken samples; none gives null", () => {
    expect(estimateClockOffset([])).toBeNull();
    expect(estimateClockOffset([{ sent: 10, received: 5, server: 0 }, { sent: NaN, received: 1, server: 1 }])).toBeNull();
  });
});
