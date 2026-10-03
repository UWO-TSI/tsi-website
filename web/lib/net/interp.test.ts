import { describe, expect, it } from "vitest";
import { NO_INPUT, STEP, createMoveState, stepMove, type MoveInput, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import { EV, FLAG, INTERP_DELAY_MS, createPose, encodePose, moveIndex, nextTp, type NetPlayer, type Pose } from "./protocol";
import { REMOTE_EVENTS, createRemoteSample, toRemotePlayer, type RemoteChange, type RemoteSample } from "./types";
import { EXTRAPOLATE_MS, RemoteBuffer, Remotes, SNAP_DIST, STALE_EVENT_MS, parseNetsim, type MotionWire } from "./interp";

const TAU = 2 * Math.PI;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const netPlayer = (over: Partial<NetPlayer> = {}): NetPlayer => ({
  sid: 3, uid: "u-3", name: "Pebble 03", badge: 1, look: "", level: 4, family: 0, kit: "", mastery: 0, aura: "", frame: 0,
  area: 0, flags: FLAG.showClass, held: "", weapon: "", pose: "", seat: "", study: 0, studyEnds: 0,
  t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, tp: 0, ...over,
});
const remote = (over: Partial<NetPlayer> = {}, netsim = null as ReturnType<typeof parseNetsim>) => new RemoteBuffer(3, toRemotePlayer(netPlayer(over), 0), netsim);

/** A sample through the real codec: the pose packet's integers, as the server copies them into the schema. */
function wire(t: number, p: Partial<Pose> = {}, tp = 0): MotionWire {
  const k = encodePose({ ...createPose(), t, ...p }) as number[];
  return { t: k[1], x: k[2], y: k[3], z: k[4], vx: k[5], vy: k[6], vz: k[7], yaw: k[8], move: k[9], air: k[10], leaf: k[11], lift: k[12], tp };
}
const fromState = (s: MoveState): Partial<Pose> => ({ x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, yaw: s.facing });

const flat: MoveWorld = { top: () => 0, wet: () => false };
/** A running jump on flat ground from the real kit: one state per 1/120 s step, `jumpAt` the step Space is pressed. */
function jumpTrace(steps = 200, jumpAt = 30): MoveState[] {
  const trace = [createMoveState(0, 0, flat)];
  for (let i = 0; i < steps; i++) {
    const input: MoveInput = { ...NO_INPUT, x: 1, jump: i >= jumpAt && i < jumpAt + 60, jumpPressed: i === jumpAt };
    trace.push(stepMove(trace[i], input, STEP, flat));
  }
  return trace;
}
const ms = (step: number) => step * STEP * 1000;

describe("Hermite position against the real movement kit", () => {
  /**
   * The sender's cadence through a jump: a sample on the take-off (an event sends at once), then `hz` while in the
   * air, and one on the landing. Returns the max error along the arc and the apex error, both in world units.
   */
  function fit(hz: number) {
    const trace = jumpTrace();
    const take = trace.findIndex(s => s.events.some(e => e.kind === "jump"));
    const land = trace.findIndex((s, i) => i > take && s.events.some(e => e.kind === "land"));
    expect(take).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(take + 40);
    const every = Math.round(120 / hz), steps = [Math.max(0, take - every), take];
    for (let i = take + every; i < land; i += every) steps.push(i);
    steps.push(land, land + every);
    const r = remote();
    let k = 0, worst = 0, apex = -Infinity;
    for (let i = take; i <= land; i++) {
      // Samples arrive as the render time trails them by ~200 ms: the ring holds the last eight.
      for (; k < steps.length && steps[k] <= i + 24; k++) r.pushWire(wire(ms(steps[k]), fromState(trace[steps[k]])), ms(steps[k]) + 40);
      r.evaluate(ms(i));
      const e = r.evaluated, s = trace[i];
      worst = Math.max(worst, Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z));
      apex = Math.max(apex, e.y);
    }
    const trueApex = Math.max(...trace.slice(take, land + 1).map(s => s.y));
    return { worst, apexError: Math.abs(apex - trueApex), trueApex };
  }

  it("draws the jump's apex and arc from 15 Hz samples (the airborne rate) within a centimetre or two", () => {
    const { worst, apexError, trueApex } = fit(15);
    expect(trueApex).toBeGreaterThan(1.28); // the kit's jump, held
    expect(apexError).toBeLessThan(0.005);
    expect(worst).toBeLessThan(0.02);
  });
  it("still holds the apex at 10 Hz; the landing's corner costs a few centimetres", () => {
    const { worst, apexError } = fit(10);
    expect(apexError).toBeLessThan(0.005);
    expect(worst).toBeLessThan(0.07);
  });
  it("passes through every sample exactly (to the wire's centimetre)", () => {
    const r = remote(), trace = jumpTrace();
    for (const i of [20, 28, 36]) r.pushWire(wire(ms(i), fromState(trace[i])), ms(i));
    for (const i of [20, 28]) {
      r.evaluate(Math.round(ms(i))); // the wire's whole millisecond
      expect(r.evaluated.y).toBeCloseTo(trace[i].y, 2);
      expect(r.evaluated.x).toBeCloseTo(trace[i].x, 2);
    }
  });
  it("its velocity is the path's derivative, the sample's at each end", () => {
    const r = remote();
    r.pushWire(wire(0, { x: 0, vx: 4 }), 0);
    r.pushWire(wire(100, { x: 0.5, vx: 6 }), 100);
    r.evaluate(0);
    expect(r.evaluated.vx).toBeCloseTo(4, 6);
    r.evaluate(100 - 1e-9);
    expect(r.evaluated.vx).toBeCloseTo(6, 4);
    r.evaluate(50);
    expect(r.evaluated.vx).toBeGreaterThan(4);
  });
});

describe("yaw", () => {
  it("takes the short way across the 0/2π seam, both ways", () => {
    const r = remote();
    r.pushWire(wire(0, { yaw: TAU - 0.1 }), 0);
    r.pushWire(wire(100, { yaw: 0.1 }), 100);
    r.pushWire(wire(200, { yaw: TAU - 0.2 }), 200);
    for (const [t, want] of [[50, 0], [25, -0.05], [75, 0.05], [150, -0.05]] as const) {
      r.evaluate(t);
      expect(Math.abs(wrapAngle(r.evaluated.yaw - want)), `t ${t}`).toBeLessThan(1e-3);
    }
  });
  it("comes out of sample() in [0, 2π)", () => {
    const r = remote(), out = createRemoteSample();
    for (let i = 0; i < 6; i++) r.pushWire(wire(i * 100, { yaw: i % 2 ? 0.05 : TAU - 0.05 }), i * 100);
    for (let now = 0; now < 1200; now += 16) {
      r.sample(now, out);
      expect(out.yaw).toBeGreaterThanOrEqual(0);
      expect(out.yaw).toBeLessThan(TAU);
    }
  });
});

describe("discrete fields", () => {
  it("move and lift step at their sample's time; air and leaf blend while move holds", () => {
    /** What the renderer sees at render time `rt` (one fresh remote per look: the first frame draws at transit + delay). */
    const at = (rt: number) => {
      const b = remote(), out = createRemoteSample();
      b.pushWire(wire(0, { move: moveIndex("Air"), air: 0.2 }), 0);
      b.pushWire(wire(100, { move: moveIndex("Air"), air: 0.6 }), 100);
      b.pushWire(wire(200, { move: moveIndex("Glide"), air: 0.6, leaf: 1, lift: 0.3 }), 200);
      b.pushWire(wire(300, { move: moveIndex("Glide"), air: 0.6, leaf: 1, lift: 0.3 }), 300);
      return b.sample(rt + b.delay, out);
    };
    expect(at(50)).toMatchObject({ move: "Air" });
    expect(at(50).air).toBeCloseTo(0.4, 2);
    expect(at(150).move).toBe("Air"); // Air until the Glide sample's time
    expect(at(150).leaf).toBe(0); // a different move at the two ends: no blend
    expect(at(150).lift).toBe(0);
    expect(at(210).move).toBe("Glide");
    expect(at(210).lift).toBeCloseTo(0.3, 3);
  });
});

describe("underrun", () => {
  it("extrapolates with the last velocity for 250 ms, then holds still", () => {
    const r = remote();
    r.pushWire(wire(0, { x: 0, vx: 5 }), 0);
    r.pushWire(wire(100, { x: 0.5, vx: 5 }), 100);
    r.evaluate(200);
    expect(r.evaluated).toMatchObject({ extrapolating: true });
    expect(r.evaluated.x).toBeCloseTo(1, 2);
    expect(r.evaluated.vx).toBeCloseTo(5, 2);
    r.evaluate(100 + EXTRAPOLATE_MS);
    expect(r.evaluated.x).toBeCloseTo(0.5 + 5 * EXTRAPOLATE_MS / 1000, 2);
    for (const late of [EXTRAPOLATE_MS + 1, 1000, 60_000]) {
      r.evaluate(100 + late);
      expect(r.evaluated.x).toBeCloseTo(0.5 + 5 * EXTRAPOLATE_MS / 1000, 2);
      expect(r.evaluated.vx).toBe(0); // held: the walk stops
    }
  });
  it("before the first sample it holds at the oldest", () => {
    const r = remote();
    r.pushWire(wire(1000, { x: 3, vx: 5 }), 1000);
    r.evaluate(500);
    expect(r.evaluated).toMatchObject({ x: 3, vx: 0, extrapolating: false });
  });
  it("a stop sample then silence holds until the last stretch before the next sample", () => {
    const r = remote();
    r.pushWire(wire(0, { x: 0 }), 0); // stopped: velocity 0
    r.pushWire(wire(5000, { x: 1, vx: 7.4 }), 5000); // walked off 5 s later
    for (const t of [100, 2500, 4700]) {
      r.evaluate(t);
      expect(r.evaluated.x, `t ${t}`).toBe(0);
    }
    r.evaluate(4900);
    expect(r.evaluated.x).toBeGreaterThan(0);
    expect(r.evaluated.x).toBeLessThan(1);
  });
  it("eases back onto the path when data returns, and snaps when the miss is over 3 u", () => {
    const run = (jumpX: number) => {
      const r = remote(), out = createRemoteSample();
      // Steady 10 Hz walking at 5 u/s with 50 ms transit, then the stream stalls for 600 ms, then resumes elsewhere.
      let x = 0, t = 0;
      const frames: { x: number; snapped: boolean; rt: number }[] = [];
      const send = () => { r.pushWire(wire(t, { x, vx: 5 }), t + 50); };
      for (let now = 0; now < 4000; now += 1000 / 60) {
        while (t + 50 <= now && t < 3000) {
          if (t < 1000 || t >= 1600) send();
          t += 100; x = t >= 1600 ? (t / 1000) * 5 + jumpX : (t / 1000) * 5;
        }
        r.sample(now, out);
        frames.push({ x: out.x, snapped: out.snapped, rt: now - r.renderLag });
      }
      return frames;
    };
    const smooth = run(0.8), first = smooth.findIndex(f => f.snapped);
    let maxStep = 0, snaps = 0;
    for (let i = first + 1; i < smooth.length; i++) { maxStep = Math.max(maxStep, Math.abs(smooth[i].x - smooth[i - 1].x)); if (smooth[i].snapped) snaps++; }
    expect(snaps).toBe(0); // only the first frame drawn
    // The stall left it ~2 u behind (250 ms of extrapolation, then held): it eases over several frames, never in one.
    expect(maxStep).toBeLessThan(0.5);
    expect(smooth.filter((f, i) => i > first && Math.abs(f.x - smooth[i - 1].x) > 0.2).length).toBeGreaterThanOrEqual(3);
    // And is back on the path within half a second of the data's return (frame 168 is 2.8 s: the stream ends at 2.9 s).
    const back = smooth[168];
    expect(Math.abs(back.x - (back.rt / 1000) * 5 - 0.8)).toBeLessThan(0.01);
    const far = run(SNAP_DIST + 2);
    expect(far.filter(f => f.snapped).length).toBe(2); // the first frame, and the miss
  });
});

describe("teleports (tp)", () => {
  it("a changed tp snaps once, never interpolating across, through the 255 → 0 wrap", () => {
    const r = remote({ tp: 254 }), out = createRemoteSample();
    let tp = 254;
    const at = (t: number, x: number, z = 0) => r.pushWire(wire(t, { x, z, vx: 2 }, tp), t);
    at(0, 0); at(100, 0.2);
    tp = nextTp(tp); // 255
    at(200, 20, 5);
    at(300, 20.2, 5);
    tp = nextTp(tp); // 0
    expect(tp).toBe(0);
    at(400, -10, -10);
    at(500, -9.8, -10);
    const snaps: number[] = [], xs: number[] = [];
    for (let now = 0; now <= 1200; now += 10) {
      r.sample(now, out);
      xs.push(out.x);
      if (out.snapped) snaps.push(now);
    }
    // The first frame, and one per teleport.
    expect(snaps.length).toBe(3);
    // Never anywhere between the islands it jumped between.
    for (const x of xs) expect(x < 1.2 || (x > 19.9 && x < 21.5) || x < -9).toBe(true);
  });
  it("a long frame that skips past a teleport sample still reports the snap", () => {
    const r = remote({ tp: 7 }), out = createRemoteSample();
    r.pushWire(wire(0, { x: 0 }, 7), 0);
    r.pushWire(wire(100, { x: 30 }, 8), 100);
    r.pushWire(wire(200, { x: 30.2 }, 8), 200);
    r.pushWire(wire(300, { x: 30.4 }, 8), 300);
    r.sample(0, out);
    expect(out.snapped).toBe(true); // first frame
    r.sample(5000, out);
    expect(out.snapped).toBe(true);
    r.sample(5016, out);
    expect(out.snapped).toBe(false);
  });
});

describe("events", () => {
  it("fire in order when the render time passes them, whatever order they arrived in", () => {
    const r = remote(), out = createRemoteSample();
    for (let t = 0; t <= 1000; t += 100) r.pushWire(wire(t, { x: t / 100 }), t);
    r.pushEvent(300, EV.land, 0.8, 0);
    r.pushEvent(100, EV.jump, 0, 0);
    r.pushEvent(200, EV.play, "Wave", 0);
    const fired: [number, string, number | string][] = [];
    for (let now = 0; now <= 2000; now += 10) {
      r.sample(now, out);
      const rt = now - r.renderLag;
      for (let i = 0; i < out.eventCount; i++) {
        const e = out.events[i];
        expect(e.t).toBeLessThanOrEqual(rt + 1e-9);
        expect(rt - e.t).toBeLessThan(10.5); // on the frame it comes due
        fired.push([e.t, e.kind, e.value]);
      }
    }
    expect(fired).toEqual([[100, "jump", 0], [200, "play", "Wave"], [300, "land", 0.8]]);
  });
  it("hand out at most REMOTE_EVENTS a frame, the rest the next", () => {
    const s = remote(), o2 = createRemoteSample();
    s.pushWire(wire(0), 0);
    s.pushWire(wire(1000), 1000);
    for (let i = 0; i < 12; i++) s.pushEvent(500 + i, EV.hop, 0, 0);
    s.sample(520 + s.delay, o2);
    expect(o2.eventCount).toBe(REMOTE_EVENTS);
    expect(o2.events.slice(0, REMOTE_EVENTS).map(e => e.t)).toEqual([500, 501, 502, 503, 504, 505, 506, 507]);
    s.sample(521 + s.delay, o2);
    expect(o2.events.slice(0, o2.eventCount).map(e => e.t)).toEqual([508, 509, 510, 511]);
  });
  it("one far behind the render time is dropped, not fired late", () => {
    const r = remote(), out = createRemoteSample();
    r.pushWire(wire(0), 0);
    r.sample(0, out); // the render time starts INTERP_DELAY_MS.initial behind
    r.pushEvent(-INTERP_DELAY_MS.initial - STALE_EVENT_MS - 100, EV.dash, 0, 0);
    r.pushEvent(-INTERP_DELAY_MS.initial + 5, EV.dash, 0, 0);
    let fired: number[] = [];
    for (let now = 10; now < 100; now += 10) {
      r.sample(now, out);
      fired = [...fired, ...out.events.slice(0, out.eventCount).map(e => e.t)];
    }
    expect(fired).toEqual([-INTERP_DELAY_MS.initial + 5]);
  });
  it("ignore kinds the contract doesn't have", () => {
    const r = remote(), out = createRemoteSample();
    r.pushWire(wire(0), 0);
    r.pushEvent(0, 99, 0, 0);
    r.pushEvent(0, 1.5, 0, 0);
    r.sample(1000, out);
    expect(out.eventCount).toBe(0);
  });
});

describe("the render delay", () => {
  it("starts at INTERP_DELAY_MS.initial over the transit, then settles near 1.5 × interval + 2 × jitter", () => {
    const r = remote(), out = createRemoteSample();
    r.pushWire(wire(0), 60);
    r.sample(60, out);
    expect(r.renderLag).toBe(60 + INTERP_DELAY_MS.initial);
    // 10 Hz with a 60 ms path and 0..40 ms of jitter, rendered at 60 fps for 20 s.
    let seed = 5;
    const jit = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 40;
    let t = 100, extrapolated = 0, frames = 0;
    let next = t + 60 + jit();
    for (let now = 60; now < 20_000; now += 1000 / 60) {
      while (next <= now) { r.pushWire(wire(t, { x: t / 1000, vx: 1 }), next); t += 100; next = Math.max(next, t + 60 + jit()); }
      r.sample(now, out);
      if (now > 3000) { frames++; if (r.evaluated.extrapolating) extrapolated++; }
    }
    const delay = r.delay;
    expect(delay).toBeGreaterThan(150 + 20);
    expect(delay).toBeLessThan(150 + 60);
    expect(r.renderLag).toBeCloseTo(60 + delay, -1);
    expect(extrapolated / frames).toBeLessThan(0.01);
  });
  it("a remote that came into view standing still doesn't drag its old sample's age along", () => {
    const r = remote(), out = createRemoteSample();
    r.pushWire(wire(1000, { x: 2 }), 61_000); // still since t = 1 s, in view at 61 s
    r.sample(61_000, out);
    expect(out.x).toBe(2);
    expect(r.renderLag).toBeGreaterThan(60_000);
    let t = 61_000;
    for (let now = 61_000; now < 62_000; now += 16) {
      while (t + 50 <= now) { t += 100; r.pushWire(wire(t, { x: 2 + (t - 61_000) / 1000, vx: 1 }), t + 50); }
      r.sample(now, out);
    }
    expect(r.renderLag).toBeLessThan(400);
    expect(out.x).toBeGreaterThan(2.3); // walking on the live path, not holding at the old spot
  });
  it("is clamped to INTERP_DELAY_MS", () => {
    const slow = remote(), out = createRemoteSample();
    for (let i = 0; i < 10; i++) slow.pushWire(wire(i * 380), i * 380); // 2.6 Hz
    slow.sample(4000, out);
    expect(slow.delay).toBe(INTERP_DELAY_MS.max);
    const fast = remote();
    for (let i = 0; i < 40; i++) fast.pushWire(wire(i * 30), i * 30);
    expect(fast.delay).toBe(INTERP_DELAY_MS.min);
  });
  it("slews: a sudden change in the path's length moves the render clock at 10% of real time", () => {
    const r = remote(), out = createRemoteSample();
    let t = 0;
    const lags: number[] = [];
    for (let now = 0; now < 8000; now += 16) {
      const transit = now < 3000 ? 40 : 240; // the path gets 200 ms longer at 3 s
      while (t + transit <= now) { r.pushWire(wire(t, { x: t / 1000, vx: 1 }), t + transit); t += 100; }
      r.sample(now, out);
      if (r.samples) lags.push(r.renderLag);
    }
    for (let i = 1; i < lags.length; i++) expect(Math.abs(lags[i] - lags[i - 1])).toBeLessThanOrEqual(16 * 0.1 + 1e-9);
    expect(lags[lags.length - 1]).toBeGreaterThan(lags[180] + 150);
  });
});

describe("slow state", () => {
  it("lands with the motion it came with: a seat's pose shows when the render time reaches the snap onto the seat", () => {
    const r = remote({ tp: 0 }), out = createRemoteSample();
    r.pushWire(wire(0, { x: 0 }), 0);
    r.pushWire(wire(100, { x: 0.4, vx: 4 }), 100);
    r.pushWire(wire(200, { x: 2, lift: 0.1 }, 1), 200); // the seat snap
    r.setPlayer(toRemotePlayer(netPlayer({ pose: "Sit", seat: "bench:b1#0" }), 0), 200);
    expect(r.player.pose).toBe("Sit"); // React sees it at once
    const shown: [number, string | null, boolean][] = [];
    for (let now = 200; now < 900; now += 10) {
      r.sample(now, out);
      shown.push([now - r.renderLag, out.pose, out.snapped]);
    }
    const first = shown.find(s => s[1] === "Sit")!;
    expect(first[0]).toBeGreaterThanOrEqual(200);
    expect(first[2]).toBe(true); // the same frame as the snap
    expect(shown.filter(s => s[0] < 200).every(s => s[1] === null)).toBe(true);
  });
  it("flags, held item and weapon travel the same way", () => {
    const r = remote(), out = createRemoteSample();
    r.pushWire(wire(0), 0);
    r.setPlayer(toRemotePlayer(netPlayer({ flags: FLAG.mobile | FLAG.armed, held: "rod:rod-2", weapon: "sword-driftwood" }), 0), 0);
    r.sample(1000, out);
    expect(out).toMatchObject({ flags: FLAG.mobile | FLAG.armed, held: "rod:rod-2", weapon: "sword-driftwood" });
  });
});

describe("netsim", () => {
  it("parses ?netsim=lat:120,jit:60,loss:0.03 and refuses anything else", () => {
    expect(parseNetsim("?netsim=lat:120,jit:60,loss:0.03")).toEqual({ lat: 120, jit: 60, loss: 0.03 });
    expect(parseNetsim("?bots=8&netsim=lat:80")).toEqual({ lat: 80, jit: 0, loss: 0 });
    for (const s of ["", "?netsim=", "?netsim=lat:-1", "?netsim=lat:x", "?netsim=loss:2", "?netsim=lag:10", "?netsim=lat"]) expect(parseNetsim(s), s).toBeNull();
  });
  it("stays smooth at lat 120, jit 60, loss 3%: a steady walk draws at a steady pace", () => {
    const sim = parseNetsim("?netsim=lat:120,jit:60,loss:0.03");
    const r = remote({}, sim), out = createRemoteSample();
    const speed = 7.4;
    let t = 0, px = NaN, smooth = 0, frames = 0;
    for (let now = 0; now < 20_000; now += 1000 / 60) {
      while (t <= now) { r.pushWire(wire(t, { x: -30 + (t / 1000) * speed * 0.2, vx: speed * 0.2 }), now); t += 100; }
      r.sample(now, out);
      if (now > 2000) {
        const step = (out.x - px) / (1000 / 60) * 1000;
        frames++;
        if (Math.abs(step - speed * 0.2) < speed * 0.2 * 0.25) smooth++;
      }
      px = out.x;
    }
    expect(smooth / frames).toBeGreaterThan(0.97);
  });
});

describe("no allocation on the frame path", () => {
  it("sample() writes into the caller's object and its preallocated event slots", () => {
    const r = remote(), out = createRemoteSample(), events = out.events, slots = [...out.events], keys = Object.keys(out).sort();
    for (let t = 0; t < 3000; t += 100) {
      r.pushWire(wire(t, { x: t / 100, vx: 10 }), t);
      r.pushEvent(t, EV.hop, 0, t);
    }
    for (let now = 0; now < 4000; now += 5) expect(r.sample(now, out)).toBe(out);
    expect(out.events).toBe(events);
    expect(out.events).toEqual(slots);
    out.events.forEach((e, i) => expect(e).toBe(slots[i]));
    expect(Object.keys(out).sort()).toEqual(keys);
  });
  it("the registry iterates with at(i) over a dense list, keyed by sid", () => {
    const reg = new Remotes(), seen: [RemoteChange, number][] = [];
    const off = reg.subscribe((c, e) => seen.push([c, e.sid]));
    const make = (sid: number) => new RemoteBuffer(sid, toRemotePlayer(netPlayer({ sid }), 0));
    const a = make(1), b = make(2), c = make(3);
    reg.add(a); reg.add(b); reg.add(c);
    expect(reg.size).toBe(3);
    expect(reg.get(2)).toBe(b);
    reg.remove(1);
    expect(reg.size).toBe(2);
    expect(new Set([reg.at(0), reg.at(1)])).toEqual(new Set([b, c]));
    reg.changed(b);
    reg.changed(a); // not in view: no news
    reg.add(b); // already there: no news
    reg.clear();
    off();
    reg.add(a);
    expect(seen).toEqual([["add", 1], ["add", 2], ["add", 3], ["remove", 1], ["change", 2], ["remove", 2], ["remove", 3]]);
    // A bad listener never stops the others.
    const reg2 = new Remotes();
    let ok = 0;
    reg2.subscribe(() => { throw new Error("boom"); });
    reg2.subscribe(() => { ok++; });
    const err = console.error;
    console.error = () => {};
    reg2.add(make(9));
    console.error = err;
    expect(ok).toBe(1);
  });
  it("sample on a remote with no motion yet leaves positions alone and fires nothing", () => {
    const r = remote(), out: RemoteSample = createRemoteSample();
    r.pushEvent(0, EV.jump, 0, 0);
    r.sample(100, out);
    expect(out.eventCount).toBe(0);
    expect(out.x).toBe(0);
  });
});
