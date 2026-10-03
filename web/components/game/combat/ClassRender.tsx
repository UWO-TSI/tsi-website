"use client";

/**
 * What classes v2's shared primitives put in the world (lib/game/combat/primitives.ts), drawn cheaply: the skeleton
 * army instanced (one draw per model part however many rise), clones on the character rig with your look, the form you
 * shifted into (a mob's body, the Chimera fused from all five), stone walls rising from the floor, the Joker's mirror
 * sweeping the field over a path of inverted colour, the corpses a Necromancer can raise, and a shimmer where you stand
 * unseen. Effects (sparks, smoke, decals) are CombatFx's from FX events.
 */
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { type CharacterMotion, type ClipName } from "../character/Character";
import { useMyLook } from "@/lib/game/character/lookStore";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { ALLY_BODIES, corpse, signaturePaint } from "@/lib/game/combat/primitives";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";
import { partPose, type PartPose } from "@/lib/game/combat/telegraph";
import type { EnemyType } from "@/lib/game/combat/contract";
import type { Enemy } from "@/lib/game/combat/sim";
import { EnemyInstances } from "./EncounterRender";

type Ground = (x: number, z: number) => number;
const SKELETON = ALLY_BODIES["skeleton-warrior"];

export default function ClassRender({ ground, player, lite = false }: { ground: Ground; player: React.RefObject<THREE.Vector3>; lite?: boolean }) {
  const kit = useCombatValue(() => combat.rt.v2?.kit.key ?? "");
  return <>
    <Walls ground={ground} />
    <Shimmer ground={ground} player={player} />
    <Suspense fallback={null}>
      {kit === "necromancer" && <><EnemyInstances typeId={SKELETON.id} type={SKELETON} capacity={lite ? 32 : 48} ground={ground} allies /><Corpses ground={ground} /></>}
      {kit === "illusionist" && <><Clones ground={ground} /><Mirrors ground={ground} /></>}
      {kit === "transmuter" && <FormBody ground={ground} player={player} />}
    </Suspense>
  </>;
}

// ── Clones: your look on the rig, moving as their minds say, copying your casts ──
function Clones({ ground }: { ground: Ground }) {
  const ids = useCombatValue(() => combat.rt.units.filter(u => u.def.kind === "clone").map(u => u.id).join(","));
  return <>{ids ? ids.split(",").map(id => <CloneBody key={id} id={Number(id)} ground={ground} />) : null}</>;
}
function CloneBody({ id, ground }: { id: number; ground: Ground }) {
  const { look } = useMyLook();
  const group = useRef<THREE.Group>(null), motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const key = useCombatValue(() => combat.rt.player.weapon), w = WEAPONS[key];
  const weapon = useMemo(() => (w?.model ? { kind: w.kind, model: w.model, modelScale: w.modelScale, inHand: true, grip: w.grip, paint: signaturePaint } : null), [w]);
  useFrame(() => {
    const u = combat.rt.units.find(x => x.id === id), g = group.current, m = motion.current;
    if (!u || !g) return;
    g.position.set(u.x, ground(u.x, u.z), u.z);
    const ai = u.ai;
    if (!ai) return;
    m.speed = Math.hypot(ai.vx, ai.vz); m.yaw = m.speed > 1.5 && ai.mimic <= 0 ? Math.atan2(ai.vx, ai.vz) : ai.facing;
    if (ai.clip) { m.upper = ai.clip as ClipName; ai.clip = null; }
  });
  return <group ref={group}><Character look={look} motion={motion} weapon={weapon} verbs /></group>;
}

// ── The Joker: a huge mirror sweeping the field; behind it the ground is inverted until it shatters ──
const INVERT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.ZeroFactor, depthWrite: false, transparent: true, toneMapped: false } as const;
function Mirrors({ ground }: { ground: Ground }) {
  const { scene } = useGLTF("/assets/game/props/joker-mirror.glb");
  const frame = useMemo(() => {
    const m = scene.clone(true), invert = new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, ...INVERT });
    m.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && (mesh.material as THREE.Material).name === "M_Glass") { mesh.material = invert; mesh.renderOrder = 6; } });
    return m;
  }, [scene]);
  const path = useMemo(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: "#ffffff", ...INVERT })); m.renderOrder = 5; m.frustumCulled = false; return m; }, []);
  const group = useRef<THREE.Group>(null), fade = useRef({ t: 0, s: null as null | { x: number; z: number; x0: number; z0: number; dx: number; dz: number; w: number } });
  useFrame((_, delta) => {
    const g = group.current, f = fade.current, s = combat.rt.field.sweeps[0];
    if (!g) return;
    if (s) { f.s = { x: s.x, z: s.z, x0: s.x0, z0: s.z0, dx: s.dx, dz: s.dz, w: s.w }; f.t = 0.45; } else f.t = Math.max(0, f.t - delta);
    g.visible = !!s; path.visible = f.t > 0 && !!f.s;
    if (!f.s) return;
    const yaw = Math.atan2(f.s.dx, f.s.dz), len = Math.hypot(f.s.x - f.s.x0, f.s.z - f.s.z0);
    path.position.set(f.s.x0, ground(f.s.x0, f.s.z0) + 0.06, f.s.z0); path.rotation.y = yaw; path.scale.set(f.s.w, 1, Math.max(0.01, len));
    (path.material as THREE.MeshBasicMaterial).opacity = Math.min(1, f.t / 0.45);
    if (!s) return;
    g.position.set(s.x, ground(s.x, s.z), s.z); g.rotation.y = yaw + Math.PI; // the glass faces where it goes
    g.scale.set(s.w * 0.95, s.w * 0.55, s.w * 0.95);
  });
  return <><primitive object={path} /><group ref={group} visible={false}><primitive object={frame} /></group></>;
}

// ── Forms: the mob you shifted into, posed by the shared enemy animation helper; the Chimera wears all five ──
const FORM_PARTS: { body: string; scale: number; at: [number, number, number]; yaw?: number; spin?: number }[] = [
  { body: "stone-golem", scale: 1, at: [0, 0, 0] },
  { body: "shadow-fox", scale: 0.75, at: [0, 1.55, 0.35] },
  { body: "thorn-crab", scale: 0.7, at: [0, 1.15, -0.6], yaw: Math.PI },
  { body: "rune-wisp", scale: 0.8, at: [0, 0.9, 0.9], spin: 2 },
  { body: "pollen-sprite", scale: 3, at: [0.9, 1.35, -0.3], yaw: 0.5 },
  { body: "pollen-sprite", scale: 3, at: [-0.9, 1.35, -0.3], yaw: -0.5 },
];
function FormBody({ ground, player }: { ground: Ground; player: React.RefObject<THREE.Vector3> }) {
  const form = useCombatValue(() => combat.rt.v2?.form ?? "");
  const def = form ? combat.rt.v2?.kit.forms?.[form] : null;
  if (!def) return null;
  const parts = form === "chimera" ? FORM_PARTS.map(p => ({ ...p, scale: p.scale * def.scale })) : [{ body: def.body, scale: def.scale, at: [0, 0, 0] as [number, number, number] }];
  return <>{parts.map((p, i) => <MobBody key={`${form}-${i}`} type={ENEMIES[p.body]} scale={p.scale} at={p.at} yaw={"yaw" in p ? p.yaw ?? 0 : 0} spin={"spin" in p ? p.spin ?? 0 : 0} ground={ground} player={player} />)}</>;
}
const poseM = new THREE.Matrix4(), poseQ = new THREE.Quaternion(), poseE = new THREE.Euler(), poseP = new THREE.Vector3(), poseS = new THREE.Vector3(), POSE: PartPose = { rx: 0, ry: 0, rz: 0, dy: 0, dz: 0, sy: 1, s: 1 };
function MobBody({ type, scale, at, yaw, spin, ground, player }: { type: EnemyType; scale: number; at: [number, number, number]; yaw: number; spin: number; ground: Ground; player: React.RefObject<THREE.Vector3> }) {
  const { scene } = useGLTF(type.model);
  const rig = useMemo(() => {
    const root = scene.clone(true), nodes: { o: THREE.Object3D; rest: THREE.Matrix4; role: string | null }[] = [];
    root.traverse(o => { o.updateMatrix(); nodes.push({ o, rest: o.matrix.clone(), role: typeof o.userData.name === "string" ? o.userData.name : null }); o.matrixAutoUpdate = false; o.castShadow = true; });
    return { root, nodes };
  }, [scene]);
  const group = useRef<THREE.Group>(null), last = useRef({ x: 0, z: 0 }), pose = useRef<Pick<Enemy, "state" | "t" | "move">>({ state: "idle", t: 0, move: type.attacks[0] });
  useFrame(({ clock }, delta) => {
    const g = group.current, p = combat.rt.player, me = player.current;
    if (!g || !me) return;
    const moving = Math.hypot(me.x - last.current.x, me.z - last.current.z) > 0.01;
    last.current = { x: me.x, z: me.z };
    const e = pose.current, swinging = p.swing > 0;
    const state = swinging ? "active" : p.attackCd > 0.05 && e.state === "active" ? "recover" : moving ? "chase" : "idle";
    if (state !== e.state) { e.state = state; e.t = 0; } else e.t += delta;
    const s = type.modelScale * scale;
    g.position.set(me.x, ground(me.x, me.z) + type.hover * s / type.modelScale, me.z);
    g.rotation.y = p.facing + type.modelYaw;
    g.scale.setScalar(s);
    rig.root.position.set(at[0] / s, at[1] / s, at[2] / s); rig.root.rotation.y = yaw + spin * clock.elapsedTime;
    rig.root.updateMatrix();
    for (const n of rig.nodes) {
      if (n.o === rig.root) continue;
      n.o.matrix.copy(n.rest);
      const q = n.role && partPose(n.role, e, clock.elapsedTime, 0, POSE);
      if (q) n.o.matrix.multiply(poseM.compose(poseP.set(0, q.dy, q.dz), poseQ.setFromEuler(poseE.set(q.rx, q.ry, q.rz)), poseS.set(q.s, q.sy * q.s, q.s)));
    }
  });
  return <group ref={group}><primitive object={rig.root} /></group>;
}

// ── Stone walls: a ramped wedge of rock that bursts up out of the floor ──
function wedge() {
  const g = new THREE.BoxGeometry(1, 1, 1, 6, 3, 4), pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i) + 0.5, z = pos.getZ(i), h = 0.15 + 0.85 * (z + 0.5), n = Math.sin(x * 23.1 + z * 11.7) * 0.5 + Math.sin(x * 7.3 - z * 19.1) * 0.5;
    pos.setXYZ(i, x + n * 0.03, y * h + (y > 0.01 ? n * 0.04 : 0), z + n * 0.03);
  }
  g.computeVertexNormals();
  return g;
}
function Walls({ ground }: { ground: Ground }) {
  const meshes = useMemo(() => {
    const geo = wedge(), mat = new THREE.MeshStandardMaterial({ color: "#8f7d66", roughness: 1, flatShading: true });
    return [0, 1].map(() => { const m = new THREE.Mesh(geo, mat); m.visible = false; m.castShadow = true; m.receiveShadow = true; return m; });
  }, []);
  useFrame(() => {
    const walls = combat.rt.field.walls;
    meshes.forEach((m, i) => {
      const w = walls[i];
      m.visible = !!w;
      if (!w) return;
      const rise = Math.min(1, w.t / 0.25), sink = Math.min(1, w.life / 0.4);
      m.position.set(w.x, ground(w.x, w.z) - 0.05, w.z); m.rotation.y = Math.atan2(w.dx, w.dz);
      m.scale.set(w.w, w.h * rise * sink, w.d);
    });
  });
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// ── The Necromancer's corpses: a faint grave glyph on each body that can still rise ──
function Corpses({ ground, max = 24 }: { ground: Ground; max?: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.RingGeometry(0.28, 0.42, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#9ee6a8", transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }), max);
    m.frustumCulled = false; m.renderOrder = 3.4;
    return m;
  }, [max]);
  const tmp = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    let n = 0;
    for (const e of combat.rt.enemies) {
      if (n >= max || !corpse(e)) continue;
      const s = 1 + 0.08 * Math.sin(clock.elapsedTime * 3 + n);
      mesh.setMatrixAt(n++, tmp.makeScale(s, 1, s).setPosition(e.x, ground(e.x, e.z) + 0.05, e.z));
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ── Unseen (Vanish, a pollen scatter): only a faint ring shows you where you stand ──
function Shimmer({ ground, player }: { ground: Ground; player: React.RefObject<THREE.Vector3> }) {
  const mesh = useMemo(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#e9d8ff", transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })); m.renderOrder = 3.6; m.visible = false; return m; }, []);
  useFrame(({ clock }) => {
    const on = combat.rt.field.stealth > 0, me = player.current;
    mesh.visible = on;
    if (!on || !me) return;
    mesh.position.set(me.x, ground(me.x, me.z) + 0.05, me.z);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(clock.elapsedTime * 8);
  });
  return <primitive object={mesh} />;
}

