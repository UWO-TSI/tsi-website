import { describe, expect, it } from "vitest";
import { ASHORE, MOORED, STEP_AT } from "./wharf";
import {
  TRIP, arrivalTrip, berthTaken, boatPose, newBoatPose, newRiderPlace, phaseLength, riderPlace, skipTrip, startTrip, stepTrip,
  tripScene, type BoatTrip, type TripPhase,
} from "./boatTrip";

const T0 = 1_790_000_000_000;
/** Run a trip forward in 1/60 s frames until done (or `seconds`); the destination loads `loadAfter` s into the load; one press at `skipAt` s. */
function run(trip: BoatTrip, { from = T0, seconds = 60, loadAfter = 0.8, skipAt = Infinity }: { from?: number; seconds?: number; loadAfter?: number; skipAt?: number } = {}) {
  const phases: TripPhase[] = [trip.phase];
  const note = () => { if (phases.at(-1) !== trip.phase) phases.push(trip.phase); };
  let loadStarted: number | null = null, now = from;
  for (let i = 0; i < seconds * 60 && trip.phase !== "done"; i++) {
    now = from + i * (1000 / 60);
    if (now - from >= skipAt * 1000) { skipTrip(trip, now); skipAt = Infinity; note(); }
    if (trip.phase === "load") loadStarted ??= now;
    else loadStarted = null;
    stepTrip(trip, now, loadStarted !== null && now - loadStarted >= loadAfter * 1000);
    note();
  }
  return { phases, now };
}
/** The trip as it is `k` (0-1) of the way through `phase`, and that instant. */
const at = (trip: BoatTrip, phase: TripPhase, k: number): [BoatTrip, number] => {
  const t = { ...trip, phase, at: T0 } as BoatTrip;
  return [t, T0 + phaseLength(t) * 1000 * k];
};

describe("the boat trip (specs/polish/arrival-wharf.md deliverable 3)", () => {
  it("boards, casts off, sails out, veils, waits for the next island to load, then comes in, docks and hands back", () => {
    const trip = startTrip("me", "village", "home", { x: -0.3, z: -2.6, yaw: Math.PI }, T0);
    expect(trip.phase).toBe("board");
    expect(tripScene(trip)).toBe("village");
    const { phases } = run(trip, { loadAfter: 3 });
    expect(phases).toEqual(["board", "castoff", "turn", "sail", "veil", "load", "arrive", "dock", "land", "done"]);
    expect(tripScene(trip)).toBe("home");
  });

  it("never docks before the next island has loaded, however long it takes", () => {
    const trip = startTrip("me", "home", "village", null, T0);
    for (let s = 0; s < 120; s += 1 / 60) stepTrip(trip, T0 + s * 1000, false);
    expect(trip.phase).toBe("load");
    stepTrip(trip, T0 + 121_000, true);
    expect(trip.phase).toBe("arrive");
  });

  it("can be skipped with one press at any point: the rest goes by under a quick veil and you stand on the pier", () => {
    for (const skipAt of [0.2, 3, 6.5]) {
      const trip = startTrip("me", "village", "home", null, T0);
      const { phases } = run(trip, { skipAt, loadAfter: 0.5 });
      expect(phases.slice(-3), `skipped at ${skipAt}s`).toEqual(["load", "reveal", "done"]);
      expect(phases).not.toContain("arrive");
    }
    // Skipped while coming in: a quick veil, then you are ashore.
    const trip = arrivalTrip("me", "village", T0, true);
    const { phases } = run(trip, { skipAt: 2.5, loadAfter: 0 });
    expect(phases).toEqual(["veil", "load", "arrive", "veil", "load", "reveal", "done"]);
    // A second press does nothing more; a press once ashore does nothing at all.
    const twice = startTrip("me", "home", "village", null, T0);
    skipTrip(twice, T0 + 100); skipTrip(twice, T0 + 150);
    expect(twice.phase).toBe("veil");
    const ashore = { ...arrivalTrip("me", "village", T0, true), phase: "reveal" as const };
    skipTrip(ashore, T0 + 10);
    expect(ashore.phase).toBe("reveal");
  });

  it("the quick veil is quicker than the sailing one", () => {
    const sailing = startTrip("me", "village", "home", null, T0);
    expect(phaseLength({ ...sailing, phase: "veil" })).toBe(TRIP.veil);
    skipTrip(sailing, T0 + 10);
    expect(phaseLength(sailing)).toBe(TRIP.quickVeil);
    expect(TRIP.quickVeil).toBeLessThan(TRIP.veil);
  });

  it("brings a first login in the same way, to the village wharf: under the loading screen, or through a veil if the island is up", () => {
    const loading = arrivalTrip("me", "village", T0, false);
    expect(loading.from).toBe("sea");
    expect(loading.phase).toBe("load");
    expect(tripScene(loading)).toBe("village");
    expect(run(loading, { loadAfter: 2 }).phases).toEqual(["load", "arrive", "dock", "land", "done"]);
    const shown = arrivalTrip("me", "village", T0, true);
    expect(shown.phase).toBe("veil");
    expect(run(shown).phases).toEqual(["veil", "load", "arrive", "dock", "land", "done"]);
  });

  it("takes the boat from its mooring and brings it back to it, without a jump anywhere along the way", () => {
    const trip = startTrip("me", "village", "home", { x: 0, z: -1.5, yaw: 0 }, T0);
    const p = newBoatPose(), q = newBoatPose();
    boatPose(trip, T0, p);
    expect([p.x, p.z, p.yaw]).toEqual([MOORED.x, MOORED.z, MOORED.yaw]);
    // Departure, then arrival: sample every frame, the boat never moves further than its speed allows.
    for (const t of [startTrip("me", "village", "home", { x: 0, z: -1.5, yaw: 0 }, T0), arrivalTrip("me", "home", T0, false)]) {
      let now = T0, loadAt: number | null = null, steps = 0;
      boatPose(t, now, p);
      while (t.phase !== "done" && steps++ < 4000) {
        now += 1000 / 60;
        if (t.phase === "load") loadAt ??= now;
        stepTrip(t, now, loadAt !== null);
        boatPose(t, now, q);
        if (t.phase !== "load" && !(t.phase === "arrive" && now - t.at < 20)) {
          const moved = Math.hypot(q.x - p.x, q.z - p.z);
          expect(moved, `${t.phase} at ${now - T0}`).toBeLessThan(10 / 60);
          expect(Math.abs(q.yaw - p.yaw), `${t.phase} turn`).toBeLessThan(0.08);
        }
        Object.assign(p, q);
      }
      expect(t.phase).toBe("done");
    }
    expect([q.x, q.z, q.yaw].map(v => +v.toFixed(6))).toEqual([MOORED.x, MOORED.z, MOORED.yaw]);
  });

  it("sails out to sea, away from the pier, and comes in from it", () => {
    const out = startTrip("me", "village", "home", null, T0), pose = newBoatPose();
    boatPose(...at(out, "veil", 1), pose);
    expect(pose.z).toBeLessThan(-18);
    expect(pose.speed).toBeGreaterThan(5);
    const back = arrivalTrip("me", "home", T0, false);
    boatPose(...at(back, "arrive", 0), pose);
    expect(pose.z).toBeLessThan(-12);
    expect(Math.abs(pose.yaw)).toBeLessThan(0.3); // heading for land
  });

  it("walks the rider from where they stood, steps them aboard to sit, and on arrival ashore to the arrival point facing inland", () => {
    const trip = startTrip("me", "village", "home", { x: -0.4, z: -1.2, yaw: Math.PI }, T0), r = newRiderPlace();
    riderPlace(trip, T0, r);
    expect([r.x, r.z, r.aboard, r.seated]).toEqual([-0.4, -1.2, 0, false]);
    riderPlace(...at(trip, "board", 0.999), r);
    expect([r.aboard, r.seated]).toEqual([1, true]);
    riderPlace(...at(trip, "sail", 0.5), r);
    expect(r.seated).toBe(true);
    const back = arrivalTrip("me", "home", T0, false);
    riderPlace(...at(back, "land", 0), r);
    expect([r.aboard, r.seated]).toEqual([1, true]);
    riderPlace(...at(back, "land", 1), r);
    expect([r.aboard, r.seated, +r.x.toFixed(6), +r.z.toFixed(6), +r.yaw.toFixed(6)]).toEqual([0, false, ASHORE.x, ASHORE.z, 0]);
    // Mid-way up the pier they are walking.
    riderPlace(...at(back, "land", 0.75), r);
    expect(r.speed).toBeGreaterThan(1);
    expect(r.aboard).toBe(0);
    // Stepping aboard they leave from the step, over the gunwale.
    const hop = { ...trip, phase: "board" as const, at: T0 };
    let highest = 0;
    for (let k = 0; k <= 1; k += 0.01) { riderPlace(hop, T0 + phaseLength(hop) * 1000 * k, r); highest = Math.max(highest, r.arc); }
    expect(highest).toBeGreaterThan(0.3);
    riderPlace(...at({ ...trip, start: { x: STEP_AT.x, z: STEP_AT.z, yaw: 0 } }, "board", 0), r);
    expect([r.x, r.z]).toEqual([STEP_AT.x, STEP_AT.z]);
  });

  it("frees the berth only while this place's boat is out", () => {
    const trip = startTrip("me", "village", "home", null, T0);
    expect(berthTaken(trip, "village")).toBe(true);
    expect(berthTaken(trip, "home")).toBe(false);
    Object.assign(trip, { phase: "arrive", leg: "in" });
    expect(berthTaken(trip, "home")).toBe(true);
    expect(berthTaken(trip, "village")).toBe(false);
    trip.phase = "done";
    expect(berthTaken(trip, "home")).toBe(false);
  });

  it("is plain data and a function of time, so anyone shown the traveller's trip draws the same boat and rider (multiplayer-forward)", () => {
    const trip = startTrip("guest-7", "village", "home", { x: 0.2, z: -2, yaw: 1 }, T0);
    run(trip, { seconds: 5 });
    const copy = JSON.parse(JSON.stringify(trip)) as BoatTrip;
    const a = newBoatPose(), b = newBoatPose(), ra = newRiderPlace(), rb = newRiderPlace();
    for (const dt of [0, 400, 1300]) {
      boatPose(trip, T0 + 5000 + dt, a); boatPose(copy, T0 + 5000 + dt, b);
      riderPlace(trip, T0 + 5000 + dt, ra); riderPlace(copy, T0 + 5000 + dt, rb);
      expect(b).toEqual(a);
      expect(rb).toEqual(ra);
    }
  });
});
