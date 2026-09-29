import { describe, expect, it } from "vitest";
import { DEFAULT_TABLES } from "./tables";
import { studyLayout, WALK_AWAY_RADIUS, localSeats, nearestSeat, seatAt, seatsOf, studySolid, walkedAway } from "./seats";
import { STUDY_CLIP, poseOf, sitDetail, studyPose } from "./worldStore";
import type { StudyHook } from "./useStudySession";

describe("seat anchors (study-world §1)", () => {
  it("maps every backend table anchor to exactly its seat count, and nothing else", () => {
    for (const t of DEFAULT_TABLES) expect(seatsOf(t.anchor).map(s => s.seat), t.anchor).toEqual(Array.from({ length: t.seats }, (_, i) => i + 1));
    expect(studyLayout().map(l => l.anchor).sort()).toEqual(DEFAULT_TABLES.map(t => t.anchor).sort());
    expect(seatsOf("study:nowhere")).toEqual([]);
    expect(seatAt("study:cafe-four-1", 5)).toBeNull();
  });

  it("puts cafe tables in the cafe and outdoor tables in the village", () => {
    for (const t of DEFAULT_TABLES) expect(studyLayout().find(l => l.anchor === t.anchor)!.area).toBe(t.location === "cafe" ? "cafe" : "village");
  });

  it("keeps every seat standable, inside the room and apart from its neighbours", () => {
    for (const l of studyLayout()) for (const s of seatsOf(l.anchor)) {
      expect(studySolid(l.area, s.x, s.z, 0.2), `${s.anchor}#${s.seat}`).toBe(false);
      if (l.area === "cafe") expect(Math.abs(s.x) < 8.2 && Math.abs(s.z) < 5.2).toBe(true);
    }
    for (const area of ["cafe", "village"] as const) {
      const all = studyLayout().filter(l => l.area === area).flatMap(l => seatsOf(l.anchor));
      for (const a of all) for (const b of all) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.8);
    }
  });

  it("turns seats and facing with the table's yaw", () => {
    const [s1] = seatsOf("study:cafe-two-1");
    expect(s1.facing).toBeCloseTo(-Math.PI / 2); // looks across the table toward -x
    expect(studySolid("cafe", 4.4, -3)).toBe(true); // table centre blocks
  });

  it("offers the nearest free seat in range, skipping taken ones", () => {
    const [a, b] = seatsOf("study:plaza-picnic");
    expect(nearestSeat("village", a.x + 0.1, a.z)).toMatchObject({ anchor: "study:plaza-picnic", seat: 1 });
    const mid = [(a.x + b.x) / 2, a.z] as const;
    expect(nearestSeat("village", mid[0] + 0.05, mid[1], (_, seat) => seat === 1)).toMatchObject({ seat: 2 });
    expect(nearestSeat("cafe", a.x, a.z)?.anchor).not.toBe("study:plaza-picnic");
    expect(nearestSeat("village", b.x, b.z + 3)).toBeNull();
  });
});

describe("localSeats (phone companion table scene, companion.md #2)", () => {
  it("recentres every table's seats on the origin, keeping their spread and facing", () => {
    for (const l of studyLayout()) {
      const world = seatsOf(l.anchor), local = localSeats(l.anchor);
      expect(local.map(s => s.seat)).toEqual(world.map(s => s.seat));
      local.forEach((s, i) => {
        expect(s.x).toBeCloseTo(world[i].x - l.at[0]);
        expect(s.z).toBeCloseTo(world[i].z - l.at[1]);
        expect(s.y).toBe(world[i].y); // seat height doesn't move, only x/z
        expect(s.facing).toBe(world[i].facing);
      });
    }
  });
  it("is empty for an unknown anchor", () => {
    expect(localSeats("study:nowhere")).toEqual([]);
  });
});

describe("walk-away detection (row 80)", () => {
  const seat = seatAt("study:cafe-four-1", 1)!;
  it("ends only once you are past the radius", () => {
    expect(walkedAway(seat, seat.x, seat.z)).toBe(false);
    expect(walkedAway(seat, seat.x + WALK_AWAY_RADIUS - 0.05, seat.z)).toBe(false);
    expect(walkedAway(seat, seat.x, seat.z - WALK_AWAY_RADIUS - 0.05)).toBe(true);
  });
});

describe("seat heights and study clips (study × character)", () => {
  it("puts each seat top at the floor plus its furniture's measured seat", () => {
    expect(seatAt("study:cafe-four-1", 1)!.y).toBeCloseTo(0.52);
    expect(seatAt("study:cafe-couch", 2)!.y).toBeCloseTo(0.78);
    const slope = (x: number, z: number) => 0.1 * x + 0.05 * z;
    const s = seatAt("study:plaza-picnic", 3, slope)!;
    expect(s.y).toBeCloseTo(slope(s.x, s.z) + 0.5);
    expect(nearestSeat("village", s.x, s.z, undefined, slope)?.y).toBeCloseTo(s.y);
  });
  it("studies in focus, stretches on a break and sits otherwise, at the seat's top and facing", () => {
    expect((["focus", "break", "seated", "ended", null] as const).map(p => STUDY_CLIP[poseOf(p)])).toEqual(["Study", "Stretch", "Sit", "Sit", "Sit"]);
    const seat = seatAt("study:cafe-two-1", 1)!;
    expect(sitDetail(seat, "focus")).toEqual({ x: seat.x, z: seat.z, clip: "Study", seatY: 0.52, yaw: -Math.PI / 2 });
    const onBreak = { session: { phase: "break" } } as unknown as StudyHook;
    expect(studyPose({ study: onBreak, near: null, seated: seat })).toEqual({ pose: "stretch", seat });
    expect(studyPose({ study: onBreak, near: null, seated: null })).toBeNull();
  });
});
