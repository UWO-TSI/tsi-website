"use client";

/**
 * The sushi bar's life (game/sushi-bar; lib/game/sushiBar.ts): what glows at night (its lanterns, string lights, neon and
 * tank, breathing a little like flame) and the warm light it throws on itself (HQ's faked pools, LampPools), the two
 * chefs at work behind the counter (the café owner's station loop on the shared world clock, the shared rig, no names),
 * the seated view while you sit on a stool (the follow camera reads `viewRef`), and whether you're near enough for its
 * music (`onNear`, the music director's "bar" slot). The bar itself is a still prop, merged with the rest
 * (DefaultIslandWorld MergedModels); its stools are seats in the island's prompt (barSeat).
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
import { OWNER_WALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import { SUSHI_BAR_GLOW_URL } from "@/lib/game/propModels";
import { localAvatar } from "@/lib/net/localAvatar";
import { isSeatedPose } from "@/lib/game/seatPrompt";
import { BAR_MUSIC_IN, BAR_MUSIC_OUT, BAR_POOLS, CHEF_LOOKS, CHEF_STATIONS, STOOLS, barPoint, seatView, stoolAt, type Bar, type BarView } from "@/lib/game/sushiBar";

/** The glow's night brightness, and how fast it comes up or goes out (the lamps' ease, AmbientProps LAMP_RATE). */
const GLOW = 1.5, RATE = 0.9;

/** Module scope (the react compiler forbids writing through hook values): the glow's materials and the pools' gain. */
function shine(mats: readonly THREE.MeshStandardMaterial[], pools: THREE.Object3D | null, level: number) {
  for (const m of mats) m.emissiveIntensity = GLOW * level;
  pools?.traverse(o => { const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uGain; if (u) u.value = level; });
}

export default function SushiBar({ bar, y, player, night, viewRef, onNear }: {
  bar: Bar; y: number; player: React.RefObject<THREE.Vector3>; night: boolean;
  /** Written each frame: the seated view while you sit at the bar, else null. */
  viewRef: { current: BarView | null };
  onNear: (near: boolean) => void;
}) {
  const { scene } = useGLTF(SUSHI_BAR_GLOW_URL);
  const glow = useMemo(() => {
    const model = prepareModel(scene, SUSHI_BAR_GLOW_URL, 0), mats = new Set<THREE.MeshStandardMaterial>();
    model.traverse(o => { const m = (o as THREE.Mesh).material; if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) mats.add(m); });
    return { model, mats: [...mats] };
  }, [scene]);
  useEffect(() => () => disposeModelMaterials(glow.model), [glow]);
  const pools = useRef<THREE.Group>(null);
  const s = useRef({ on: 0, near: false, seat: { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } } as BarView });
  useEffect(() => () => { viewRef.current = null; }, [viewRef]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1), st = s.current, t = worldTime(), p = player.current;
    st.on = THREE.MathUtils.damp(st.on, night ? 1 : 0, RATE, dt);
    // A flame's slow breath (David: "lights should breath like fire"), two slow waves so it never reads as a pulse.
    shine(glow.mats, pools.current, st.on * (0.88 + 0.07 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3 + 1.1)));
    const d = Math.hypot(p.x - bar.x, p.z - bar.z), near = st.near ? d < BAR_MUSIC_OUT : d < BAR_MUSIC_IN;
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
    <group ref={pools}><LampPools pools={BAR_POOLS} gain={0} /></group>
    {CHEF_STATIONS.map((_, i) => <Chef key={i} i={i} />)}
  </group>;
}

/** A chef at work behind the counter, in the bar's frame: the station loop (cafe.ts ownerAt), Trace at the board, a reach under the counter. */
function Chef({ i }: { i: number }) {
  const look = useMemo(() => parseLook(CHEF_LOOKS[i]), [i]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const r = useRef<{ pose: OwnerPose; station: number }>({ pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, station: -1 });
  useFrame((_, raw) => {
    const o = r.current, m = motion.current;
    // Each on their own loop: offset so the two never move together.
    const at = ownerAt(worldNow() / 1000 + i * 9.5, CHEF_STATIONS[i], o.pose), station = at.moving ? -1 : at.station;
    if (station >= 0 && station !== o.station && at.clip === "Forage") m.play = "Forage";
    o.station = station;
    m.pose = !at.moving && at.clip === "Trace" ? "Trace" : null;
    m.speed = at.moving ? OWNER_WALK : 0;
    m.yaw = easeFacing(m.yaw, at.yaw, 6, Math.min(raw, 0.1));
    group.current?.position.set(at.x, 0.06, at.z);
  });
  return <group ref={group}><Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} /></Suspense></group>;
}
