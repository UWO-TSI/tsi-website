// specs/multiplayer.md §7 realtime/test/sanity.test.ts: honest movement from the real
// movement sim (dash chain, downhill slide at the momentum ceiling, glide off a cliff,
// the fall cap, and the climbs and stalls around them) never strikes; cheats do.
import { describe, expect, it } from "vitest";
import { AREA_BOUNDS } from "@net/protocol";
import {
  addStrike,
  checkPose,
  decayStrikes,
  inBounds,
  newTrack,
  resetBaseline,
  SANITY,
  type MotionTrack,
  type PoseSample,
  type Verdict,
} from "../src/rooms/sanity";

const VILLAGE_BOUNDS = AREA_BOUNDS.village;
const INTERIOR_BOUNDS = AREA_BOUNDS.cafe;
import { honestTraces, traceStats, type TraceSample } from "./helpers/traces";

type Run = { accepted: number; drops: number; violations: string[] };

/** Feeds samples with their receive times; returns the verdict counts. */
function feed(samples: (PoseSample | TraceSample)[], recvOf: (i: number) => number, track: MotionTrack = newTrack(), bounds = VILLAGE_BOUNDS): Run {
  const run: Run = { accepted: 0, drops: 0, violations: [] };
  samples.forEach((s, i) => {
    const v: Verdict = checkPose(track, { t: s.t, x: s.x, y: s.y, z: s.z, teleport: s.teleport }, recvOf(i), bounds);
    if (v.ok) run.accepted++;
    else if (v.drop) run.drops++;
    else run.violations.push(`${i}:${v.violation}`);
  });
  return run;
}

/** A deterministic jitter source. */
function rng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** In-order arrival (one WebSocket) with a base latency and jitter. */
function arrivals(samples: { t: number }[], latency: number, jitter: number, seed = 1, stall?: { from: number; ms: number }) {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    let at = samples[i].t + latency + r() * jitter;
    if (stall && samples[i].t >= stall.from && samples[i].t < stall.from + stall.ms) at = Math.max(at, stall.from + stall.ms + latency);
    out.push(Math.max(at, out[i - 1] ?? -Infinity));
  }
  return out;
}

const traces = honestTraces();

describe("honest movement from the real sim never strikes", () => {
  it("covers the §7 fixtures and stays inside the village", () => {
    for (const name of ["dash chain", "downhill slide at the ceiling", "glide off a 1.5 u cliff", "the fall cap"]) expect(traces[name], name).toBeDefined();
    expect(traces["glide off a 1.5 u cliff"].some((s) => s.events.includes("glide"))).toBe(true);
    expect(traces["glide off a cliff"].some((s) => s.events.includes("glide"))).toBe(true);
    expect(traces["dash chain"].filter((s) => s.events.includes("dash")).length).toBeGreaterThanOrEqual(6);
    expect(traceStats(traces["downhill slide at the ceiling"]).maxHSpeed).toBeGreaterThan(23.5);
    expect(traceStats(traces["the fall cap"]).maxFall).toBeGreaterThan(17.9);
    for (const [name, tr] of Object.entries(traces)) for (const s of tr) expect(inBounds(s, VILLAGE_BOUNDS), name).toBe(true);
  });

  it.each(Object.keys(traces))("%s: accepted on a clean link", (name) => {
    const tr = traces[name];
    const run = feed(tr, (i) => tr[i].t + 35);
    expect(run.violations).toEqual([]);
    expect(run.drops).toBe(0);
    expect(run.accepted).toBe(tr.length);
  });

  it.each(Object.keys(traces))("%s: no strikes with 0–120 ms jitter", (name) => {
    const tr = traces[name];
    for (const seed of [1, 2, 3]) {
      const recv = arrivals(tr, 30, 120, seed);
      const run = feed(tr, (i) => recv[i]);
      expect(run.violations, `seed ${seed}`).toEqual([]);
      expect(run.drops, `seed ${seed}`).toBe(0);
    }
  });

  it.each(["dash chain", "downhill slide at the ceiling", "bunny hop chain"])("%s: a 1.5 s stall that releases every packet at once costs nothing", (name) => {
    const tr = traces[name];
    const recv = arrivals(tr, 30, 20, 7, { from: tr[0].t + 1000, ms: 1500 });
    const run = feed(tr, (i) => recv[i]);
    expect(run.violations).toEqual([]);
    expect(run.drops).toBe(0);
  });

  it("a stall longer than the banked credit only drops (no strike), then recovers", () => {
    const tr = traces["dash chain"];
    const recv = arrivals(tr, 30, 20, 9, { from: tr[0].t + 500, ms: 3200 });
    const track = newTrack();
    const run = feed(tr, (i) => recv[i], track);
    expect(run.violations).toEqual([]);
    expect(run.accepted).toBeGreaterThan(tr.length / 2);
  });
});

const S = (t: number, x: number, z: number, y = 0, teleport = false): PoseSample => ({ t, x, y, z, teleport });
/** A straight run along x at `speed` u/s, sampled every `every` ms from x0. */
const run = (speed: number, seconds: number, every = 66, x0 = -30): PoseSample[] =>
  Array.from({ length: Math.floor((seconds * 1000) / every) + 1 }, (_, i) => S(1000 + i * every, x0 + (speed * i * every) / 1000, 0));

describe("cheats are refused", () => {
  it("a speed hack (40 u/s) is refused at once", () => {
    const r = feed(run(40, 1), (i) => 1000 + i * 66 + 30);
    expect(r.violations[0]).toMatch(/speed/);
    expect(r.accepted).toBe(1);
  });

  it("a steady 30 u/s passes the instant check but not the 1 s average", () => {
    const r = feed(run(30, 2), (i) => 1000 + i * 66 + 30);
    expect(r.violations[0]).toMatch(/average$/);
    expect(r.violations.some((v) => v.endsWith("speed"))).toBe(false);
    // Accepted for the first second, refused once the window fills.
    expect(r.accepted).toBe(Math.floor(1000 / 66) + 1);
  });

  it("a jump of more than 6 u in 0.3 s needs the teleport flag (scaled with the gap at the 1 s average cap)", () => {
    // 7 u in 250 ms is 28 u/s: under the instant cap, over what the kit sustains.
    const base = [S(1000, 0, 0), S(1250, 7, 0)];
    expect(feed(base, (i) => base[i].t + 30).violations).toEqual(["1:teleport"]);
    const short = [S(1000, 0, 0), S(1100, 6.2, 0)];
    expect(feed(short, (i) => short[i].t + 30).violations).toEqual(["1:speed"]);
    const flagged = [S(1000, 0, 0), S(1250, 30, 0, 0, true)];
    expect(feed(flagged, (i) => flagged[i].t + 30).violations).toEqual([]);
  });

  it("a 24 u/s slide across a stalled 260 ms gap is not a teleport (protocol agent's case)", () => {
    const slide = [S(1000, 0, 0), S(1066, 1.584, 0), S(1326, 1.584 + 6.24, 0), S(1392, 1.584 + 6.24 + 1.584, 0)];
    expect(feed(slide, (i) => slide[i].t + 30)).toEqual({ accepted: 4, drops: 0, violations: [] });
  });

  it("honours one teleport flag per 2 s and 15 a minute; the rest are judged as plain samples", () => {
    // Flagged hops between x = -35 and +35.
    const hop = (n: number, every: number) => Array.from({ length: n }, (_, i) => S(1000 + i * every, i % 2 ? 35 : -35, 0, 0, i > 0));
    // Every 500 ms: sample 1 is honoured; 2 and 4 come too soon and are 70 u jumps; 3 is back where 1 was.
    const fast = hop(6, 500);
    expect(feed(fast, (i) => fast[i].t + 30).violations).toEqual(["2:speed", "4:speed"]);
    // Every 2 s: honoured until the 15th of the minute; the 16th (sample 16) is judged as a plain 70 u jump.
    const minute = hop(17, 2000);
    expect(feed(minute, (i) => minute[i].t + 30).violations).toEqual(["16:speed"]);
  });

  it("flying straight up or dropping faster than the fall cap is refused", () => {
    const up = [S(1000, 0, 0, 0), S(1066, 0, 0, 1.4)];
    expect(feed(up, (i) => up[i].t + 30).violations).toEqual(["1:rise"]);
    const down = [S(1000, 0, 0, 20), S(1066, 0, 0, 18.2)];
    expect(feed(down, (i) => down[i].t + 30).violations).toEqual(["1:fall"]);
  });

  it("a climb at a ramp's grade is fine at speed, not at a standstill", () => {
    // 16 u/s up while 18 u/s across (a ramp at momentum): over the 15 u/s straight-up limit, under 0.9 × across.
    const ramp = [S(1000, 0, 0, 0), S(1066, 1.2, 0, 1.05)];
    expect(feed(ramp, (i) => ramp[i].t + 30).violations).toEqual([]);
    const pillar = [S(1000, 0, 0, 0), S(1066, 0.1, 0, 1.05)];
    expect(feed(pillar, (i) => pillar[i].t + 30).violations).toEqual(["1:rise"]);
  });

  it("keeps positions inside the area", () => {
    expect(feed([S(1000, 41, 0)], () => 1030).violations).toEqual(["0:bounds"]);
    expect(feed([S(1000, 0, 0, 25.5)], () => 1030).violations).toEqual(["0:bounds"]);
    expect(feed([S(1000, 0, -3.5)], () => 1030, newTrack(), INTERIOR_BOUNDS).violations).toEqual([]);
    expect(feed([S(1000, 21, 0)], () => 1030, newTrack(), INTERIOR_BOUNDS).violations).toEqual(["0:bounds"]);
  });

  it("a clock running ahead of real time gets its samples dropped, not relayed", () => {
    // Claims 1.5 s per packet while sending every 100 ms, moving 20 u/s of the claimed time (30 u per packet).
    const s = Array.from({ length: 10 }, (_, i) => S(1000 + i * 1500, -36 + i * 7.2, 0));
    const r = feed(s, (i) => 1000 + i * 100 + 30);
    expect(r.violations).toEqual([]);
    expect(r.accepted).toBeLessThan(4);
    expect(r.drops).toBeGreaterThan(6);
  });

  it("a claimed pause needs a real one", () => {
    const fake = [S(1000, 0, 0), S(3600, 30, 0)];
    expect(feed(fake, (i) => [1030, 1130][i]).accepted).toBe(1);
    const real = [S(1000, 0, 0), S(3600, 30, 0)];
    expect(feed(real, (i) => real[i].t + 30).accepted).toBe(2);
  });

  it("drops samples under 20 ms apart, or with a clock that stepped back", () => {
    const s = [S(1000, 0, 0), S(1010, 0.1, 0), S(900, 0.2, 0), S(1066, 0.6, 0)];
    const r = feed(s, (i) => [1030, 1040, 1080, 1096][i]);
    expect(r).toEqual({ accepted: 2, drops: 2, violations: [] });
  });

  it("an area change starts a fresh baseline", () => {
    const track = newTrack();
    expect(checkPose(track, S(1000, 10, 10), 1030, VILLAGE_BOUNDS).ok).toBe(true);
    resetBaseline(track);
    expect(checkPose(track, S(1066, -5, 2), 1096, INTERIOR_BOUNDS)).toEqual({ ok: true, reset: true });
  });
});

describe("strikes", () => {
  it("count up to the kick and decay one per 10 s", () => {
    const track = newTrack();
    for (let i = 1; i < SANITY.kickStrikes; i++) expect(addStrike(track, 1000 + i)).toBeCloseTo(i, 2);
    expect(decayStrikes(track, 1009 + 10_000)).toBeCloseTo(8, 2);
    expect(addStrike(track, 1009 + 10_000)).toBeCloseTo(9, 2);
    expect(addStrike(track, 1009 + 10_000)).toBeCloseTo(10, 2);
    expect(decayStrikes(track, 1009 + 10_000 + 200_000)).toBe(0);
  });
});
