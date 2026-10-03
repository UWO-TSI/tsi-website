"use client";

/**
 * The other players in view (specs/multiplayer.md §5.4–§5.6): one RemoteAvatar each, driven by one frame loop at
 * priority -3 from the source's interpolated samples, as NPC.tsx drives the residents. React hears only about players
 * coming, going or changing card or slow state (the registry's add, remove and change), never about motion.
 *
 * Every quarter second (and at once when someone arrives) they're re-tiered by distance and the frustum (lod.ts) for
 * the graphics setting's caps: the anchor shows on drawn tiers, the sun shadow only at Full, and every frame the mixer
 * steps per tier (drive.ts gateMixer).
 *
 * Effects belong to the avatar that acted (look spec §7.1), at Full only: their footsteps' dust (the village and the
 * café), the juice of each move they made (fx.ts, 0.7 of yours), the dash's afterimage, and their class aura (at most
 * 8). Never a sound, a camera kick, a flash or slow motion for someone else's move.
 */
import { useEffect, useMemo, useSyncExternalStore, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { villageIsland } from "@/lib/game/defaultIsland";
import { village } from "@/lib/game/villageMap";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import type { Area } from "@/lib/net/protocol";
import type { NetSource } from "@/lib/net/types";
import { useMoveParticles, type MoveParticles } from "../movement/moveFx";
import { FLAT_GROUND, castSunShadows, driveRig, gateMixer, type GroundWorld, type JuiceSink } from "./drive";
import { remoteDashTrail, remoteJuice, type FxGround } from "./fx";
import { FULL, LOD, LOD_CAPS, assignLod, createLodScratch, type LodCaps, type LodEntry, type LodScratch } from "./lod";
import { RemoteAvatar } from "./RemoteAvatar";
import RemoteAuras, { AuraStore, showsAura } from "./RemoteAuras";
import { RigStore } from "./rigs";

/** Indoors (interiorShared's walker, PLAYER_SPEED) people walk at 4.6: the Walk clip keeps their pace there. */
const INDOOR_WALK = 4.6, WALK = 7.4;
const INDOORS: ReadonlySet<Area> = new Set<Area>(["hq", "museum", "oracle", "house"]);
/** Where footsteps throw dust and moves their juice: the village and the café (the rooms' own walkers throw none). */
const DUSTY: ReadonlySet<Area> = new Set<Area>(["village", "cafe"]);
const DRY: FxGround = { wet: () => false };
/** More than a shard ever holds (SHARD.max 40). */
const MAX = 64;

/** What remotes stand on in an area: the village's walk world; the rooms are flat. */
export const groundOf = (area: Area): GroundWorld => (area === "village" ? villageIsland(village()) : FLAT_GROUND);

/** The scene's movement particles (useMoveParticles), while this area throws any. */
interface Particles { current: MoveParticles | null }
/** Module scope: the react compiler forbids writing through a prop. */
function link(into: Particles, particles: MoveParticles) {
  into.current = particles;
  return () => { if (into.current === particles) into.current = null; };
}
function FxHost({ into }: { into: Particles }) {
  const particles = useMoveParticles();
  useEffect(() => link(into, particles), [into, particles]);
  return null;
}
/** Each movement event's juice, on the avatar that moved (module scope: no closure per frame). */
function juiceFor(particles: Particles, ground: FxGround): JuiceSink {
  return (r, e, i) => {
    const p = particles.current;
    if (!p) return;
    const s = r.sample, prev = i > 0 ? s.events[i - 1].kind : null, next = i + 1 < s.eventCount ? s.events[i + 1].kind : null;
    remoteJuice(p.pool, ground, r.fx, e.kind, typeof e.value === "number" ? e.value : 0, s, r.groundY, r.waterY, prev, next);
  };
}

interface Tiering { left: number; scratch: LodScratch; entries: LodEntry[]; frustum: THREE.Frustum; viewProj: THREE.Matrix4; body: THREE.Sphere }
const createTiering = (): Tiering => ({ left: 0, scratch: createLodScratch(MAX), entries: [], frustum: new THREE.Frustum(), viewProj: new THREE.Matrix4(),
  body: new THREE.Sphere(new THREE.Vector3(), 1.4) });

/** Tiers for everyone in view (lod.ts), then what they change: the sun shadow (re-applied below Full to catch late meshes) and the auras. */
function reTier(store: RigStore, t: Tiering, auras: AuraStore, camera: THREE.Camera, caps: LodCaps) {
  t.frustum.setFromProjectionMatrix(t.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const list = store.list, n = Math.min(list.length, MAX);
  for (let i = 0; i < n; i++) {
    const r = list[i], lod = r.lod, p = r.entry.player;
    t.body.center.set(r.sample.x, r.groundY + 0.7, r.sample.z);
    lod.inView = t.frustum.intersectsSphere(t.body);
    lod.phone = p.mobile;
    lod.hasAura = showsAura(p);
    t.entries[i] = lod;
  }
  assignLod(t.entries, n, caps, t.scratch);
  for (let i = 0; i < n; i++) {
    const r = list[i], a = r.anchor.current, full = r.lod.tier === FULL;
    if (!a || (full && r.casting === true)) continue;
    castSunShadows(a, full);
    r.casting = full;
  }
  auras.update(list);
}

/** The frame (module scope: the react compiler forbids writing through hook values). */
function driveAll(store: RigStore, t: Tiering, auras: AuraStore, source: NetSource, world: GroundWorld, juice: JuiceSink, particles: Particles,
  you: THREE.Vector3, camera: THREE.Camera, caps: LodCaps, delta: number) {
  const reg = source.remotes, now = source.now(), dt = Math.min(delta, 0.1), pool = particles.current?.pool;
  for (let i = 0; i < reg.size; i++) {
    const e = reg.at(i), r = store.map.get(e.sid);
    if (!r) continue;
    r.entry = e;
    const s = driveRig(r, now, world, juice);
    if (pool && r.lod.tier === FULL) remoteDashTrail(pool, r.fx, s, r.groundY, dt);
    r.lod.dist = Math.hypot(s.x - you.x, s.z - you.z);
  }
  t.left -= dt;
  if (t.left <= 0 || store.arrived) { t.left = LOD.every; store.arrived = false; reTier(store, t, auras, camera, caps); }
  const list = store.list;
  for (let i = 0; i < list.length; i++) gateMixer(list[i], dt);
}

export default function RemoteAvatars({ source, area, player }: { source: NetSource; area: Area; player: RefObject<THREE.Vector3> }) {
  const store = useMemo(() => new RigStore(source.remotes), [source]);
  useEffect(() => store.attach(), [store]);
  const rigs = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const world = useMemo(() => groundOf(area), [area]);
  const tiering = useMemo(() => createTiering(), []);
  const auras = useMemo(() => new AuraStore(), []);
  const [graphics] = useGraphicsSettings();
  const caps = graphics.liteMode ? LOD_CAPS.light : LOD_CAPS.high;
  const dusty = DUSTY.has(area), island = area === "village" ? villageIsland(village()) : undefined;
  const particles = useMemo<Particles>(() => ({ current: null }), []);
  const juice = useMemo(() => juiceFor(particles, island ?? DRY), [particles, island]);
  useFrame(({ camera }, delta) => driveAll(store, tiering, auras, source, world, juice, particles, player.current, camera, caps, delta), -3);
  const walk = INDOORS.has(area) ? INDOOR_WALK : WALK;
  return <>
    {rigs.map(r => <RemoteAvatar key={r.sid} rig={r} player={r.entry.player} walkSpeed={walk} dust={dusty} ground={island} />)}
    {dusty && <FxHost into={particles} />}
    <RemoteAuras store={auras} />
  </>;
}
