"use client";

/**
 * The sushi bar's life (game/sushi-bar; lib/game/sushiBar.ts; David's plan, specs/launch/sushi-bar.md): its hours (by
 * day the blinds down and the chef out on the landing; from the evening the blinds rolled up, the noren hung in the
 * entrance, the lanterns, string lights, neon and tank glowing and breathing a little like flame, the warm light it
 * throws on itself and its pier, HQ's faked pools, LampPools), the chef and the server at work behind the counter (the
 * café owner's station loop on the shared world clock, the shared rig and the staff's own clips: the nigiri appearing on
 * the chef's geta, the server carrying it to a stool, the served geta on the shelf), the first-person view while you sit on a stool
 * (the follow camera reads `viewRef`), and whether you're near enough, while it's open, for its music (`onNear`, the
 * music director's bar slots). The bar and its pier are still props, merged with the rest (DefaultIslandWorld
 * MergedModels); E at its entrance seats you (barSeat).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { type CharacterMotion, type ClipName } from "./character/Character";
import LampPools from "./hq/LampPools";
import { STAFF_URL, parseLook } from "@/lib/game/character/look";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow, worldTime } from "@/lib/game/worldClock";
import { OWNER_WALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import type { IslandPhase } from "@/lib/game/islandTime";
import { SUSHI_BAR_GETA_URL, SUSHI_BAR_GLOW_URL, SUSHI_BAR_HOURS_URL, SUSHI_BAR_ISLES_URL, SUSHI_KNIFE_URL } from "@/lib/game/propModels";
import { localAvatar } from "@/lib/net/localAvatar";
import { isSeatedPose } from "@/lib/game/seatPrompt";
import {
  BAR_MUSIC_IN, BAR_MUSIC_OUT, BAR_POOLS, CHEF_LOOK, CHEF_OUTSIDE, CHEF_STATIONS, HANDOFF, HOURS_TOP, PIECES, PREP_AT, SERVED_AT, SERVER, SERVER_LOOK,
  SERVE_S, STAFF_Y, STOOLS, barOpen, barPoint, prepAt, readingView, seatView, servedAt, stoolAt, type Bar, type BarStation, type BarView,
} from "@/lib/game/sushiBar";

/** The glow's brightness (in the evening a little under the night's), how fast it comes up or goes out (the lamps' ease, AmbientProps LAMP_RATE), and how fast the blinds roll. */
const GLOW = 1.5, EVENING = 0.8, RATE = 0.9, ROLL = 0.6;
/** The chef's knife, held as the workbench's hammer is (its own grip while he slices: Character USE_GRIPS SushiSlice). */
const KNIFE = { url: SUSHI_KNIFE_URL, hold: "hammer" } as const;
/** Where the server's hands hold a carried geta in HoldFront (build_clips.py hold_front, at CHARACTER_SCALE): over his feet, out in front. */
const HANDS = [0.5, 0.24] as const;
/** The served geta drawn instanced: one before each stool, and the one in the server's hands. */
const GETAS = STOOLS.length + 1;
/** The islands out to sea show once the glide into a stool is nearly done (the camera this near its eye): they are raised for the stool's view. */
const ISLES_NEAR = 1.5;
/** The staff are there (drawn, at work) only while you're this near the bar; a little further before they go. */
const STAFF_IN = 40, STAFF_OUT = 44;

/** Module scope (the react compiler forbids writing through hook values): the glow's materials and the pools' gain. */
function shine(mats: readonly THREE.MeshStandardMaterial[], pools: THREE.Object3D | null, level: number) {
  for (const m of mats) m.emissiveIntensity = GLOW * level;
  if (pools) for (const o of pools.children) { const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uGain; if (u) u.value = level; }
}
const show = (o: THREE.Object3D, on: boolean) => { o.visible = on; };
/** A board's geta (the hours model's prep-geta-<board>) and its nigiri (prep-<board>): the first `n` pieces through its meshes' draw range; -1, the geta gone. */
function setOut(prep: THREE.Object3D | undefined, geta: THREE.Object3D | undefined, n: number) {
  prep?.traverse(o => { const g = (o as THREE.Mesh).geometry; if (g) g.setDrawRange(0, ((g.index?.count ?? g.attributes.position.count) / PIECES) * Math.max(0, n)); });
  if (geta) geta.visible = n >= 0;
}
const at = new THREE.Matrix4(), hands = new THREE.Vector3(), spot = new THREE.Vector3(), turn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
function putGeta(meshes: readonly THREE.InstancedMesh[], n: number, x: number, y: number, z: number, yaw: number) {
  at.compose(spot.set(x, y, z), turn.setFromAxisAngle(UP, yaw), one);
  for (const m of meshes) m.setMatrixAt(n, at);
  return n + 1;
}
/**
 * The served geta on the shelf before each stool it's set at now, and the carried one where the server's hands are
 * (`carry`, unseen: none). Written only when the served set changes or while one is carried (`last`: what was written).
 */
function setGetas(meshes: readonly THREE.InstancedMesh[], open: boolean, t: number, carry: THREE.Object3D, last: { served: number; carried: boolean }) {
  let served = 0, n = 0;
  if (open) for (let i = 0; i < STOOLS.length; i++) if (servedAt(i, t)) served |= 1 << i;
  const carried = open && carry.visible;
  if (served === last.served && !carried && !last.carried) return;
  last.served = served; last.carried = carried;
  for (let i = 0; i < STOOLS.length; i++) if (served & (1 << i)) { const p = SERVED_AT[i]; n = putGeta(meshes, n, p[0], p[1], p[2], 0); }
  if (carried) n = putGeta(meshes, n, carry.position.x, carry.position.y, carry.position.z, carry.rotation.y);
  for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
}
/** The carried geta's place: taken up off a board's geta mid-reach, in the hands, slid onto the shelf before a stool mid-reach. */
function setCarry(carry: THREE.Object3D, held: boolean, x: number, z: number, yaw: number, s: BarStation | null, p: number) {
  carry.visible = held;
  if (!held) return;
  hands.set(x + Math.sin(yaw) * HANDS[1], STAFF_Y + HANDS[0], z + Math.cos(yaw) * HANDS[1]);
  const k = (u: number) => THREE.MathUtils.smoothstep(u, 0, 1);
  if (s?.board !== undefined) carry.position.lerpVectors(spot.set(...PREP_AT[s.board]), hands, k((p - HANDOFF) / 0.25));
  else if (s?.stool !== undefined) carry.position.lerpVectors(hands, spot.set(...SERVED_AT[s.stool]), k((p - HANDOFF + 0.25) / 0.25));
  else carry.position.copy(hands);
  carry.rotation.y = s ? 0 : yaw;
}
/** The blinds rolled up about their tops (1 open), the noren let down from the gate as they go. */
function hang(shutters: THREE.Object3D | undefined, noren: THREE.Object3D | undefined, open: number) {
  if (shutters) { shutters.scale.y = 1 - 0.96 * open; shutters.position.y = HOURS_TOP * (1 - shutters.scale.y); shutters.visible = open < 0.995; }
  if (noren) noren.visible = open > 0.6;
}

export default function SushiBar({ bar, y, player, phase, viewRef, onNear }: {
  bar: Bar; y: number; player: React.RefObject<THREE.Vector3>; phase: IslandPhase;
  /** Written each frame: the seated view while you sit at the bar, else null. */
  viewRef: { current: BarView | null };
  onNear: (near: boolean) => void;
}) {
  const open = barOpen(phase), level = phase === "night" ? 1 : EVENING;
  const glowGltf = useGLTF(SUSHI_BAR_GLOW_URL), hoursGltf = useGLTF(SUSHI_BAR_HOURS_URL), getaGltf = useGLTF(SUSHI_BAR_GETA_URL);
  const glow = useMemo(() => {
    const model = prepareModel(glowGltf.scene, SUSHI_BAR_GLOW_URL, 0), mats = new Set<THREE.MeshStandardMaterial>();
    model.traverse(o => { const m = (o as THREE.Mesh).material; if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) mats.add(m); });
    return { model, mats: [...mats] };
  }, [glowGltf.scene]);
  const hours = useMemo(() => {
    const model = prepareModel(hoursGltf.scene, SUSHI_BAR_HOURS_URL);
    const prep = [0, 1].map(i => model.getObjectByName(`prep-${i}`)), getas = [0, 1].map(i => model.getObjectByName(`prep-geta-${i}`));
    prep.forEach((p, i) => setOut(p, getas[i], 0));
    return { model, shutters: model.getObjectByName("shutters"), noren: model.getObjectByName("noren"), prep, getas };
  }, [hoursGltf.scene]);
  const getas = useMemo(() => {
    const model = prepareModel(getaGltf.scene, SUSHI_BAR_GETA_URL), group = new THREE.Group(), meshes: THREE.InstancedMesh[] = [];
    model.updateMatrixWorld(true);
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material, GETAS);
      im.count = 0; im.frustumCulled = false; im.castShadow = m.castShadow;
      meshes.push(im); group.add(im);
    });
    return { model, group, meshes, carry: new THREE.Object3D() };
  }, [getaGltf.scene]);
  useEffect(() => () => disposeModelMaterials(glow.model), [glow]);
  useEffect(() => () => disposeModelMaterials(hours.model), [hours]);
  useEffect(() => () => { getas.meshes.forEach(m => m.geometry.dispose()); disposeModelMaterials(getas.model); }, [getas]);
  const pools = useRef<THREE.Group>(null);
  const [seated, setSeated] = useState(false), [staffOn, setStaffOn] = useState(false);
  const s = useRef({
    on: 0, open: open ? 1 : 0, near: false, staff: false, stool: -1, prep: [NaN, NaN], getas: { served: -1, carried: false },
    seat: { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } } as BarView,
    base: { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } } as BarView,
    /** The menu in your hands (tsi:bar-menu): 0 down on the counter, 1 picked up; `read` its target. */
    reading: 0, read: 0,
  });
  useEffect(() => {
    const on = (e: Event) => { s.current.read = (e as CustomEvent<boolean>).detail ? 1 : 0; };
    window.addEventListener("tsi:bar-menu", on);
    return () => window.removeEventListener("tsi:bar-menu", on);
  }, []);
  useEffect(() => () => { viewRef.current = null; }, [viewRef]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1), st = s.current, t = worldTime(), p = player.current, now = worldNow() / 1000;
    st.on = THREE.MathUtils.damp(st.on, open ? level : 0, RATE, dt);
    st.open = THREE.MathUtils.damp(st.open, open ? 1 : 0, ROLL, dt);
    // A flame's slow breath (David: "lights should breath like fire"), two slow waves so it never reads as a pulse.
    shine(glow.mats, pools.current, st.on * (0.88 + 0.07 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3 + 1.1)));
    hang(hours.shutters, hours.noren, st.open);
    for (let b = 0; b < hours.prep.length; b++) {
      const n = open ? prepAt(b, now) : 0;
      if (n !== st.prep[b]) { st.prep[b] = n; setOut(hours.prep[b], hours.getas[b], n); }
    }
    setGetas(getas.meshes, open, now, getas.carry, st.getas);
    const d = Math.hypot(p.x - bar.x, p.z - bar.z), near = open && (st.near ? d < BAR_MUSIC_OUT : d < BAR_MUSIC_IN);
    if (near !== st.near) { st.near = near; onNear(near); }
    const staff = d < (st.staff ? STAFF_OUT : STAFF_IN);
    if (staff !== st.staff) { st.staff = staff; setStaffOn(staff); }
    const i = d < STAFF_IN && isSeatedPose(localAvatar()?.motion.current?.pose) ? stoolAt(bar, p.x, p.z) : -1;
    if ((i >= 0) !== (st.stool >= 0)) setSeated(i >= 0);
    if (i !== st.stool && i >= 0) {
      const { eye, look } = seatView(STOOLS[i]), [ex, ez] = barPoint(bar, eye[0], eye[2]), [lx, lz] = barPoint(bar, look[0], look[2]);
      Object.assign(st.base.eye, { x: ex, y: y + eye[1], z: ez });
      Object.assign(st.base.look, { x: lx, y: y + look[1], z: lz });
    }
    st.stool = i;
    st.reading = THREE.MathUtils.damp(st.reading, i >= 0 ? st.read : 0, 6, dt);
    readingView(st.base, st.reading, st.seat);
    viewRef.current = i < 0 ? null : st.seat;
  });
  useEffect(() => () => onNear(false), [onNear]);
  // Seated: the world shows the menu on the counter (f-sushi; DefaultIslandWorld listens).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("tsi:bar-seated", { detail: seated }));
    return () => { window.dispatchEvent(new CustomEvent("tsi:bar-seated", { detail: false })); };
  }, [seated]);
  return <group position={[bar.x, y, bar.z]} rotation={[0, bar.yaw ?? 0, 0]}>
    <primitive object={glow.model} />
    <primitive object={hours.model} />
    {seated && <Suspense fallback={null}><Isles viewRef={viewRef} /></Suspense>}
    <group ref={pools}><LampPools pools={BAR_POOLS} gain={0} /></group>
    <primitive object={getas.group} />
    {staffOn && <Staff look={CHEF_LOOK} stations={CHEF_STATIONS} outside={open ? null : CHEF_OUTSIDE} />}
    {staffOn && open && <Staff look={SERVER_LOOK} stations={SERVER.stations} offset={-SERVER.start} carry={getas.carry} />}
  </group>;
}

/** The islands out to sea, for the seated view alone (loaded the first time you sit): shown once the glide in is nearly done. */
function Isles({ viewRef }: { viewRef: { current: BarView | null } }) {
  const gltf = useGLTF(SUSHI_BAR_ISLES_URL);
  const model = useMemo(() => { const m = prepareModel(gltf.scene, SUSHI_BAR_ISLES_URL); m.visible = false; return m; }, [gltf.scene]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  useFrame(({ camera }) => {
    const c = camera.position, e = viewRef.current?.eye;
    show(model, !!e && Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z) < ISLES_NEAR);
  });
  return <primitive object={model} />;
}

/**
 * One of the staff, in the bar's frame: at work on their station loop on the world clock (cafe.ts ownerAt, `offset`
 * on from the chef's), each station's clip held as a pose; or, while it's closed, standing `outside`. The chef holds
 * his knife while he slices. The server carries the geta (`carry`, placed in the bar's frame): taken up mid-reach at a
 * board, held out in front (HoldFront) along the lane, slid onto the shelf mid-reach before a stool.
 */
function Staff({ look: raw, stations, offset = 0, outside = null, carry }: {
  look: unknown; stations: readonly BarStation[]; offset?: number; outside?: { at: readonly [number, number]; yaw: number } | null;
  carry?: THREE.Object3D;
}) {
  const look = useMemo(() => parseLook(raw), [raw]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const [knife, setKnife] = useState(false);
  const r = useRef<{ pose: OwnerPose; station: number; since: number }>({ pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, station: -1, since: 0 });
  // Gone (far off, or closing): nothing left in their hands.
  useEffect(() => () => { if (carry) carry.visible = false; }, [carry]);
  useFrame((_, raw) => {
    const o = r.current, m = motion.current, dt = Math.min(raw, 0.1), now = worldNow() / 1000;
    if (outside) {
      m.pose = null; m.hold = null; m.speed = 0; m.yaw = easeFacing(m.yaw, outside.yaw, 6, dt);
      group.current?.position.set(outside.at[0], 0.04, outside.at[1]);
      if (o.station !== -1) { o.station = -1; setKnife(false); }
      if (carry) setCarry(carry, false, 0, 0, 0, null, 0);
      return;
    }
    const at = ownerAt(now + offset, stations, o.pose), s = stations[at.station], here = at.moving ? null : s;
    const station = here ? at.station : -1;
    if (station !== o.station) {
      o.station = station; o.since = now;
      if ((here?.clip === "SushiSlice") !== knife) setKnife(here?.clip === "SushiSlice");
    }
    m.pose = here?.clip.startsWith("Sushi") ? (here.clip as ClipName) : null;
    m.speed = at.moving ? OWNER_WALK : 0;
    m.yaw = easeFacing(m.yaw, at.yaw, 6, dt);
    group.current?.position.set(at.x, STAFF_Y, at.z);
    if (!carry) return;
    // The geta: taken up at a board mid-reach, carried out in front (HoldFront) along the lane, set down before a stool mid-reach.
    const p = here ? (now - o.since) / SERVE_S : 0;
    const held = here ? (here.board !== undefined ? p >= HANDOFF : here.stool !== undefined && p < HANDOFF) : s.board !== undefined || (!!s.carry && s.stool === undefined);
    m.hold = held && !here ? "HoldFront" : null;
    setCarry(carry, held, at.x, at.z, m.yaw, here, p);
  });
  return <group ref={group}><Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} held={knife ? KNIFE : null} clips={STAFF_URL} /></Suspense></group>;
}
