import { describe, expect, it } from "vitest";
import { cardinalOffset, compassDegrees, forwardAzimuth } from "./compassHeading";

describe("compass and minimap agreement", () => {
  it.each([
    { x: 0, z: 1, degrees: 0, direction: "north" }, { x: 1, z: 0, degrees: 90, direction: "east" },
    { x: 0, z: -1, degrees: 180, direction: "south" }, { x: -1, z: 0, degrees: 270, direction: "west" },
  ])("maps camera forward ($x, $z) to $degrees degrees ($direction)", ({ x, z, degrees }) => {
    expect(compassDegrees(forwardAzimuth(x, z)!)).toBeCloseTo(degrees);
    expect(cardinalOffset(degrees, compassDegrees(forwardAzimuth(x, z)!)!)).toBe(0);
  });

  it("ignores vertical or invalid camera vectors instead of inventing a heading", () => {
    expect(forwardAzimuth(0, 0)).toBeNull(); expect(forwardAzimuth(1e-9, -1e-9)).toBeNull();
    expect(forwardAzimuth(NaN, 1)).toBeNull(); expect(forwardAzimuth(1, Infinity)).toBeNull();
    expect(compassDegrees(NaN)).toBeNull(); expect(compassDegrees(Infinity)).toBeNull();
  });

  it("normalizes negative headings and multiple revolutions", () => {
    expect(compassDegrees(-Math.PI / 2)).toBeCloseTo(270);
    expect(compassDegrees(-Math.PI * 4 - Math.PI / 2)).toBeCloseTo(270);
    expect(compassDegrees(Math.PI * 4 + Math.PI / 2)).toBeCloseTo(90);
  });

  it("keeps north close to the center through the 360-degree seam", () => {
    expect(cardinalOffset(0, 359)).toBe(1);
    expect(cardinalOffset(0, 1)).toBe(-1);
    expect(cardinalOffset(270, -90)).toBe(0);
    expect(cardinalOffset(90, 450)).toBe(0);
  });
});
