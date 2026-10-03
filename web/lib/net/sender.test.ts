import { afterEach, describe, expect, it } from "vitest";
import { NO_INPUT, advanceMove, createMoveSim, createMoveState, interpolated, type MoveInput, type MoveSim, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import type { CharacterMotion } from "@/lib/game/character/clips";
import type { WheelItem } from "@/lib/game/toolWheel";
import { AFK_MS, EV, EV_KINDS, EV_MAX, PACKET_FLAG, SANITY, SEND, decodePose, hasFlag, moveIndex, type PosePacket, type Pose, type SlowState } from "./protocol";
import { Remotes, RemoteBuffer, type MotionWire } from "./interp";
import { toRemotePlayer, type NetSource, type NetStatus } from "./types";
import { registerLocalAvatar, unregisterLocalAvatar, type LocalAvatar } from "./localAvatar";
import { EVENT_MAX_AGE_MS, SLOW_GAP_MS, TELEPORT_FRAME, createSender, type SenderDeps, type SenderHints } from "./sender";

const FRAME = 1000 / 60;

/** A NetSource that records what it is sent; room time is the test's clock. */
function fakeSource() {
  const src = {
    joinSeq: 1, areaSeq: 0, epoch: 1_791_000_000_000,
    statusNow: { kind: "joined", shard: 1 } as NetStatus,
    clockNow: 0,
    packets: [] as PosePacket[],
    poses: [] as (Pose & { at: number })[],
    slows: [] as (SlowState & { at: number })[],
    remotes: new Remotes(),
    status() { return src.statusNow; },
    roster() { return []; },
    subscribe() { return () => {}; },
    now() { return src.clockNow; },
    sendPose(p: PosePacket) { src.packets.push(p); const d = decodePose(p)!; src.poses.push({ ...d, ev: [...d.ev], at: src.clockNow }); },
    sendSlow(s: SlowState) { src.slows.push({ ...s, at: src.clockNow }); },
    leave() {},
  };
  return src satisfies NetSource & SenderHints;
}

/** The world around the sender: a clock, the local avatar, combat and study state, window events, timers. */
function rig(o: { sim?: { current: MoveSim | null } } = {}) {
  const src = fakeSource();
  const motion = { current: { speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null } as CharacterMotion };
  const reg = registerLocalAvatar(motion, o.sim ?? null);
  const handlers = new Map<string, Set<(e: Event) => void>>(), timers: (() => void)[] = [];
  const world = { now: 0, combat: { armed: false, weapon: "sword-driftwood" }, study: { phase: null as string | null, endsAt: null as string | null, seated: null as { anchor: string; seat: number } | null } };
  const deps: SenderDeps = {
    clock: () => world.now,
    avatar: () => current,
    combat: () => world.combat,
    study: () => world.study,
    listen: (type, fn) => { const set = handlers.get(type) ?? new Set(); handlers.set(type, set); set.add(fn); return () => { set.delete(fn); }; },
    every: (_ms, fn) => { timers.push(fn); return () => { timers.splice(timers.indexOf(fn), 1); }; },
  };
  let current: LocalAvatar | null = reg;
  const sender = createSender(src, deps);
  const player = { x: 0, y: 0, z: 0 };
  const fire = (type: string, detail?: unknown) => { for (const fn of handlers.get(type) ?? []) fn(new CustomEvent(type, { detail })); };
  /** One frame: advance the clocks, move the player, tick. */
  const frame = (move?: (p: typeof player) => void, dt = FRAME) => {
    world.now += dt; src.clockNow = world.now;
    move?.(player);
    sender.tick(player, dt);
  };
  const run = (ms: number, move?: (p: typeof player, t: number) => void) => { for (const end = world.now + ms; world.now < end;) frame(p => move?.(p, world.now)); };
  cleanup.push(() => { sender.dispose(); unregisterLocalAvatar(reg); });
  return { src, motion, reg, world, sender, player, fire, frame, run, handlers, timers, setAvatar: (r: LocalAvatar | null) => { current = r; } };
}
const cleanup: (() => void)[] = [];
afterEach(() => { for (const c of cleanup.splice(0)) c(); });

const gaps = (poses: { t: number }[]) => poses.slice(1).map((p, i) => p.t - poses[i].t);
/** A slow-state message without the test's timestamp. */
const strip = (s: SlowState & { at: number }): SlowState => { const { at, ...rest } = s; void at; return rest; };

describe("rates (SEND)", () => {
  it("10 Hz walking on the ground, 15 Hz with a move state, never closer than 30 ms", () => {
    const r = rig();
    r.frame();
    const start = r.src.poses.length;
    r.run(3000, p => { p.x += 7.4 * FRAME / 1000; });
    const walk = r.src.poses.slice(start);
    expect(walk.length).toBeGreaterThanOrEqual(27);
    expect(walk.length).toBeLessThanOrEqual(31);
    for (const g of gaps(walk)) expect(g).toBeGreaterThanOrEqual(1000 / SEND.groundHz - 1);
    r.motion.current.move = "Air";
    const air0 = r.src.poses.length;
    r.run(2000, p => { p.x += 7.4 * FRAME / 1000; p.y = 1; });
    const air = r.src.poses.slice(air0 + 1);
    expect(air.length).toBeGreaterThanOrEqual(26);
    expect(air.length).toBeLessThanOrEqual(31);
    for (const g of gaps(air)) expect(g).toBeGreaterThanOrEqual(1000 / SEND.moveHz - 1);
    expect(air.every(p => p.move === moveIndex("Air"))).toBe(true);
  });
  it("one packet on stopping (velocity 0), then silence; moving again sends at once", () => {
    const r = rig();
    r.run(1000, p => { p.x += 5 * FRAME / 1000; });
    const before = r.src.poses.length;
    r.run(3000);
    const stop = r.src.poses.slice(before);
    expect(stop.length).toBe(1);
    expect([stop[0].vx, stop[0].vy, stop[0].vz]).toEqual([0, 0, 0]);
    r.frame(p => { p.x += 0.1; });
    r.frame(p => { p.x += 0.1; });
    expect(r.src.poses.length).toBe(before + 2); // the start went at once
    expect(r.src.poses[before + 1].t - stop[0].t).toBeGreaterThan(2900);
  });
  it("an event goes at once, 30 ms after the last send; more than EV_MAX wait for the next packet", () => {
    const r = rig();
    r.run(500); // still: the first packet and the stop are out
    const n = r.src.poses.length;
    r.motion.current.play = "Wave";
    r.frame();
    expect(r.src.poses.length).toBe(n + 1);
    expect(r.src.poses[n].ev.slice(0, 2)).toEqual([EV.play, "Wave"]);
    expect(r.src.poses[n].ev[2]).toBeLessThanOrEqual(Math.ceil(FRAME)); // written before this frame's tick
    // A burst: a dash's four and a hop's three in one frame.
    for (const c of ["Dash", "Jump"] as const) { r.motion.current.play = c; r.motion.current.play = null; }
    r.motion.current.ghost = true; r.motion.current.ghost = false;
    r.motion.current.stop = true; r.motion.current.stop = false;
    r.motion.current.upper = "CastForward_Staff"; r.motion.current.upper = null;
    r.frame();
    expect(r.src.poses.length).toBe(n + 1); // 16 ms after the Wave packet: waits for the 30 ms gap
    r.frame();
    const a = r.src.poses[n + 1];
    expect(a.ev.length).toBe(EV_MAX * 3);
    expect(a.t - r.src.poses[n].t).toBeGreaterThanOrEqual(SEND.eventGapMs);
    r.run(100);
    const all = r.src.poses.slice(n + 1).flatMap(p => p.ev.filter((_, i) => i % 3 === 0).map(k => EV_KINDS[k as number]));
    // Movement and clips before the afterimage: the low-priority one comes last.
    expect(all).toEqual(["play", "play", "stop", "upper", "ghost"]);
  });
  it("keeps under the room's `p` budget, and its events and emote budgets", () => {
    const r = rig();
    r.run(200);
    let emotes = 0;
    // An event every frame for 3 s while running: the sends come no faster than the room's bucket allows.
    r.run(3000, (p, t) => { p.x += 0.1; r.motion.current.play = Math.floor(t / FRAME) % 2 ? "Wave" : "Cheer"; r.motion.current.play = null; });
    const sends = r.src.poses.filter(p => p.at > 200);
    for (const p of sends) for (let i = 0; i < p.ev.length; i += 3) if (p.ev[i] === EV.play) emotes++;
    expect(sends.length).toBeLessThanOrEqual(3 * 20 + 30); // 20/s after a burst of 30
    expect(emotes).toBeLessThanOrEqual(4); // 1/s after a burst of 1
    const events = sends.reduce((n, p) => n + p.ev.length / 3, 0);
    expect(events).toBeLessThanOrEqual(3 * 8 + 8);
  });
  it("drops an event that waited past EVENT_MAX_AGE_MS", () => {
    const r = rig();
    r.run(200);
    r.src.statusNow = { kind: "reconnecting" };
    r.motion.current.play = "Laugh";
    r.run(EVENT_MAX_AGE_MS + 100);
    r.src.statusNow = { kind: "joined", shard: 1 };
    r.run(200);
    expect(r.src.poses.some(p => p.ev.includes("Laugh"))).toBe(false);
  });
  it("sends nothing while not joined", () => {
    const r = rig();
    r.src.statusNow = { kind: "connecting" };
    r.run(1000, p => { p.x += 0.1; });
    expect(r.src.poses.length + r.src.slows.length).toBe(0);
  });
});

describe("velocity", () => {
  it("by smoothed difference: a steady walk sends its speed; standing sends 0", () => {
    const r = rig();
    r.run(2000, p => { p.x += 7.4 * FRAME / 1000; p.z -= 2 * FRAME / 1000; });
    const last = r.src.poses[r.src.poses.length - 1];
    expect(last.vx).toBeCloseTo(7.4, 1);
    expect(last.vz).toBeCloseTo(-2, 1);
  });
});

describe("teleports", () => {
  it("a jump over 2.5 u in one frame flags the next sample, velocity 0", () => {
    const r = rig();
    r.run(500, p => { p.x += 0.05; });
    r.frame(p => { p.x += TELEPORT_FRAME + 0.5; });
    const p = r.src.poses[r.src.poses.length - 1];
    expect(hasFlag(p.flags, PACKET_FLAG.teleport)).toBe(true);
    expect([p.vx, p.vz]).toEqual([0, 0]);
  });
  it("the seat snap (tsi:sit, then the position jumps) flags; a re-pose on the same seat doesn't", () => {
    const r = rig();
    r.run(1000);
    r.fire("tsi:sit", { x: 1, z: 0, key: "bench:bench-1#0", clip: "Sit", seatY: 0.5 });
    r.frame(p => { p.x = 1.2; r.motion.current.pose = "Sit"; r.motion.current.lift = 0.344; });
    const snap = r.src.poses[r.src.poses.length - 1];
    expect(hasFlag(snap.flags, PACKET_FLAG.teleport)).toBe(true);
    expect(snap.lift).toBeCloseTo(0.344, 3);
    r.run(3000);
    const n = r.src.poses.length;
    r.fire("tsi:sit", { x: 1, z: 0, key: "bench:bench-1#0", clip: "Study" });
    r.frame(() => { r.motion.current.pose = "Study"; });
    r.run(500);
    expect(r.src.poses.slice(n).some(p => hasFlag(p.flags, PACKET_FLAG.teleport))).toBe(false);
  });
  it("a respawn (the sim's event) flags even a 1 u hop back to shore", () => {
    const flat: MoveWorld = { top: () => 0, wet: () => false };
    const sim = { current: createMoveSim(createMoveState(0, 0, flat)) as MoveSim | null };
    const r = rig({ sim });
    r.run(1000);
    // The sim's step writes its state: the respawn's event, as the splash ends.
    const respawned: MoveState = { ...sim.current!.state, x: 1, events: [{ kind: "respawn", x: 1, y: 0, z: 0, speed: 0, drop: 0 }] };
    r.frame(p => { sim.current!.state = respawned; p.x = 1; });
    const p = r.src.poses[r.src.poses.length - 1];
    expect(hasFlag(p.flags, PACKET_FLAG.teleport)).toBe(true);
    expect(p.ev).toContain(EV.respawn);
  });
  it("a new registration (a remount) that lands you elsewhere flags; within the budget only", () => {
    const r = rig();
    r.run(1000);
    const m2 = { current: { speed: 0, yaw: 0, lift: 0 } as CharacterMotion }, reg2 = registerLocalAvatar(m2);
    r.setAvatar(reg2);
    r.frame(p => { p.x += 1; });
    expect(hasFlag(r.src.poses[r.src.poses.length - 1].flags, PACKET_FLAG.teleport)).toBe(true);
    // Another within 2 s: the budget is spent, and a 1 u step 16 ms on would be struck plain: it waits, then goes
    // unflagged once the room would take it as a step.
    r.run(500);
    const n = r.src.poses.length;
    r.fire("tsi:sit", { x: 2, z: 0, key: "bench:bench-0#1" });
    r.frame(p => { p.x += 1; });
    r.run(200);
    const after = r.src.poses.slice(n);
    expect(after.length).toBeGreaterThan(0);
    expect(after.some(p => hasFlag(p.flags, PACKET_FLAG.teleport))).toBe(false);
    for (const p of after) {
      const prev = r.src.poses[r.src.poses.indexOf(p) - 1];
      expect(Math.hypot(p.x - prev.x, p.z - prev.z) / ((p.t - prev.t) / 1000)).toBeLessThanOrEqual(SANITY.speed);
    }
    unregisterLocalAvatar(reg2);
  });
  it("a far jump with the budget spent waits for the flag rather than being struck", () => {
    const r = rig();
    r.run(1000);
    r.frame(p => { p.x += 5; }); // flagged
    r.run(300);
    const n = r.src.poses.length;
    r.frame(p => { p.x += 10; });
    r.run(3000);
    const after = r.src.poses.slice(n);
    const first = after[0];
    expect(hasFlag(first.flags, PACKET_FLAG.teleport)).toBe(true);
    expect(first.t - r.src.poses[n - 1].t).toBeGreaterThan(SANITY.teleportGapMs - 400);
  });
  it("the first sample after a join or a door starts fresh: no flag, whatever the jump", () => {
    const r = rig();
    r.run(1000);
    r.src.areaSeq++;
    r.frame(p => { p.x = 30; p.z = -12; });
    const p = r.src.poses[r.src.poses.length - 1];
    expect(p.x).toBe(30);
    expect(p.flags).toBe(0);
  });
});

describe("slow state, on change only", () => {
  const rod: WheelItem = { id: "r", kind: "rod", key: "rod_flimsy", name: "Rod", icon: "" };
  it("everything once at join, then only what changes; everything again after a rejoin", () => {
    const r = rig();
    r.frame();
    expect(r.src.slows).toEqual([{ held: "", weapon: "", pose: "", seat: "", study: 0, studyEnds: 0, afk: false, at: r.world.now }]);
    r.run(2000);
    expect(r.src.slows.length).toBe(1);
    r.reg.held = rod;
    r.run(300);
    r.world.combat.armed = true;
    r.run(300);
    expect(r.src.slows.slice(1).map(strip)).toEqual([{ held: "rod:rod_flimsy" }, { weapon: "sword-driftwood" }]);
    // A weapon in hand isn't on your back.
    r.reg.held = { id: "w", kind: "weapon", key: "bow-willow", name: "Bow", icon: "" };
    r.run(300);
    expect(r.src.slows.slice(-1).map(strip)).toEqual([{ held: "weapon:bow-willow", weapon: "" }]);
    r.src.joinSeq++;
    r.run(300);
    expect(Object.keys(r.src.slows[r.src.slows.length - 1]).sort()).toEqual(["afk", "at", "held", "pose", "seat", "study", "studyEnds", "weapon"]);
  });
  it("a seat: the key tsi:sit brought while the pose is a seat clip; standing up gives it back", () => {
    const r = rig();
    r.run(500);
    r.fire("tsi:sit", { x: 1, z: 0, key: "bench:bench-1#1" });
    r.frame(() => { r.motion.current.pose = "Sit"; });
    r.run(300);
    expect(r.src.slows.slice(1).map(strip)).toEqual([{ pose: "Sit", seat: "bench:bench-1#1" }]);
    // PlayerAvatar's leaveSeat: motion.pose = null.
    r.frame(() => { r.motion.current.pose = null; });
    r.run(300);
    expect(r.src.slows.slice(2).map(strip)).toEqual([{ pose: "", seat: "" }]);
  });
  it("a study seat's key comes from the study state when tsi:sit names none; the phase and its end on the room timeline", () => {
    const r = rig();
    r.run(500);
    const ends = new Date(r.src.epoch + 1_500_000).toISOString();
    r.fire("tsi:sit", { x: 3, z: 4, clip: "Study", seatY: 0.4 });
    r.world.study = { phase: "focus", endsAt: ends, seated: { anchor: "study:cafe-two-1", seat: 2 } };
    r.frame(() => { r.motion.current.pose = "Study"; });
    r.run(300);
    expect(r.src.slows.slice(1).map(strip)).toEqual([{ pose: "Study", seat: "study:cafe-two-1#2", study: 2, studyEnds: 1_500_000 }]);
  });
  it("afk after AFK_MS without input, even with the tab hidden (no frames); input ends it", () => {
    const r = rig();
    r.frame();
    r.world.now += AFK_MS + 1000; // a hidden tab: no frames, only the slow poll
    for (const t of r.timers) t();
    expect(r.src.slows.slice(-1).map(strip)).toEqual([{ afk: true }]);
    r.fire("keydown");
    r.run(300);
    expect(r.src.slows.slice(-1).map(strip)).toEqual([{ afk: false }]);
  });
  it("at most one message every SLOW_GAP_MS: changes inside it go together", () => {
    const r = rig();
    r.frame();
    r.reg.held = rod;
    r.frame();
    r.world.combat.armed = true;
    r.frame();
    r.run(SLOW_GAP_MS);
    const later = r.src.slows.slice(1);
    expect(later.length).toBe(1);
    expect(later[0]).toMatchObject({ held: "rod:rod_flimsy", weapon: "sword-driftwood" });
  });
});

describe("the frame path", () => {
  it("reuses one packet, and does nothing while you stand still", () => {
    const r = rig();
    r.run(2000, p => { p.x += 0.1; });
    expect(new Set(r.src.packets).size).toBe(1);
    const n = r.src.poses.length, s = r.src.slows.length;
    r.run(1000);
    const after = r.src.poses.length;
    r.run(10_000);
    expect(r.src.poses.length).toBe(after); // the stop went in the first second, then silence
    expect(after - n).toBe(1);
    expect(r.src.slows.length).toBe(s);
  });
  it("dispose stops listening and lets the journal go", () => {
    const r = rig();
    r.frame();
    r.sender.dispose();
    for (const set of r.handlers.values()) expect(set.size).toBe(0);
    expect(r.timers.length).toBe(0);
    expect(Object.getOwnPropertyDescriptor(r.motion.current, "play")).toHaveProperty("writable", true);
  });
});

describe("through the wire: what a remote draws of a real jump", () => {
  it("the sender's samples of PlayerAvatar's path draw the jump within a few centimetres", () => {
    const flat: MoveWorld = { top: () => 0, wet: () => false };
    const sim = { current: createMoveSim(createMoveState(0, 0, flat)) as MoveSim | null };
    const r = rig({ sim });
    const path: { t: number; x: number; y: number; z: number }[] = [];
    let f = 0;
    r.run(2500, (p, t) => {
      const input: MoveInput = { ...NO_INPUT, x: 1, jump: f > 60 && f < 90, jumpPressed: f === 61 };
      advanceMove(sim.current!, input, FRAME / 1000, flat);
      [p.x, p.y, p.z] = interpolated(sim.current!);
      // PlayerAvatar's move state while airborne (15 Hz).
      r.motion.current.move = sim.current!.state.mode === "air" ? "Air" : null;
      path.push({ t, x: p.x, y: p.y, z: p.z });
      f++;
    });
    const remote = new RemoteBuffer(9, toRemotePlayer({ sid: 9, uid: "", name: "", badge: 0, look: "", level: 0, family: 0, kit: "", mastery: 0, aura: "", frame: 0,
      area: 0, flags: 0, held: "", weapon: "", pose: "", seat: "", study: 0, studyEnds: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, tp: 0 }, 0));
    let worst = 0, apex = -Infinity, k = 0;
    const airborne = path.filter(p => p.y > 0.02);
    for (const p of airborne) {
      // Samples arrive as the render time trails them (the ring holds the last eight).
      for (; k < r.src.poses.length && r.src.poses[k].t <= p.t + 200; k++) remote.pushWire(encodeBack(r.src.poses[k]), r.src.poses[k].t + 40);
      remote.evaluate(p.t);
      worst = Math.max(worst, Math.abs(remote.evaluated.y - p.y));
      apex = Math.max(apex, remote.evaluated.y);
    }
    const trueApex = Math.max(...path.map(p => p.y));
    expect(trueApex).toBeGreaterThan(1.2);
    expect(Math.abs(apex - trueApex)).toBeLessThan(0.02);
    expect(worst).toBeLessThan(0.08); // the take-off's corner, where the smoothed velocity lags a frame
  });
});

/** A decoded pose back to the schema's wire integers (what the room copies). */
function encodeBack(p: Pose): MotionWire {
  return { t: p.t, x: Math.round(p.x * 100), y: Math.round(p.y * 100), z: Math.round(p.z * 100), vx: Math.round(p.vx * 100), vy: Math.round(p.vy * 100),
    vz: Math.round(p.vz * 100), yaw: Math.round((p.yaw / (2 * Math.PI)) * 65536) % 65536, move: p.move, air: Math.round(p.air * 255), leaf: Math.round((p.leaf / 1.3) * 255),
    lift: Math.round(p.lift * 1000), tp: 0 };
}
