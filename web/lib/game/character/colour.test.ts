import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, wheelPick, wheelPoint } from "./colour";

describe("the hair colour wheel's maths (head-v10, row 311)", () => {
  it("round-trips sRGB hex through hue, saturation and value", () => {
    for (const hex of ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#6B3A22", "#F0A3B5", "#8A8F99", "#2B211C", "#33CC99"])
      expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
  });
  it("reads the primaries and greys", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00FF00")).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv("#0000FF")).toEqual({ h: 240, s: 1, v: 1 });
    expect(hexToHsv("#808080")).toMatchObject({ s: 0 });
    expect(hsvToHex({ h: 60, s: 1, v: 1 })).toBe("#FFFF00");
    expect(hsvToHex({ h: 300, s: 0, v: 0.5 })).toBe("#808080");
  });
  it("keeps a grey's hue when asked (dragging the value down to black must not lose the hue)", () => {
    expect(hexToHsv("#000000", 200).h).toBe(200);
    expect(hexToHsv("#777777", 33).h).toBe(33);
  });
  it("places hue clockwise from the right and saturation out from the centre, and picks it back", () => {
    expect(wheelPoint(0, 1)).toEqual({ x: 1, y: 0 });
    const p = wheelPoint(90, 1);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(1, 9);                    // screen y grows downward: 90 deg clockwise is straight down
    for (const [h, s] of [[0, 0.5], [45, 1], [200, 0.25], [359, 0.9]]) {
      const q = wheelPoint(h, s), back = wheelPick(q.x, q.y);
      expect(back.h).toBeCloseTo(h, 6);
      expect(back.s).toBeCloseTo(s, 6);
    }
    expect(wheelPick(3, 4).s).toBe(1);                // outside the disc: its rim
    expect(wheelPick(0, 0)).toEqual({ h: 0, s: 0 });
  });
});
