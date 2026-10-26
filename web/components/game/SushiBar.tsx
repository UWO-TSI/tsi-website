"use client";

/**
 * The sushi bar's life (game/sushi-bar; lib/game/sushiBar.ts; David's plan, specs/launch/sushi-bar.md): its hours (by
 * day the blinds down and the chef out on the landing; from the evening the blinds rolled up, the noren hung in the
 * entrance, the lanterns, string lights, neon and tank glowing and breathing a little like flame, the warm light it
 * throws on itself and its pier, HQ's faked pools, LampPools), the chef and the server at work behind the counter (the
 * café owner's station loop on the shared world clock, the shared rig), the first-person view while you sit on a stool
 * (the follow camera reads `viewRef`), and whether you're near enough, while it's open, for its music (`onNear`, the
 * music director's bar slots). The bar and its pier are still props, merged with the rest (DefaultIslandWorld
 * MergedModels); E at its entrance seats you (barSeat).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { type CharacterMotion } from "./character/Character";
import LampPools from "./hq/LampPools";
import { parseLook } from "@/lib/game/character/look";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow, worldTime } from "@/lib/game/worldClock";
import { OWNER_WALK, ownerAt, type OwnerPose, type OwnerStation } from "@/lib/game/cafe";
import type { IslandPhase } from "@/lib/game/islandTime";
import { SUSHI_BAR_GLOW_URL, SUSHI_BAR_HOURS_URL } from "@/lib/game/propModels";
import { localAvatar } from "@/lib/net/localAvatar";
import { isSeatedPose } from "@/lib/game/seatPrompt";
import {
  BAR_MUSIC_IN, BAR_MUSIC_OUT, BAR_POOLS, CHEF_LOOK, CHEF_OUTSIDE, CHEF_STATIONS, HOURS_TOP, SERVER_LOOK, SERVER_STATIONS, STAFF_Y, STOOLS,
  barOpen, barPoint, seatView, stoolAt, type Bar, type BarView,
} from "@/lib/game/sushiBar";

/** The glow's brightness (in the evening a little under the night's), how fast it comes up or goes out (the lamps' ease, AmbientProps LAMP_RATE), and how fast the blinds roll. */
const GLOW = 1.5, EVENING = 0.8, RATE = 0.9, ROLL = 0.6;

/** Module scope (the react compiler forbids writing through hook values): the glow's materials and the pools' gain. */
function shine(mats: readonly THREE.MeshStandardMaterial[], pools: THREE.Object3D | null, level: number) {
  for (const m of mats) m.emissiveIntensity = GLOW * level;
  pools?.traverse(o => { const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uGain; if (u) u.value = level; });
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
  const glowGltf = useGLTF(SUSHI_BAR_GLOW_URL), hoursGltf = useGLTF(SUSHI_BAR_HOURS_URL);
  const glow = useMemo(() => {
    const model = prepareModel(glowGltf.scene, SUSHI_BAR_GLOW_URL, 0), mats = new Set<THREE.MeshStandardMaterial>();
    model.traverse(o => { const m = (o as THREE.Mesh).material; if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) mats.add(m); });
    return { model, mats: [...mats] };
  }, [glowGltf.scene]);
  const hours = useMemo(() => {
    const model = prepareModel(hoursGltf.scene, SUSHI_BAR_HOURS_URL);
    return { model, shutters: model.getObjectByName("shutters"), noren: model.getObjectByName("noren") };
  }, [hoursGltf.scene]);
  useEffect(() => () => disposeModelMaterials(glow.model), [glow]);
  useEffect(() => () => disposeModelMaterials(hours.model), [hours]);
  const pools = useRef<THREE.Group>(null);
  const s = useRef({ on: 0, open: open ? 1 : 0, near: false, seat: { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } } as BarView });
  useEffect(() => () => { viewRef.current = null; }, [viewRef]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1), st = s.current, t = worldTime(), p = player.current;
    st.on = THREE.MathUtils.damp(st.on, open ? level : 0, RATE, dt);
    st.open = THREE.MathUtils.damp(st.open, open ? 1 : 0, ROLL, dt);
    // A flame's slow breath (David: "lights should breath like fire"), two slow waves so it never reads as a pulse.
    shine(glow.mats, pools.current, st.on * (0.88 + 0.07 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3 + 1.1)));
    hang(hours.shutters, hours.noren, st.open);
    const d = Math.hypot(p.x - bar.x, p.z - bar.z), near = open && (st.near ? d < BAR_MUSIC_OUT : d < BAR_MUSIC_IN);
    if (near !== st.near) { st.near = near; onNear(near); }
    const i = isSeatedPose(localAvatar()?.motion.current?.pose) ? stoolAt(bar, p.x, p.z) : -1;
    if (i < 0) { viewRef.current = null; return; }
    const { eye, look } = seatView(STOOLS[i]), [ex, ez] = barPoint(bar, eye[0], eye[2]), [lx, lz] = barPoint(bar, look[0], look[2]);
    Object.assign(st.seat.eye, { x: ex, y: y + eye[1], z: ez });
    Object.assign(st.seat.look, { x: lx, y: y + look[1], z: lz });
    viewRef.current = st.seat;
  });
  useEffect(() => () => onNear(false), [onNear]);
  return <group position={[bar.x, y, bar.z]} rotation={[0, bar.yaw ?? 0, 0]}>
    <primitive object={glow.model} />
    <primitive object={hours.model} />
    <group ref={pools}><LampPools pools={BAR_POOLS} gain={0} /></group>
    <Staff look={CHEF_LOOK} stations={CHEF_STATIONS} outside={open ? null : CHEF_OUTSIDE} />
    {open && <Staff look={SERVER_LOOK} stations={SERVER_STATIONS} offset={9.5} />}
  </group>;
}

/**
 * One of the staff, in the bar's frame: at work on their station loop (cafe.ts ownerAt; Trace at the board, a reach
 * under the counter), each on their own `offset` so they never move together; or, while it's closed, standing `outside`.
 */
function Staff({ look: raw, stations, offset = 0, outside = null }: {
  look: unknown; stations: readonly OwnerStation[]; offset?: number; outside?: { at: readonly [number, number]; yaw: number } | null;
}) {
  const look = useMemo(() => parseLook(raw), [raw]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const r = useRef<{ pose: OwnerPose; station: number }>({ pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, station: -1 });
  useFrame((_, raw) => {
    const o = r.current, m = motion.current, dt = Math.min(raw, 0.1);
    if (outside) {
      m.pose = null; m.speed = 0; m.yaw = easeFacing(m.yaw, outside.yaw, 6, dt);
      group.current?.position.set(outside.at[0], 0.04, outside.at[1]);
      return;
    }
    const at = ownerAt(worldNow() / 1000 + offset, stations, o.pose), station = at.moving ? -1 : at.station;
    if (station >= 0 && station !== o.station && at.clip === "Forage") m.play = "Forage";
    o.station = station;
    m.pose = !at.moving && at.clip === "Trace" ? "Trace" : null;
    m.speed = at.moving ? OWNER_WALK : 0;
    m.yaw = easeFacing(m.yaw, at.yaw, 6, dt);
    group.current?.position.set(at.x, STAFF_Y, at.z);
  });
  return <group ref={group}><Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} /></Suspense></group>;
}
