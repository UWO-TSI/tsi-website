import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { villageIsland } from "@/lib/game/defaultIsland";
import { village } from "@/lib/game/villageMap";
import { createLoopback } from "@/lib/net/loopback";
import type { RemoteEvent } from "@/lib/net/types";
import { driveRig, gateMixer, knownClip, type RemoteRig } from "./drive";
import { FULL, HIDDEN, LOD_CAPS, assignLod, createLodScratch, type LodEntry } from "./lod";
import { RigStore } from "./rigs";

/**
 * The driver against the real thing: client core's `?bots=N` loopback (the bot brain on the movement sim, the
 * contract's codec, the interpolation buffer) for 20 s of 60 fps frames, everything the renderer does but the GPU.
 */
describe("24 loopback bots through the driver", () => {
  it("places every bot on the floor, plays only known clips, sits the seated still, and keeps the tiers' caps", () => {
    let now = 0;
    const lb = createLoopback({ bots: 24, seed: 7, clock: () => now, timer: false });
    lb.start("village");
    const store = new RigStore(lb.remotes), stop = store.attach(), world = villageIsland(village());
    const scratch = createLodScratch(64), entries: LodEntry[] = [], kinds = new Map<string, number>(), unknown: string[] = [];
    let seatedFrames = 0, maxShown = 0;
    const juice = (_r: RemoteRig, e: RemoteEvent) => { kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1); };
    for (const r of store.list) r.anchor.current = new THREE.Group();
    for (let f = 0; f < 60 * 20; f++) {
      now += 1000 / 60;
      lb.advance(now);
      for (const r of store.list) r.anchor.current ??= new THREE.Group();
      for (let i = 0; i < lb.remotes.size; i++) {
        const e = lb.remotes.at(i), r = store.map.get(e.sid)!;
        r.entry = e;
        const s = driveRig(r, lb.now(), world, juice);
        for (let k = 0; k < s.eventCount; k++) {
          const ev = s.events[k];
          if (ev.kind === "play" || ev.kind === "upper") { kinds.set(ev.kind, (kinds.get(ev.kind) ?? 0) + 1); if (!knownClip(ev.value)) unknown.push(String(ev.value)); }
        }
        r.lod.dist = Math.hypot(s.x, s.z);
        r.lod.inView = true;
        expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z) && Number.isFinite(r.groundY), `bot ${e.sid}`).toBe(true);
        expect(r.groundY).toBeLessThanOrEqual(s.y + 1e-9);
        expect(r.anchor.current!.position.y).toBe(r.groundY);
        if (r.seated) {
          seatedFrames++;
          expect(r.motion.speed).toBe(0);
          expect(r.motion.lift).toBe(s.lift);
        } else expect(r.motion.lift).toBeGreaterThanOrEqual(0);
      }
      if (f % 15 === 0) {
        const list = store.list;
        list.forEach((r, i) => { entries[i] = r.lod; r.lod.phone = r.entry.player.mobile; });
        assignLod(entries, list.length, LOD_CAPS.high, scratch);
        const full = list.filter(r => r.lod.tier === FULL).length, drawn = list.filter(r => r.lod.tier !== HIDDEN).length;
        expect(full).toBeLessThanOrEqual(12);
        expect(drawn).toBeLessThanOrEqual(24);
        maxShown = Math.max(maxShown, drawn);
      }
      for (const r of store.list) gateMixer(r, 1 / 60);
    }
    // The driver's own cost, timed apart from the checks above: 10 s more of frames, sampling and gating only.
    let driveMs = 0, frames = 0;
    for (let f = 0; f < 600; f++) {
      now += 1000 / 60;
      lb.advance(now);
      const t0 = performance.now();
      for (let i = 0; i < lb.remotes.size; i++) { const e = lb.remotes.at(i), r = store.map.get(e.sid)!; r.entry = e; driveRig(r, lb.now(), world, juice); }
      for (const r of store.list) gateMixer(r, 1 / 60);
      driveMs += performance.now() - t0;
      frames++;
    }
    stop();
    lb.stop();
    // Stopped, the store lets every rig go; the walkers, runners, sliders, gliders, sitters and emoters all came through.
    expect(store.list.length).toBe(0);
    expect(unknown).toEqual([]);
    expect(seatedFrames).toBeGreaterThan(0);
    expect(maxShown).toBeGreaterThan(0);
    for (const kind of ["play", "jump", "land"]) expect(kinds.get(kind) ?? 0, kind).toBeGreaterThan(0);
    // The driver's own cost (no GPU, no mixer): a small part of the spec's 3 ms for 24 drawn.
    expect(driveMs / frames).toBeLessThan(1);
    console.info(`driver: ${(driveMs / frames).toFixed(3)} ms/frame for ${lb.bots.length} bots; events ${JSON.stringify(Object.fromEntries(kinds))}; seated frames ${seatedFrames}`);
  });
});
