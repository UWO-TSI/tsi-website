import { describe, expect, it } from "vitest";
import { AREAS, FLAG, NET_PLAYER_FIELDS, type NetPlayer } from "./protocol";
import { REMOTE_EVENTS, areaHeadcount, createRemoteSample, toRemotePlayer } from "./types";

const player = (over: Partial<NetPlayer> = {}): NetPlayer => ({
  sid: 4, uid: "u-1", name: "Alex", badge: 1, look: "{}", level: 12, family: 2, kit: "marksman", mastery: 6, aura: "mastery:colour", frame: 3,
  area: 1, flags: FLAG.mobile | FLAG.showClass, held: "rod:rod-2", weapon: "", pose: "", seat: "", study: 2, studyEnds: 5000,
  t: 100, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, ...over,
});

describe("toRemotePlayer", () => {
  it("dequantizes the card and slow state", () => {
    const epoch = 1_791_000_000_000;
    expect(toRemotePlayer(player(), epoch)).toEqual({
      sid: 4, uid: "u-1", name: "Alex", member: true, look: "{}", level: 12, family: "Ranger", kit: "marksman", mastery: 6, aura: "mastery:colour", frame: "gold",
      area: "cafe", away: false, afk: false, mobile: true, showClass: true, typing: false, armed: false,
      held: "rod:rod-2", weapon: "", pose: null, seat: "", study: "focus", studyEnds: epoch + 5000,
    });
  });
  it("reads a seat pose, no study end and the empty card as nothing", () => {
    const r = toRemotePlayer(player({ pose: "Sit", studyEnds: 0, study: 0, badge: 0, family: 0, frame: 0, flags: FLAG.away | FLAG.afk | FLAG.typing | FLAG.armed }), 1);
    expect(r).toMatchObject({ pose: "Sit", studyEnds: 0, study: "none", member: false, family: null, frame: null, away: true, afk: true, typing: true, armed: true, mobile: false });
  });
  it("falls back safely on indexes it doesn't know", () => {
    expect(toRemotePlayer(player({ area: 99, family: 99, frame: 99, study: 99, badge: 99 }), 0)).toMatchObject({ area: "village", family: null, frame: null, study: "none", member: false });
  });
  it("covers every schema field but the motion ones", () => {
    const motion = new Set(["t", "x", "y", "z", "vx", "vy", "vz", "yaw", "move", "air", "leaf", "lift", "flags", "badge"]);
    const keys = Object.keys(toRemotePlayer(player(), 0));
    for (const [f] of NET_PLAYER_FIELDS) if (!motion.has(f)) expect(keys).toContain(f);
  });
});

describe("createRemoteSample", () => {
  it("preallocates the event slots", () => {
    const s = createRemoteSample();
    expect(s.events).toHaveLength(REMOTE_EVENTS);
    expect(new Set(s.events).size).toBe(REMOTE_EVENTS);
    expect(s.eventCount).toBe(0);
    expect(s).toMatchObject({ x: 0, y: 0, z: 0, move: null, pose: null, held: "", weapon: "", flags: 0, snapped: false });
    expect(createRemoteSample().events[0]).not.toBe(s.events[0]);
  });
});

describe("areaHeadcount", () => {
  it("counts the roster per area and ignores indexes it doesn't know", () => {
    const counts = areaHeadcount([{ area: 0 }, { area: 0 }, { area: 1 }, { area: 7 }, { area: 42 }]);
    expect(Object.keys(counts)).toEqual([...AREAS]);
    expect(counts).toMatchObject({ village: 2, cafe: 1, house: 1, hq: 0, ruins: 0 });
  });
});
