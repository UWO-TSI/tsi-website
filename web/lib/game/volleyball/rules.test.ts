import { describe, expect, it } from "vitest";
import { awardRally, landingLoser, openingScore, winnerOf, type Score } from "./rules";

describe("rally scoring", () => {
  it("is one set to 21, won by 2", () => {
    expect(winnerOf([21, 19])).toBe(0);
    expect(winnerOf([21, 20])).toBe(null);
    expect(winnerOf([22, 24])).toBe(1);
    expect(winnerOf([20, 18])).toBe(null);
  });
  it("switches sides every 7 points", () => {
    let s: Score = openingScore(0, -1);
    const switches: number[] = [];
    for (let i = 0; i < 21; i++) { const r = awardRally(s, (i % 3 ? 0 : 1)); s = r.score; if (r.switched) switches.push(s.points[0] + s.points[1]); }
    expect(switches).toEqual([7, 14, 21]);
    expect(s.side0).toBe(1);
  });
  it("gives the serve to the rally's winner, and to the other player each time a team wins it back", () => {
    let s = openingScore(0, -1);
    const servers: string[] = [];
    for (const w of [0, 1, 1, 0, 1, 0] as const) { s = awardRally(s, w).score; servers.push(`${s.serving}${s.server[s.serving]}`); }
    // team 0's player 0 opens; team 1 wins it: its player 0; keeps it; team 0 back: player 1; team 1 back: player 1; team 0 back: player 0.
    expect(servers).toEqual(["00", "10", "10", "01", "11", "00"]);
  });
  it("blames the side it lands in, or the last toucher when out", () => {
    const s = openingScore(0, -1);
    expect(landingLoser(s, true, -1, 1)).toBe(0);
    expect(landingLoser(s, false, -1, 1)).toBe(1);
  });
});
