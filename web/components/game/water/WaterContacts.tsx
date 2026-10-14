"use client";

/**
 * Where things meet the island's water (v1 water item 3, specs/v1-drop.md §8c.2), for the scene: foam rings round the
 * map's rocks that stand in the water and round anyone wading in the swash (you and the other players), ripple rings
 * and a foam collar at the foot of every waterfall, and the shallows' edge for steps (juice.ts). The wharf's posts,
 * the moored boat and the seabed's rocks ring themselves (Wharf, Boat, Seabed). Everything is the map's or the
 * players' own position; the rings are drawn by the water (lib/game/foamRings.ts).
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleShore, type IslandMap, type ShoreSdf } from "@/lib/game/grid";
import { shoreFieldOf } from "@/lib/game/seabed";
import { foamRings, swashFoam, type FoamRings } from "@/lib/game/foamRings";
import { FALL_PERIOD, rippleDue, waterfallBases, waterfallRing, type WaterfallBase } from "@/lib/game/waterRipples";
import { setSwashProbe } from "@/lib/game/movement/juice";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { worldTime } from "@/lib/game/worldClock";
import { liveRemotes } from "../net/active";
import { useMoveParticles } from "../movement/moveFx";

/** A solid thing in the map (a rock): its centre and footprint radius. */
export interface Standing { x: number; z: number; r: number }
/** Waders ringed at most (you, then the nearest of the others as the network hands them over). */
const WADERS = 16;
/** Waterfalls ring and ripple within this of the view's focus. */
const FALL_REACH = 40;

type Waders = { handles: number[]; field: ShoreSdf; ground: (x: number, z: number) => number };
type Falls = { bases: readonly WaterfallBase[]; last: number; n: Int32Array };
const _eye = new THREE.Vector3(), _dir = new THREE.Vector3();

/** One frame (module scope: the react compiler forbids writing through hook values). */
function wade(rings: FoamRings, w: Waders, player: THREE.Vector3) {
  const at = (k: number, x: number, z: number, y: number | null) => {
    const shore = sampleShore(w.field, x, z);
    // In the air (a hop over the swash) the water closes behind you.
    const airborne = y !== null && y - w.ground(x, z) > 0.15;
    rings.move(w.handles[k], x, z);
    rings.set(w.handles[k], { strength: airborne ? 0 : swashFoam(shore) });
  };
  at(0, player.x, player.z, player.y);
  const n = Math.min(liveRemotes.n, WADERS - 1);
  for (let i = 0; i < n; i++) at(i + 1, liveRemotes.x[i], liveRemotes.z[i], null);
  for (let k = n + 1; k < WADERS; k++) rings.set(w.handles[k], { strength: 0 });
}
function fall(f: Falls, pool: ParticlePool, camera: THREE.Camera) {
  const t = worldTime(), t0 = f.last;
  f.last = t;
  if (!(t > t0) || t - t0 > 1) return;
  camera.getWorldPosition(_eye);
  camera.getWorldDirection(_dir);
  const k = _dir.y < -0.05 ? Math.min(-_eye.y / _dir.y, 60) : 60, fx = _eye.x + _dir.x * k, fz = _eye.z + _dir.z * k;
  for (let i = 0; i < f.bases.length; i++) {
    const b = f.bases[i];
    if (Math.hypot(b.x - fx, b.z - fz) > FALL_REACH || !rippleDue(t0, t, FALL_PERIOD, b.phase)) continue;
    waterfallRing(pool, b, f.n[i]++);
  }
}

export default function WaterContacts({ map, player, ground, rocks }: { map: IslandMap; player: RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; rocks: readonly Standing[] }) {
  const field = useMemo(() => shoreFieldOf(map), [map]);
  const bases = useMemo(() => waterfallBases(map), [map]);
  // The rocks standing in or at the water, and the foot of each fall: static rings.
  useEffect(() => {
    const handles = [
      ...rocks.filter(r => sampleShore(field, r.x, r.z) > -r.r - 0.3).map(r => foamRings.add(r.x, r.z, r.r * 0.85, 0.9)),
      ...bases.map(b => foamRings.add(b.x, b.z, 0.32, 1)),
    ];
    return () => handles.forEach(h => foamRings.remove(h));
  }, [rocks, bases, field]);
  // The waders' rings: registered once, moved and faded every frame.
  const waders = useRef<Waders | null>(null);
  useEffect(() => {
    const w: Waders = { handles: Array.from({ length: WADERS }, () => foamRings.add(0, 0, 0.17, 0)), field, ground };
    waders.current = w;
    return () => { w.handles.forEach(h => foamRings.remove(h)); waders.current = null; };
  }, [field, ground]);
  // Steps in the shallows ring the water (juice.ts footstep), on this map's edge.
  useEffect(() => {
    setSwashProbe((x, z) => sampleShore(field, x, z));
    return () => setSwashProbe(null);
  }, [field]);
  const fx = useMoveParticles();
  const falls = useRef<Falls | null>(null);
  useEffect(() => { falls.current = bases.length ? { bases, last: worldTime(), n: new Int32Array(bases.length) } : null; }, [bases]);
  useFrame(({ camera }) => {
    if (waders.current) wade(foamRings, waders.current, player.current);
    if (falls.current) fall(falls.current, fx.pool, camera);
  });
  return null;
}
