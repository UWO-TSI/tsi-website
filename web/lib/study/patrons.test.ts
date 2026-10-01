import { describe, expect, it } from "vitest";
import { cafeWalkable } from "@/lib/game/cafe";
import { PATRON_MAX, PATRON_SIT_S, PATRON_SPEED, cafePatrons, patronPath, patronSeats, patronTarget, propSpot, seatKey, type PatronView } from "./patrons";

const T = 1_790_000_000; // a fixed world-clock second
const fresh = () => ({ shown: new Set<string>(), yielded: new Map<string, number>() });
const seated = (views: PatronView[]) => views.filter(v => v.sit === 1);

describe("café patrons (row 271)", () => {
  it("walks from the door to every café seat, clear of furniture", () => {
    for (const seat of patronSeats()) {
      const p = patronPath(seat);
      expect(p.pts[0][1]).toBeLessThan(-6);                   // from outside the doorway
      expect(p.pts.at(-1)).toEqual([seat.x, seat.z]);
      for (let s = 1.5; s < p.length - 1.3; s += 0.1) {
        let k = 1;
        while (k < p.pts.length - 1 && p.cum[k] < s) k++;
        const [a, b] = [p.pts[k - 1], p.pts[k]], t = (s - p.cum[k - 1]) / (p.cum[k] - p.cum[k - 1]);
        expect(cafeWalkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), `${seatKey(seat)} at ${s.toFixed(1)}`).toBe(true);
      }
    }
  });

  it("is the same café for everyone at the same moment, first come first served, never over the target", () => {
    const a = cafePatrons(T, { taken: new Set(), ...fresh() }), b = cafePatrons(T, { taken: new Set(), ...fresh() });
    expect(a.map(v => [v.visit.id, v.x, v.z])).toEqual(b.map(v => [v.visit.id, v.x, v.z]));
    for (let t = T; t < T + 6 * 3600; t += 97) {
      const views = cafePatrons(t, { taken: new Set(), ...fresh() });
      expect(views.length).toBeLessThanOrEqual(PATRON_MAX);
      expect(new Set(views.map(v => v.visit.key)).size).toBe(views.length); // one per seat
    }
    expect(Math.max(...Array.from({ length: 40 }, (_, k) => cafePatrons(T + k * 900, { taken: new Set(), ...fresh() }).length))).toBeGreaterThan(3);
    expect([0, 3, 7, 12].map(patronTarget)).toEqual([PATRON_MAX, PATRON_MAX - 3, 0, 0]);
  });

  it("never sits in a seat a member holds", () => {
    const keys = patronSeats().map(seatKey);
    for (let t = T; t < T + 3 * 3600; t += 131) {
      const taken = new Set(keys.filter((_, i) => i % 2 === 0));
      for (const v of cafePatrons(t, { taken, ...fresh() })) expect(taken.has(v.visit.key)).toBe(false);
    }
  });

  it("always yields: a member walking up to a patron's seat gets it within a stand-up and a step", () => {
    // Find a moment with a seated patron.
    let t = T, first: PatronView | undefined;
    for (; !first; t += 60) first = seated(cafePatrons(t, { taken: new Set(), ...fresh() }))[0];
    const state = fresh();
    cafePatrons(t, { taken: new Set(), ...state });
    const seat = first.visit.seat, me: [number, number] = [seat.x + 0.6, seat.z - 0.6];
    const at = (dt: number) => cafePatrons(t + dt, { taken: new Set(), player: me, ...state }).find(v => v.visit.id === first!.visit.id);
    expect(at(0)!.sit).toBe(1);                               // still down the instant you arrive
    expect(state.yielded.has(first.visit.id)).toBe(true);     // and already asked to go
    expect(at(PATRON_SIT_S / 2)!.sit).toBeLessThan(1);        // standing up
    const gone = at(PATRON_SIT_S + 1.2 / PATRON_SPEED);
    expect(Math.hypot(gone!.x - seat.x, gone!.z - seat.z)).toBeGreaterThan(1);
    expect(gone!.walking).toBe(true);
    // A seat taken on another device sends its patron out the same way; nobody new comes in to it.
    const s2 = fresh();
    cafePatrons(t, { taken: new Set(), ...s2 });
    const taken = new Set([first.visit.key]);
    cafePatrons(t + 30, { taken, ...s2 });
    expect(s2.yielded.get(first.visit.id)).toBe(t + 30);
    const after = cafePatrons(t + 30 + PATRON_SIT_S + 1, { taken, ...s2 }).filter(v => v.visit.key === first!.visit.key);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every(v => v.sit === 0 && v.walking)).toBe(true);
  });

  it("thins out as members arrive: the latest arrivals leave first", () => {
    let t = T, views: PatronView[] = [];
    for (; views.length < 4; t += 120) views = cafePatrons(t, { taken: new Set(), ...fresh() });
    const state = fresh();
    cafePatrons(t, { taken: new Set(), ...state });
    cafePatrons(t + 1, { taken: new Set(), target: 2, ...state });
    const order = [...views].sort((a, b) => a.visit.enter - b.visit.enter).map(v => v.visit.id);
    expect(order.slice(0, 2).some(id => state.yielded.has(id))).toBe(false);
    expect(order.slice(2).every(id => state.yielded.has(id))).toBe(true);
  });

  it("puts each patron's cup or laptop on the table in front of them", () => {
    for (const seat of patronSeats()) {
      const p = propSpot(seat);
      expect(Math.hypot(p.x - seat.x, p.z - seat.z)).toBeGreaterThan(0.4);
      expect(p.y).toBeGreaterThanOrEqual(0.6);
    }
  });
});
