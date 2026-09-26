import { expect, it } from "vitest";
import { constrainClubhouse } from "./clubhouse";

it("keeps a wide direct route from entry to the centered board", () => {
  for (const x of [-1, 0, 1]) {
    expect(constrainClubhouse(x, -4.2, x, 4.3)).toEqual([expect.closeTo(x, 5), expect.closeTo(4.3, 5)]);
  }
  expect(constrainClubhouse(0, -2.4, -6, -2.4)[0]).toBeGreaterThan(-3.9);
});

it("allows approaching the clock while blocking its footprint", () => {
  expect(constrainClubhouse(-7, 4.1, -7, 4.6)[1]).toBeCloseTo(4.6);
  expect(constrainClubhouse(-7, 4.5, -7, 5.8)[1]).toBeLessThan(5);
  expect(constrainClubhouse(0, 2, -6.1, 2)).toEqual([expect.closeTo(-6.1, 5), expect.closeTo(2, 5)]);
  expect(constrainClubhouse(-6.1, 2, -6.1, 4.3)[1]).toBeCloseTo(4.3);
});

it("keeps the lounge solid with open routes to the bookshelf and seats", () => {
  expect(constrainClubhouse(2, 2.85, 4.85, 2.85)[0]).toBeLessThan(3.6);
  expect(constrainClubhouse(2, 4.8, 4.85, 4.8)[0]).toBeLessThan(3.2);
  expect(constrainClubhouse(0, -1.3, 6.6, -1.3)[0]).toBeCloseTo(6.6);
  expect(constrainClubhouse(6.6, -1.3, 8, -1.3)[0]).toBeLessThan(7.3);
  expect(constrainClubhouse(2.5, 0, 2.5, 4)).toEqual([expect.closeTo(2.5, 5), expect.closeTo(4, 5)]);
});
