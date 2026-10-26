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
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { type CharacterMotion } from "./character/Character";
import LampPools from "./hq/LampPools";
import { CLIP_BY_NAME, parseLook } from "@/lib/game/character/look";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow, worldTime } from "@/lib/game/worldClock";
import { OWNER_WALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import type { IslandPhase } from "@/lib/game/islandTime";
import { SUSHI_BAR_GLOW_URL, SUSHI_BAR_HOURS_URL, SUSHI_BAR_ISLES_URL, SUSHI_KNIFE_URL } from "@/lib/game/propModels";
import { localAvatar } from "@/lib/net/localAvatar";
import { isSeatedPose } from "@/lib/game/seatPrompt";
import {
  BAR_MUSIC_IN, BAR_MUSIC_OUT, BAR_POOLS, CHEF_LOOK, CHEF_OUTSIDE, CHEF_STATIONS, HOURS_TOP, SERVER_LOOK, SERVER_STATIONS, STAFF_Y, STOOLS,
  barOpen, barPoint, seatView, stoolAt, type Bar, type BarStation, type BarView,
} from "@/lib/game/sushiBar";

/** The glow's brightness (in the evening a little under the night's), how fast it comes up or goes out (the lamps' ease, AmbientProps LAMP_RATE), and how fast the blinds roll. */
const GLOW = 1.5, EVENING = 0.8, RATE = 0.9, ROLL = 0.6;
/** The chef's knife, held as the workbench's hammer is; one Craft clip, one stroke of slicing; the nigiri a geta holds. */
const KNIFE = { url: SUSHI_KNIFE_URL, hold: "hammer" } as const, CRAFT_S = CLIP_BY_NAME.get("Craft")?.length ?? 2.6, PIECES = 4;
/** The islands out to sea show once the glide into a stool is nearly done (the camera this near its eye): they are raised for the stool's view. */
const ISLES_NEAR = 1.5;

/** Module scope (the react compiler forbids writing through hook values): the glow's materials and the pools' gain. */
function shine(mats: readonly THREE.MeshStandardMaterial[], pools: THREE.Object3D | null, level: number) {
  for (const m of mats) m.emissiveIntensity = GLOW * level;
  pools?.traverse(o => { const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uGain; if (u) u.value = level; });
}
const show = (o: THREE.Object3D, on: boolean) => { o.visible = on; };
/** The nigiri on a geta (the hours model's prep-<board>): its first `n` pieces, through its meshes' draw range. */
function setOut(prep: THREE.Object3D | undefined, n: number) {
  prep?.traverse(o => { const g = (o as THREE.Mesh).geometry; if (g) g.setDrawRange(0, ((g.index?.count ?? g.attributes.position.count) / PIECES) * n); });
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
  const glowGltf = useGLTF(SUSHI_BAR_GLOW_URL), hoursGltf = useGLTF(SUSHI_BAR_HOURS_URL), islesGltf = useGLTF(SUSHI_BAR_ISLES_URL);
  const glow = useMemo(() => {
    const model = prepareModel(glowGltf.scene, SUSHI_BAR_GLOW_URL, 0), mats = new Set<THREE.MeshStandardMaterial>();
    model.traverse(o => { const m = (o as THREE.Mesh).material; if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) mats.add(m); });
    return { model, mats: [...mats] };
  }, [glowGltf.scene]);
  const hours = useMemo(() => {
    const model = prepareModel(hoursGltf.scene, SUSHI_BAR_HOURS_URL);
    const prep = [0, 1].map(i => model.getObjectByName(`prep-${i}`));
    prep.forEach(p => setOut(p, 0));
    return { model, shutters: model.getObjectByName("shutters"), noren: model.getObjectByName("noren"), prep };
  }, [hoursGltf.scene]);
  const isles = useMemo(() => { const model = prepareModel(islesGltf.scene, SUSHI_BAR_ISLES_URL); model.visible = false; return model; }, [islesGltf.scene]);
  useEffect(() => () => disposeModelMaterials(glow.model), [glow]);
  useEffect(() => () => disposeModelMaterials(hours.model), [hours]);
  useEffect(() => () => disposeModelMaterials(isles), [isles]);
  const pools = useRef<THREE.Group>(null);
  const s = useRef({ on: 0, open: open ? 1 : 0, near: false, seat: { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } } as BarView });
  useEffect(() => () => { viewRef.current = null; }, [viewRef]);
  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.1), st = s.current, t = worldTime(), p = player.current;
    st.on = THREE.MathUtils.damp(st.on, open ? level : 0, RATE, dt);
    st.open = THREE.MathUtils.damp(st.open, open ? 1 : 0, ROLL, dt);
    // A flame's slow breath (David: "lights should breath like fire"), two slow waves so it never reads as a pulse.
    shine(glow.mats, pools.current, st.on * (0.88 + 0.07 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3 + 1.1)));
    hang(hours.shutters, hours.noren, st.open);
    const d = Math.hypot(p.x - bar.x, p.z - bar.z), near = open && (st.near ? d < BAR_MUSIC_OUT : d < BAR_MUSIC_IN);
    if (near !== st.near) { st.near = near; onNear(near); }
    const i = isSeatedPose(localAvatar()?.motion.current?.pose) ? stoolAt(bar, p.x, p.z) : -1;
    if (i < 0) { viewRef.current = null; show(isles, false); return; }
    const { eye, look } = seatView(STOOLS[i]), [ex, ez] = barPoint(bar, eye[0], eye[2]), [lx, lz] = barPoint(bar, look[0], look[2]);
    Object.assign(st.seat.eye, { x: ex, y: y + eye[1], z: ez });
    Object.assign(st.seat.look, { x: lx, y: y + look[1], z: lz });
    viewRef.current = st.seat;
    const c = camera.position, e = st.seat.eye;
    show(isles, Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z) < ISLES_NEAR);
  });
  useEffect(() => () => onNear(false), [onNear]);
  return <group position={[bar.x, y, bar.z]} rotation={[0, bar.yaw ?? 0, 0]}>
    <primitive object={glow.model} />
    <primitive object={hours.model} />
    <primitive object={isles} />
    <group ref={pools}><LampPools pools={BAR_POOLS} gain={0} /></group>
    <Staff look={CHEF_LOOK} stations={CHEF_STATIONS} outside={open ? null : CHEF_OUTSIDE} prep={hours.prep} />
    {open && <Staff look={SERVER_LOOK} stations={SERVER_STATIONS} offset={9.5} />}
  </group>;
}

/**
 * One of the staff, in the bar's frame: at work on their station loop (cafe.ts ownerAt; Trace at the board, a reach
 * under the counter), each on their own `offset` so they never move together; or, while it's closed, standing `outside`.
 * At a Craft station the chef slices, his knife in hand, a stroke each clip; at a Trace station with a `board` he sets
 * its nigiri on the geta one by one (`prep`, cleared as he starts slicing there again).
 */
function Staff({ look: raw, stations, offset = 0, outside = null, prep }: {
  look: unknown; stations: readonly BarStation[]; offset?: number; outside?: { at: readonly [number, number]; yaw: number } | null;
  prep?: readonly (THREE.Object3D | undefined)[];
}) {
  const look = useMemo(() => parseLook(raw), [raw]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const [knife, setKnife] = useState(false);
  const r = useRef<{ pose: OwnerPose; station: number; since: number; stroke: number }>({ pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, station: -1, since: 0, stroke: -Infinity });
  useEffect(() => { if (outside) prep?.forEach(p => setOut(p, 0)); }, [outside, prep]);
  useFrame((_, raw) => {
    const o = r.current, m = motion.current, dt = Math.min(raw, 0.1), now = worldNow() / 1000;
    if (outside) {
      m.pose = null; m.speed = 0; m.yaw = easeFacing(m.yaw, outside.yaw, 6, dt);
      group.current?.position.set(outside.at[0], 0.04, outside.at[1]);
      if (o.station !== -1) { o.station = -1; setKnife(false); }
      return;
    }
    const at = ownerAt(now + offset, stations, o.pose), station = at.moving ? -1 : at.station, s = stations[station];
    if (station !== o.station) {
      o.since = now; o.stroke = -Infinity;
      if (s?.clip === "Forage") m.play = "Forage";
      if (s?.clip === "Craft" && s.board !== undefined) setOut(prep?.[s.board], 0);
      if ((s?.clip === "Craft") !== knife) setKnife(s?.clip === "Craft");
    }
    o.station = station;
    if (s?.clip === "Craft" && now - o.stroke >= CRAFT_S) { m.play = "Craft"; o.stroke = now; }
    if (s?.clip === "Trace" && s.board !== undefined) setOut(prep?.[s.board], Math.min(PIECES, 1 + Math.floor(((now - o.since) / s.stay) * PIECES)));
    m.pose = s?.clip === "Trace" ? "Trace" : null;
    m.speed = at.moving ? OWNER_WALK : 0;
    m.yaw = easeFacing(m.yaw, at.yaw, 6, dt);
    group.current?.position.set(at.x, STAFF_Y, at.z);
  });
  return <group ref={group}><Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} held={knife ? KNIFE : null} /></Suspense></group>;
}
