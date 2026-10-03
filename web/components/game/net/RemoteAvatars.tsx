"use client";

/**
 * The other players in view (specs/multiplayer.md §5.4, §5.5): one RemoteAvatar each, driven by one frame loop at
 * priority -3 from the source's interpolated samples, as NPC.tsx drives the residents. React hears only about players
 * coming, going or changing card or slow state (the registry's add, remove and change), never about motion.
 *
 * Every quarter second (and at once when someone arrives) they're re-tiered by distance and the frustum (lod.ts) for
 * the graphics setting's caps: the anchor shows on drawn tiers, the sun shadow only at Full, and every frame the mixer
 * steps per tier (drive.ts gateMixer).
 */
import { useEffect, useMemo, useSyncExternalStore, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { villageIsland } from "@/lib/game/defaultIsland";
import { village } from "@/lib/game/villageMap";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import type { Area } from "@/lib/net/protocol";
import type { NetSource } from "@/lib/net/types";
import { FLAT_GROUND, castSunShadows, driveRig, gateMixer, type GroundWorld } from "./drive";
import { FULL, LOD, LOD_CAPS, assignLod, createLodScratch, type LodCaps, type LodEntry, type LodScratch } from "./lod";
import { RemoteAvatar } from "./RemoteAvatar";
import { RigStore } from "./rigs";

/** Indoors (interiorShared's walker, PLAYER_SPEED) people walk at 4.6: the Walk clip keeps their pace there. */
const INDOOR_WALK = 4.6, WALK = 7.4;
const INDOORS: ReadonlySet<Area> = new Set<Area>(["hq", "museum", "oracle", "house"]);
/** More than a shard ever holds (SHARD.max 40). */
const MAX = 64;

/** What remotes stand on in an area: the village's walk world; the rooms are flat. */
export const groundOf = (area: Area): GroundWorld => (area === "village" ? villageIsland(village()) : FLAT_GROUND);

interface Tiering { left: number; scratch: LodScratch; entries: LodEntry[]; frustum: THREE.Frustum; viewProj: THREE.Matrix4; body: THREE.Sphere }
const createTiering = (): Tiering => ({ left: 0, scratch: createLodScratch(MAX), entries: [], frustum: new THREE.Frustum(), viewProj: new THREE.Matrix4(),
  body: new THREE.Sphere(new THREE.Vector3(), 1.4) });

/** Tiers for everyone in view (lod.ts), then what they change: the sun shadow, re-applied below Full to catch late meshes. */
function reTier(store: RigStore, t: Tiering, camera: THREE.Camera, caps: LodCaps) {
  t.frustum.setFromProjectionMatrix(t.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const list = store.list, n = Math.min(list.length, MAX);
  for (let i = 0; i < n; i++) {
    const r = list[i], lod = r.lod;
    t.body.center.set(r.sample.x, r.groundY + 0.7, r.sample.z);
    lod.inView = t.frustum.intersectsSphere(t.body);
    lod.phone = r.entry.player.mobile;
    t.entries[i] = lod;
  }
  assignLod(t.entries, n, caps, t.scratch);
  for (let i = 0; i < n; i++) {
    const r = list[i], a = r.anchor.current, full = r.lod.tier === FULL;
    if (!a || (full && r.casting === true)) continue;
    castSunShadows(a, full);
    r.casting = full;
  }
}

/** The frame (module scope: the react compiler forbids writing through hook values). */
function driveAll(store: RigStore, t: Tiering, source: NetSource, world: GroundWorld, you: THREE.Vector3, camera: THREE.Camera, caps: LodCaps, delta: number) {
  const reg = source.remotes, now = source.now(), dt = Math.min(delta, 0.1);
  for (let i = 0; i < reg.size; i++) {
    const e = reg.at(i), r = store.map.get(e.sid);
    if (!r) continue;
    r.entry = e;
    const s = driveRig(r, now, world, null);
    r.lod.dist = Math.hypot(s.x - you.x, s.z - you.z);
  }
  t.left -= dt;
  if (t.left <= 0 || store.arrived) { t.left = LOD.every; store.arrived = false; reTier(store, t, camera, caps); }
  const list = store.list;
  for (let i = 0; i < list.length; i++) gateMixer(list[i], dt);
}

export default function RemoteAvatars({ source, area, player }: { source: NetSource; area: Area; player: RefObject<THREE.Vector3> }) {
  const store = useMemo(() => new RigStore(source.remotes), [source]);
  useEffect(() => store.attach(), [store]);
  const rigs = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const world = useMemo(() => groundOf(area), [area]);
  const tiering = useMemo(() => createTiering(), []);
  const [graphics] = useGraphicsSettings();
  const caps = graphics.liteMode ? LOD_CAPS.light : LOD_CAPS.high;
  useFrame(({ camera }, delta) => driveAll(store, tiering, source, world, player.current, camera, caps, delta), -3);
  const walk = INDOORS.has(area) ? INDOOR_WALK : WALK;
  return <>{rigs.map(r => <RemoteAvatar key={r.sid} rig={r} player={r.entry.player} walkSpeed={walk} />)}</>;
}
