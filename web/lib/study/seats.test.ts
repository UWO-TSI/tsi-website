import { describe, expect, it } from "vitest";
import { DEFAULT_TABLES } from "./tables";
import { STUDY_LAYOUT, WALK_AWAY_RADIUS, nearestSeat, seatAt, seatsOf, studySolid, walkedAway } from "./seats";

describe("seat anchors (study-world §1)", () => {
  it("maps every backend table anchor to exactly its seat count, and nothing else", () => {
    for (const t of DEFAULT_TABLES) expect(seatsOf(t.anchor).map(s => s.seat), t.anchor).toEqual(Array.from({ length: t.seats }, (_, i) => i + 1));
    expect(STUDY_LAYOUT.map(l => l.anchor).sort()).toEqual(DEFAULT_TABLES.map(t => t.anchor).sort());
    expect(seatsOf("study:nowhere")).toEqual([]);
    expect(seatAt("study:cafe-four-1", 5)).toBeNull();
  });

  it("puts cafe tables in the cafe and outdoor tables in the village", () => {
    for (const t of DEFAULT_TABLES) expect(STUDY_LAYOUT.find(l => l.anchor === t.anchor)!.area).toBe(t.location === "cafe" ? "cafe" : "village");
  });

  it("keeps every seat standable, inside the room and apart from its neighbours", () => {
    for (const l of STUDY_LAYOUT) for (const s of seatsOf(l.anchor)) {
      expect(studySolid(l.area, s.x, s.z, 0.2), `${s.anchor}#${s.seat}`).toBe(false);
      if (l.area === "cafe") expect(Math.abs(s.x) < 8.2 && Math.abs(s.z) < 5.2).toBe(true);
    }
    for (const area of ["cafe", "village"] as const) {
      const all = STUDY_LAYOUT.filter(l => l.area === area).flatMap(l => seatsOf(l.anchor));
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

describe("walk-away detection (row 80)", () => {
  const seat = seatAt("study:cafe-four-1", 1)!;
  it("ends only once you are past the radius", () => {
    expect(walkedAway(seat, seat.x, seat.z)).toBe(false);
    expect(walkedAway(seat, seat.x + WALK_AWAY_RADIUS - 0.05, seat.z)).toBe(false);
    expect(walkedAway(seat, seat.x, seat.z - WALK_AWAY_RADIUS - 0.05)).toBe(true);
  });
});
