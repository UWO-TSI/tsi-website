import { describe, expect, it } from "vitest";
import { BENCH_SLOTS, benchSlotKey, villageIsland } from "./defaultIsland";
import { objectsOf, village } from "./villageMap";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import { CLIP_BY_NAME } from "./character/look";
import {
  MIN_STAY, RESIDENT_WALK, ResidentDay, buildDay, daySpan, idleAt, navGrid, newPose, phaseOn, planResident, planResidents, routineKeys, walkDistance, type Leg,
} from "./residentRoutine";

const v = village(), island = villageIsland(v), nav = navGrid(island, v);
const SORTED = [...PROPOSED_RESIDENTS].sort((a, b) => a.slug.localeCompare(b.slug));
const plans = planResidents(SORTED, v, island);
// A day in October (sun times from the monthly table).
const T = Date.parse("2026-10-01T16:00:00Z") / 1000;
const span = daySpan(T * 1000);
const days = plans.map(p => ({ plan: p, legs: buildDay(p, span, nav) }));

describe("resident routines", () => {
  it("spans 03:00 to 03:00 Toronto with the phases in order", () => {
    expect(new Date(span.t0 * 1000).toISOString()).toBe("2026-10-01T07:00:00.000Z");
    expect(span.t1 - span.t0).toBe(86400);
    expect(span.phases.map(p => p.phase)).toEqual(["night", "dawn", "day", "evening", "night"]);
    for (let i = 1; i < span.phases.length; i++) expect(span.phases[i].t0).toBe(span.phases[i - 1].t1);
  });

  it("resolves every resident's schedule into stops on the map", () => {
    for (const p of plans) {
      expect(p.home, p.slug).not.toBeNull();
      for (const stops of Object.values(p.phases)) expect(stops.length, p.slug).toBeGreaterThan(0);
    }
    // A one-place schedule (the seeded rows) still mills about: the anchor and two spots near it.
    const seeded = planResident(DEFAULT_NPC_PERSONAS[1], 0, v, island);
    expect(seeded.phases.day).toHaveLength(3);
    expect(seeded.phases.night.map(s => s.kind)).toEqual(["home"]);
    expect(routineKeys({ day: "shop" }, "dawn")).toEqual(["shop"]);
    expect(routineKeys({ day: ["shop", "pond"] }, "night")).toEqual(["home"]);
  });

  it("never teleports: sampled every 0.2 s through the day, no step is longer than a stroll covers", () => {
    const pose = newPose();
    for (const { plan } of days) {
      const day = new ResidentDay(plan, nav);
      let px = NaN, pz = NaN, worst = 0, at = 0;
      for (let t = span.t0; t < span.t1 - 1; t += 0.2) {
        day.at(t, null, pose);
        const step = Number.isNaN(px) ? 0 : Math.hypot(pose.x - px, pose.z - pz);
        if (!(step <= worst)) { worst = step; at = t; }
        px = pose.x; pz = pose.z;
      }
      expect(worst, `${plan.slug} at ${new Date(at * 1000).toISOString()}`).toBeLessThanOrEqual(RESIDENT_WALK * 0.2 + 1e-3);
    }
  });

  it("never walks through a solid: every walk stays on free ground but for its last steps through a door or onto a seat", () => {
    const bad: string[] = [];
    for (const { plan, legs } of days) {
      // Walks are cached per pair of stops: check each distinct one once.
      const seen = new Set<object>();
      for (const leg of legs) {
        if (!leg.walk || seen.has(leg.walk)) continue;
        seen.add(leg.walk);
        const { pts, cum } = leg.walk, n = cum.length;
        // Segments through a door or onto a seat are the first (from one) and the last (into one).
        const first = leg.from?.door ? 1 : 0, lastSeg = leg.stop.door ? n - 2 : n - 1;
        for (let i = first; i < lastSeg; i++) {
          const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[i * 2 + 2], bz = pts[i * 2 + 3], k = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
          for (let j = 0; j <= k; j++) {
            const x = ax + (bx - ax) * j / k, z = az + (bz - az) * j / k;
            if (!island.standable(x, z)) bad.push(`${plan.slug} ${leg.from?.id} > ${leg.stop.id} at ${x.toFixed(2)},${z.toFixed(2)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("stops at every waypoint: each walk ends in a stay of at least MIN_STAY at the same stop", () => {
    for (const { plan, legs } of days) {
      legs.forEach((leg: Leg, i) => {
        if (!leg.walk) return;
        const stay = legs[i + 1];
        expect(stay, plan.slug).toBeDefined();
        expect(stay.walk).toBeNull();
        expect(stay.stop).toBe(leg.stop);
        expect(stay.t1 - stay.t0, `${plan.slug} at ${leg.stop.id}`).toBeGreaterThanOrEqual(MIN_STAY - 1e-9);
        expect(stay.t0).toBeCloseTo(leg.t1, 6);
      });
      // Legs tile the day.
      for (let i = 1; i < legs.length; i++) expect(legs[i].t0, plan.slug).toBeCloseTo(legs[i - 1].t1, 6);
    }
  });

  it("walks at stride, facing the way it goes, easing in and out", () => {
    expect(walkDistance(10, 10 / RESIDENT_WALK + 0.35, 5).v).toBeCloseTo(RESIDENT_WALK, 6);
    expect(walkDistance(10, 10 / RESIDENT_WALK + 0.35, 0.1).v).toBeLessThan(RESIDENT_WALK * 0.4);
    const pose = newPose(), next = newPose(), day = new ResidentDay(plans[0], nav);
    let checked = 0;
    for (let t = span.t0 + 4 * 3600; t < span.t1 && checked < 50; t += 7.3) {
      day.at(t, null, pose);
      if (!pose.moving) continue;
      day.at(t + 0.05, null, next);
      if (!next.moving || Math.hypot(next.x - pose.x, next.z - pose.z) < 1e-4) continue;
      const dir = Math.atan2(next.x - pose.x, next.z - pose.z), diff = Math.atan2(Math.sin(dir - pose.yaw), Math.cos(dir - pose.yaw));
      if (Math.abs(diff) < 0.3) checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("at night everyone is indoors or on a bench, never standing about (the night owl excepted)", () => {
    for (const { plan } of days) {
      if (plan.phases.night[plan.phases.night.length - 1].kind !== "home") continue;
      const day = new ResidentDay(plan, nav), pose = newPose();
      for (const h of [0.5, 2, 3.5, 4.5]) {
        const t = span.t1 - 3 * 3600 + h * 3600;
        day.at(t, null, pose);
        expect(pose.inside || pose.seat > 0, `${plan.slug} at ${h} past midnight: ${pose.stop?.id}`).toBe(true);
      }
    }
    // The night owl is out (the lamp bench, the beach) while the rest sleep.
    const owl = days.find(d => d.plan.slug === "nell")!, pose = newPose();
    new ResidentDay(owl.plan, nav).at(span.t1 - 1.5 * 3600, null, pose);
    expect(pose.inside).toBe(false);
    expect(owl.plan.phases.night.map(s => s.kind)).toEqual(["sit", "stand", "sit"]);
  });

  it("never seats two residents on one seat at once, and the night's sitters get the bench under the lamp", () => {
    const sits = days.flatMap(({ plan, legs }) => legs.filter(l => !l.walk && l.stop.kind === "sit").map(l => ({ slug: plan.slug, seat: l.stop.at.join(), t0: l.t0, t1: l.t1 })));
    const clashes = sits.filter((a, i) => sits.some((b, j) => j > i && a.slug !== b.slug && a.seat === b.seat && a.t0 < b.t1 && b.t0 < a.t1));
    expect(clashes).toEqual([]);
    const lamp = objectsOf("lamp", v)[0];
    for (const { plan } of days) for (const s of plan.phases.night) if (s.kind === "sit") expect(Math.hypot(s.at[0] - lamp.x, s.at[1] - lamp.z), plan.slug).toBeLessThan(3.5);
  });

  it("seats residents only on the players' two bench slots, under the slot's claim key", () => {
    const slots = objectsOf("bench", v).flatMap(b => BENCH_SLOTS.map((off, s) => ({ key: benchSlotKey(b.id, s as 0 | 1), x: b.x + Math.cos(b.yaw ?? 0) * off, z: b.z - Math.sin(b.yaw ?? 0) * off })));
    for (const p of plans) for (const stops of Object.values(p.phases)) for (const s of stops) {
      if (s.kind !== "sit") continue;
      const slot = slots.find(o => Math.hypot(o.x - s.at[0], o.z - s.at[1]) < 1e-6);
      expect(slot, `${p.slug} ${s.id} at ${s.at}`).toBeDefined();
      expect((s as { seatKey?: string }).seatKey, p.slug).toBe(slot!.key);
    }
  });

  it("never stacks two residents: no two stopped residents within 0.5u at any time of day", () => {
    const clash: string[] = [];
    for (const when of ["2026-10-01T16:00:00Z", "2026-06-21T16:00:00Z"]) {
      const sp = daySpan(Date.parse(when)), live = plans.map(p => ({ slug: p.slug, day: new ResidentDay(p, nav), pose: newPose() }));
      for (let t = sp.t0; t < sp.t1; t += 15) {
        for (const r of live) r.day.at(t, null, r.pose);
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
          const a = live[i].pose, b = live[j].pose;
          if (a.inside || b.inside || a.moving || b.moving) continue;
          if (Math.hypot(a.x - b.x, a.z - b.z) < 0.5 && clash.length < 12) clash.push(`${live[i].slug}+${live[j].slug} at ${new Date(t * 1000).toISOString()} (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`);
        }
      }
    }
    expect(clash).toEqual([]);
  });

  it("is the same on every client: a function of world time only", () => {
    const a = newPose(), b = newPose(), again = planResidents(SORTED, v, island);
    for (const [i, { plan }] of days.entries()) for (const t of [T, T + 1234.5, T + 40000]) {
      new ResidentDay(plan, nav).at(t, null, a);
      new ResidentDay(again[i], nav).at(t, null, b);
      expect([b.x, b.z, b.yaw, b.inside]).toEqual([a.x, a.z, a.yaw, a.inside]);
    }
    expect(phaseOn(span, T)).toBe("day");
  });

  it("idles with gestures on a beat per visit, from clips the rig has", () => {
    for (const clip of ["LookAround", "StretchUp", "Chat"]) expect(CLIP_BY_NAME.has(clip), clip).toBe(true);
    const stand = plans[0].phases.day.find(s => s.kind === "stand")!;
    expect(idleAt(stand, 3, 1, 0.5).clip).toBeNull();
    const seen = new Set<string | null>();
    for (let s = 0; s < 300; s += 1) seen.add(idleAt(stand, 3, 1, s).clip);
    expect(seen.size).toBeGreaterThan(1);
    expect(idleAt(stand, 3, 1, 120)).toEqual(idleAt(stand, 3, 1, 120));
  });
});
