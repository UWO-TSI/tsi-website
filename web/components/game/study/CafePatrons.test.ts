import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PATRON_MAX, cafePatrons, patronSeats, patronTarget, seatKey } from "@/lib/study/patrons";
import { liveRemotes } from "../net/active";
import { seatsWanted } from "./CafePatrons";

afterEach(() => { liveRemotes.n = 0; });

describe("café patrons with other players (multiplayer §5.8)", () => {
  it("gives up the seats other players stand at, as for you, and is just the members' seats with nobody else here", () => {
    const taken = new Set(["held#1"]), into = new Set<string>();
    expect(seatsWanted(into, taken)).toBe(taken);
    const [a, b] = patronSeats();
    liveRemotes.x[0] = a.x + 0.4; liveRemotes.z[0] = a.z; liveRemotes.n = 1;
    const wanted = seatsWanted(into, taken);
    expect(wanted.has("held#1")).toBe(true);
    expect(wanted.has(seatKey(a))).toBe(true);
    expect(wanted.has(seatKey(b))).toBe(Math.hypot(b.x - a.x - 0.4, b.z - a.z) < 1.5);
  });

  it("thins to the larger of the members seated and the other players in the café, all of them with nobody else here", () => {
    const target = (seated: number, others: number) => patronTarget(Math.max(seated, others));
    expect(target(0, 0)).toBe(PATRON_MAX);
    expect(target(1, 4)).toBe(PATRON_MAX - 4);
    expect(target(5, 2)).toBe(PATRON_MAX - 5);
    // A busy room: never more patrons in at once than the target lets in.
    const shown = new Set<string>(), yielded = new Map<string, number>();
    for (let t = 50_000; t < 50_000 + 3600; t += 30) expect(cafePatrons(t, { taken: new Set(), target: target(0, 5), shown, yielded }).filter(v => !yielded.has(v.visit.id)).length).toBeLessThanOrEqual(PATRON_MAX - 5);
  });

  it("runs on the shared world clock, so everyone sees the same café", () => {
    const src = readFileSync(new URL("./CafePatrons.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/worldNow\(\) \/ 1000/);
    expect(src).not.toMatch(/Date\.now\(\)/);
  });
});
