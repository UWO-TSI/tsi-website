import { act, createElement, useRef } from "react";
import { reconciler } from "@react-three/fiber";
import { afterEach, describe, expect, it } from "vitest";
import { NO_INPUT, STEP, advanceMove, createMoveSim, createMoveState, type MoveInput, type MoveSim, type MoveWorld } from "@/lib/game/movement/sim";
import { isLoop, type CharacterMotion, type ClipName } from "@/lib/game/character/clips";
import type { WheelItem } from "@/lib/game/toolWheel";
import { EV, EV_KINDS } from "./protocol";
import { armJournal, clearJournal, drainJournal, journalSize, keepArmed, localAvatar, registerLocalAvatar, unregisterLocalAvatar, useLocalAvatarTap, JOURNAL, type LocalAvatar } from "./localAvatar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const motionRef = () => ({ current: { speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null } as CharacterMotion });
const drained = () => { const out: [string, number | string][] = []; drainJournal((k, v) => out.push([EV_KINDS[k], v])); return out; };
const isData = (o: object, key: string) => { const d = Object.getOwnPropertyDescriptor(o, key); return !!d && "value" in d && d.writable === true; };
/** Character's consumption of the one-shots (Puppet.update in components/game/character/Character.tsx). */
function consume(m: CharacterMotion) {
  if (m.ghost) m.ghost = false;
  if (m.stop) m.stop = false;
  if (m.play && isLoop(m.play)) { m.pose = m.play; m.play = null; }
  if (m.play) m.play = null;
  if (m.upper) m.upper = null;
}

let regs: LocalAvatar[] = [];
const disarms: (() => void)[] = [];
afterEach(() => {
  for (const d of disarms.splice(0)) d();
  for (const r of regs.splice(0)) unregisterLocalAvatar(r);
  clearJournal();
});
const reg = (m = motionRef(), sim: { current: MoveSim | null } | null = null) => { const r = registerLocalAvatar(m, sim); regs.push(r); return r; };
const arm = () => { const d = armJournal(); disarms.push(d); return d; };

describe("the tap is passive", () => {
  it("registering installs nothing: plain properties, nothing journaled", () => {
    const m = motionRef(), sim = { current: createMoveSim(createMoveState(0, 0, { top: () => 0, wet: () => false })) };
    reg(m, sim);
    expect(localAvatar()?.motion).toBe(m);
    for (const k of ["play", "upper", "ghost", "stop"]) expect(isData(m.current, k) || !(k in m.current)).toBe(true);
    expect(isData(sim, "current")).toBe(true);
    expect(isData(sim.current!, "state")).toBe(true);
    m.current.play = "Wave";
    expect(journalSize().count).toBe(0);
  });
  it("the latest registration still mounted is the local avatar; each one counts a generation", () => {
    const a = reg(), b = reg();
    expect(b.generation).toBe(a.generation + 1);
    expect(localAvatar()).toBe(b);
    unregisterLocalAvatar(b);
    expect(localAvatar()).toBe(a);
    unregisterLocalAvatar(a);
    expect(localAvatar()).toBeNull();
  });
});

describe("the one-shot journal", () => {
  it("catches a direct assignment, an Object.assign and a later null clear, once each, and still hands Character the clip", () => {
    const m = motionRef();
    reg(m);
    arm();
    m.current.play = "Wave";
    expect(m.current.play).toBe("Wave"); // Character still reads it
    consume(m.current);
    expect(m.current.play).toBeNull();
    // useWorldClips' set(): Object.assign(motion.current, patch)
    Object.assign(m.current, { play: "CastSwing", pose: "FishHold" } satisfies Partial<CharacterMotion>);
    expect(m.current.play).toBe("CastSwing");
    Object.assign(m.current, { play: null, pose: "HoldUp" });
    expect(drained()).toEqual([["play", "Wave"], ["play", "CastSwing"]]);
    m.current.play = null; // a clear is never a one-shot
    expect(drained()).toEqual([]);
  });
  it("upper, ghost and stop too; a write repeated before Character takes it is one", () => {
    const m = motionRef();
    reg(m);
    arm();
    m.current.upper = "CastForward_Staff";
    m.current.ghost = true;
    m.current.ghost = true;
    m.current.stop = true;
    m.current.play = "Jump";
    m.current.play = "Jump";
    consume(m.current);
    m.current.ghost = true;
    m.current.play = "Dance"; // a loop: Character holds it as a pose; it was still a one-shot ask
    consume(m.current);
    expect(m.current.pose).toBe("Dance");
    expect(drained()).toEqual([["upper", "CastForward_Staff"], ["ghost", 0], ["stop", 0], ["play", "Jump"], ["ghost", 0], ["play", "Dance"]]);
  });
  it("a full ring drops its oldest", () => {
    const m = motionRef();
    reg(m);
    arm();
    for (let i = 0; i < JOURNAL + 5; i++) { m.current.play = (i % 2 ? "Wave" : "Cheer") as ClipName; }
    expect(journalSize()).toEqual({ count: JOURNAL, dropped: 5 });
  });
  it("follows a new registration while armed, and lets the old one go", () => {
    const a = motionRef(), b = motionRef();
    reg(a);
    arm();
    const rb = reg(b);
    expect(isData(a.current, "play")).toBe(true);
    b.current.play = "Laugh";
    a.current.play = "Sad";
    expect(drained()).toEqual([["play", "Laugh"]]);
    unregisterLocalAvatar(rb);
    a.current.play = "Cheer";
    expect(drained()).toEqual([["play", "Cheer"]]);
  });
});

const flat: MoveWorld = { top: () => 0, wet: () => false };
/** A run, a jump and its landing, a dash and a slide, driven like PlayerAvatar at `fps`. */
function drive(sim: { current: MoveSim | null }, fps: number, world: MoveWorld = flat, frames = Math.round(fps * 3)) {
  const all: string[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const input: MoveInput = { ...NO_INPUT, x: 1, sprint: t > 0.3, jump: t > 0.5 && t < 0.9, jumpPressed: Math.abs(t - 0.5) < 0.5 / fps,
      dashPressed: Math.abs(t - 1.6) < 0.5 / fps, sneak: t > 2.1 && t < 2.6 };
    if (!sim.current) sim.current = createMoveSim(createMoveState(0, 0, world));
    for (const e of advanceMove(sim.current, input, 1 / fps, world)) if (e.kind !== "recover") all.push(e.kind);
  }
  return all;
}

describe("the movement journal (PlayerAvatar's sim)", () => {
  it("catches every step's events at any frame rate, with the landing's drop", () => {
    for (const fps of [144, 60, 30, 12]) {
      const plain = { current: null as MoveSim | null }, expected = drive(plain, fps);
      const sim = { current: null as MoveSim | null };
      const r = reg(motionRef(), sim);
      const off = arm();
      const got: [string, number | string][] = [];
      // Drained a few times along the way, as sends do.
      const events = drive(sim, fps);
      drainJournal((k, v) => got.push([EV_KINDS[k], v]));
      expect(events).toEqual(expected); // journaling changes nothing the sim does
      expect(got.map(g => g[0])).toEqual(expected);
      expect(got.some(([k]) => k === "jump") && got.some(([k]) => k === "dash") && got.some(([k]) => k === "slide")).toBe(true);
      const land = got.find(([k]) => k === "land")!;
      expect(land[1]).toBeGreaterThan(0.4); // the drop from the jump's top (a long jump at a sprint: 0.5 u)
      expect(r.simSwaps).toBe(1); // PlayerAvatar's first createMoveSim
      off();
      unregisterLocalAvatar(r);
      regs = regs.filter(x => x !== r);
    }
  });
  it("follows PlayerAvatar swapping its sim (a seat left, a respawn) and counts the swaps", () => {
    const sim = { current: createMoveSim(createMoveState(0, 0, flat)) as MoveSim | null };
    const r = reg(motionRef(), sim);
    arm();
    const old = sim.current!;
    sim.current = createMoveSim(createMoveState(3, 0, flat));
    expect(r.simSwaps).toBe(1);
    expect(isData(old, "state")).toBe(true); // the old one is let go
    advanceMove(sim.current, { ...NO_INPUT, jump: true, jumpPressed: true }, STEP * 2, flat);
    expect(drained().map(e => e[0])).toContain("jump");
  });
});

describe("disarming", () => {
  it("puts plain properties back with their values, after the last sender only", () => {
    const m = motionRef(), sim = { current: createMoveSim(createMoveState(0, 0, flat)) as MoveSim | null };
    reg(m, sim);
    const one = arm(), two = arm();
    m.current.play = "Wave";
    advanceMove(sim.current!, { ...NO_INPUT, x: 1 }, 0.1, flat);
    const state = sim.current!.state;
    one();
    expect(isData(m.current, "play")).toBe(false); // the second sender still journals
    two();
    two(); // twice is harmless
    expect(isData(m.current, "play") && isData(m.current, "upper") && isData(m.current, "ghost") && isData(m.current, "stop")).toBe(true);
    expect(m.current.play).toBe("Wave");
    expect(isData(sim, "current")).toBe(true);
    expect(isData(sim.current!, "state")).toBe(true);
    expect(sim.current!.state).toBe(state);
    expect(journalSize().count).toBe(0);
    m.current.play = "Cheer";
    advanceMove(sim.current!, { ...NO_INPUT, jump: true, jumpPressed: true }, 0.1, flat);
    expect(journalSize().count).toBe(0);
  });
  it("in the middle of a step (the sender disposed while PlayerAvatar's sim runs): the step lands, plainly", () => {
    let calls = 0, off: (() => void) | null = null;
    // The world's ground query runs inside stepMove: dispose from there, between a step's start and its state write.
    const world: MoveWorld = { top: () => { if (++calls === 4000 && off) { off(); off = null; } return 0; }, wet: () => false };
    const plain = { current: null as MoveSim | null }, expected = drive(plain, 60, world, 180);
    calls = 0;
    const sim = { current: null as MoveSim | null };
    reg(motionRef(), sim);
    off = armJournal();
    const events = drive(sim, 60, world, 180);
    expect(off).toBeNull(); // it fired mid-run
    expect(events).toEqual(expected);
    expect(isData(sim, "current")).toBe(true);
    expect(isData(sim.current!, "state")).toBe(true);
    expect(sim.current!.state.x).toBeCloseTo(plain.current!.state.x, 12);
    expect(journalSize().count).toBe(0);
  });
  it("keepArmed moves the accessors to a motion object swapped under the ref", () => {
    const m = motionRef();
    reg(m);
    arm();
    const fresh = { speed: 0, yaw: 0, lift: 0, play: null } as CharacterMotion;
    m.current = fresh;
    keepArmed();
    fresh.play = "Wave";
    expect(drained()).toEqual([["play", "Wave"]]);
  });
});

describe("the cost on the sim's hot path", () => {
  it("is a getter and a setter per 1/120 s step (measured, reported)", () => {
    const run = (armed: boolean) => {
      const sim = { current: createMoveSim(createMoveState(0, 0, flat)) as MoveSim | null };
      const r = registerLocalAvatar(motionRef(), sim);
      const off = armed ? armJournal() : null;
      const input: MoveInput = { ...NO_INPUT, x: 1, sprint: true };
      const t0 = performance.now();
      for (let i = 0; i < 20_000; i++) {
        advanceMove(sim.current!, input, STEP, flat); // one step a call
        if (i % 4 === 0) drainJournal(() => {});
      }
      const ms = performance.now() - t0;
      off?.();
      unregisterLocalAvatar(r);
      return (ms * 1e6) / 20_000; // ns per step
    };
    run(false); run(true); // warm up
    // Alternated, the best of seven each: the machine's other load hits both alike.
    let plain = Infinity, armed = Infinity;
    for (let i = 0; i < 7; i++) { plain = Math.min(plain, run(false)); armed = Math.min(armed, run(true)); }
    console.info(`[localAvatar] advanceMove per 1/120 s step: ${plain.toFixed(0)} ns plain, ${armed.toFixed(0)} ns journaled (+${(armed - plain).toFixed(0)} ns)`);
    expect(armed - plain).toBeLessThan(2000);
  });
});

describe("useLocalAvatarTap", () => {
  function Player({ held }: { held: WheelItem | null }) {
    const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, play: null });
    const sim = useRef<MoveSim | null>(null);
    useLocalAvatarTap(motion, held, sim);
    return null;
  }
  it("registers on mount with the item in hand, follows it, and lets go on unmount", async () => {
    const errors: unknown[] = [], err = (e: unknown) => { errors.push(e); };
    const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
    const root = create({}, 1, null, false, null, "", err, err, err, null);
    const rod: WheelItem = { id: "rod", kind: "rod", key: "rod_flimsy", name: "Rod", icon: "" };
    await act(async () => { reconciler.updateContainer(createElement(Player, { held: rod }), root, null, null); });
    const me = localAvatar();
    expect(me?.held).toEqual(rod);
    expect(me?.sim).not.toBeNull();
    await act(async () => { reconciler.updateContainer(createElement(Player, { held: null }), root, null, null); });
    expect(localAvatar()).toBe(me);
    expect(me?.held).toBeNull();
    await act(async () => { reconciler.updateContainer(null, root, null, null); });
    expect(localAvatar()).toBeNull();
    expect(errors).toEqual([]);
    expect(EV.play).toBe(0);
  });
});
