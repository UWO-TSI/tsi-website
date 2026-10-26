import { describe, expect, it } from "vitest";
import { CHEF_LOOP, CHEF_STATIONS, ENTRY, ENTRY_RANGE, PIECES, SERVER, STOOLS, STOOL_TOP, STOOL_Z, barOpen, barPoint, barSeat, prepAt, seatView, servedAt, stoolAt, stoolKey, type Bar } from "./sushiBar";
import { ownerAt } from "./cafe";
import { isSeatKey } from "@/lib/net/protocol";

const bar: Bar = { id: "sushi-bar", x: 40, z: 100, yaw: Math.PI / 2 };
const [ex, ez] = barPoint(bar, ...ENTRY);

describe("sushi bar", () => {
  it("turns its frame as the props are drawn (three's rotation about +y)", () => {
    // yaw π/2 turns local +z (the guests' side) to world +x, local +x to world -z.
    expect(barPoint(bar, 0, 1).map(v => +v.toFixed(6))).toEqual([41, 100]);
    expect(barPoint(bar, 1, 0).map(v => +v.toFixed(6))).toEqual([40, 99]);
  });

  it("is open in the evening and at night, closed by day", () => {
    expect([barOpen("dawn"), barOpen("day"), barOpen("evening"), barOpen("night")]).toEqual([false, false, true, true]);
  });

  it("takes you in from the entrance while it's open, to a stool facing the window, first person, with a network claim key", () => {
    const seat = barSeat(bar, ex + 0.4, ez, true)!;
    const [sx, sz] = barPoint(bar, STOOLS[2], STOOL_Z);
    expect(seat).toMatchObject({ key: stoolKey(bar, 2), top: STOOL_TOP, hide: true });
    expect(seat.x).toBeCloseTo(sx); expect(seat.z).toBeCloseTo(sz);
    // Facing local -z: the window and the sea (world -x here).
    expect(Math.sin(seat.yaw)).toBeCloseTo(-1);
    expect(isSeatKey(seat.key)).toBe(true);
    // Getting up puts you back out on the landing, facing out.
    expect(Math.hypot(seat.exit.x - ex, seat.exit.z - ez)).toBeLessThan(ENTRY_RANGE);
    expect(Math.sin(seat.exit.yaw)).toBeCloseTo(1);
  });

  it("seats friends side by side, from the middle outward, and none past six or while it's closed or out of reach", () => {
    const held = new Set<string>();
    const order = STOOLS.map(() => { const s = barSeat(bar, ex, ez, true, k => held.has(k))!; held.add(s.key); return STOOLS.findIndex((_, i) => stoolKey(bar, i) === s.key); });
    expect(order).toEqual([2, 3, 1, 4, 0, 5]);
    for (let n = 1; n <= 6; n++) { const taken = order.slice(0, n).sort(); expect(taken[taken.length - 1] - taken[0]).toBe(n - 1); }
    expect(barSeat(bar, ex, ez, true, k => held.has(k))).toBeNull();
    expect(barSeat(bar, ex, ez, false)).toBeNull();
    expect(barSeat(bar, ex + ENTRY_RANGE + 0.5, ez, true)).toBeNull();
  });

  it("gets you up from the stool you're on, open or not", () => {
    const [sx, sz] = barPoint(bar, STOOLS[4], STOOL_Z);
    expect(stoolAt(bar, sx, sz)).toBe(4);
    expect(stoolAt(bar, sx + 0.5, sz)).toBe(-1);
    expect(barSeat(bar, sx, sz, false, () => true)?.key).toBe(stoolKey(bar, 4));
  });

  it("frames the seated view first person: from the stool, a little down across the counter toward the window", () => {
    for (const lx of STOOLS) {
      const { eye, look } = seatView(lx);
      expect(eye[0]).toBe(lx);
      expect(Math.abs(eye[2] - STOOL_Z)).toBeLessThanOrEqual(0.4);
      expect(look[2]).toBeLessThan(-1.5);
      // Down to the chefs' hands on their boards, the sea's horizon still in view.
      const down = (eye[1] - look[1]) / (eye[2] - look[2]);
      expect(down).toBeGreaterThan(0.05); expect(down).toBeLessThan(0.2);
    }
  });

  it("has the chef make each board's four nigiri one by one, and the server take each full geta while the chef is at his other board", () => {
    for (let t = 0; t < 3 * CHEF_LOOP; t += 0.05) {
      const chef = ownerAt(t, CHEF_STATIONS), server = ownerAt(t - SERVER.start, SERVER.stations), s = SERVER.stations[server.station];
      if (!server.moving && s.board !== undefined) {
        expect(prepAt(s.board, t), `the geta is full when he comes for it, t ${t.toFixed(2)}`).not.toBe(0);
        expect(Math.abs(chef.x - server.x), "the chef is at his other board").toBeGreaterThan(1.2);
      }
      if (!server.moving && s.stool !== undefined) expect(Math.abs(chef.x - server.x), "serving clear of the chef").toBeGreaterThan(0.6);
    }
    // Four pieces appear one by one while he shapes, then the geta goes, and a fresh one comes with his next slicing.
    const counts = new Set<number>();
    for (let t = 0; t < CHEF_LOOP; t += 0.1) counts.add(prepAt(0, t));
    expect([...counts].sort()).toEqual([-1, 0, 1, 2, 3, 4]);
    expect(prepAt(0, 0.1)).toBe(0);
  });

  it("times the server's round to the chef's loops, every wait a real one, and serves every stool in turn", () => {
    expect(SERVER.loop).toBeCloseTo(3 * CHEF_LOOP, 6);
    for (const s of SERVER.stations) expect(s.stay).toBeGreaterThanOrEqual(0);
    expect(SERVER.serves.map(s => s.stool).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const shown = STOOLS.map((_, i) => [...Array(400).keys()].some(n => servedAt(i, (n / 400) * SERVER.loop)));
    expect(shown.every(Boolean)).toBe(true);
    expect(PIECES).toBe(4);
  });
});

