import { describe, expect, it } from "vitest";
import { STOOLS, STOOL_RANGE, STOOL_TOP, STOOL_Z, barPoint, barSeat, seatView, stoolAt, stoolKey, type Bar } from "./sushiBar";
import { isSeatKey } from "@/lib/net/protocol";

const bar: Bar = { id: "sushi-bar", x: 40, z: 100, yaw: Math.PI / 2 };

describe("sushi bar", () => {
  it("turns its frame as the props are drawn (three's rotation about +y)", () => {
    // yaw π/2 turns local +z (the guests' side) to world +x, local +x to world -z.
    expect(barPoint(bar, 0, 1).map(v => +v.toFixed(6))).toEqual([41, 100]);
    expect(barPoint(bar, 1, 0).map(v => +v.toFixed(6))).toEqual([40, 99]);
  });

  it("seats you on the nearest free stool, facing the window, with a network claim key", () => {
    const [sx, sz] = barPoint(bar, STOOLS[2], STOOL_Z);
    const seat = barSeat(bar, sx + 0.3, sz + 0.1)!;
    expect(seat).toMatchObject({ key: stoolKey(bar, 2), top: STOOL_TOP });
    expect(seat.x).toBeCloseTo(sx); expect(seat.z).toBeCloseTo(sz);
    // Facing local -z: the window and the sea (world -x here).
    expect(Math.sin(seat.yaw)).toBeCloseTo(-1);
    expect(isSeatKey(seat.key)).toBe(true);
  });

  it("skips a stool someone holds and offers none out of reach", () => {
    const [sx, sz] = barPoint(bar, STOOLS[2], STOOL_Z);
    expect(barSeat(bar, sx, sz, key => key === stoolKey(bar, 2))?.key).not.toBe(stoolKey(bar, 2));
    expect(barSeat(bar, sx + STOOL_RANGE + 1.2, sz)).toBeNull();
  });

  it("knows the stool a seated player is on", () => {
    const [sx, sz] = barPoint(bar, STOOLS[4], STOOL_Z);
    expect(stoolAt(bar, sx, sz)).toBe(4);
    expect(stoolAt(bar, sx + 0.5, sz)).toBe(-1);
  });

  it("frames the seated view low and close, behind the stool, looking across the counter to the window", () => {
    const { eye, look } = seatView(STOOLS[0]);
    expect(eye[2]).toBeGreaterThan(STOOL_Z);
    expect(eye[1]).toBeLessThan(2);
    expect(look[2]).toBeLessThan(-1.5);
  });
});
