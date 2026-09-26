"use client";

/**
 * Encounter visuals, all driven from the combat runtime inside useFrame (no
 * React state per frame): instanced enemies (one InstancedMesh per GLB part
 * per enemy type), telegraphs, projectiles, wisps, blasts, aim reticle, the
 * held weapon, and the damage-number projector that moves DOM floaters.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { combat } from "@/lib/game/combat/runtime";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";

type Ground = (x: number, z: number) => number;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);

function useParts(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    scene.traverse(o => { if (o instanceof THREE.Mesh) parts.push({ geometry: o.geometry, material: (Array.isArray(o.material) ? o.material[0] : o.material).clone(), matrix: o.matrixWorld.clone() }); });
    return parts;
  }, [scene]);
}

/** Every enemy of one type in one draw call per model part. */
export function EnemyInstances({ typeId, capacity, ground }: { typeId: string; capacity: number; ground: Ground }) {
  const type = ENEMIES[typeId];
  const parts = useParts(type.model);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const list = combat.rt.enemies.filter(e => e.type.id === typeId && !(e.state === "dead" && e.deadFor > 0.6));
    parts.forEach((part, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      list.slice(0, capacity).forEach((e, i) => {
        const dying = e.state === "dead" ? 1 - e.deadFor / 0.6 : 1;
        const bob = type.hover ? Math.sin(t * 6 + i) * 0.12 : e.state === "chase" ? Math.abs(Math.sin(t * 12 + i)) * 0.06 : 0;
        const lean = e.state === "windup" ? Math.min(1, e.t / type.attack.windup) * 0.25 : 0;
        tmpQ.setFromAxisAngle(UP, e.facing + type.modelYaw);
        tmpS.setScalar(type.modelScale * dying * (1 + lean * 0.3));
        tmpP.set(e.x, ground(e.x, e.z) + type.hover + bob, e.z);
        tmpM.compose(tmpP, tmpQ, tmpS).multiply(part.matrix);
        mesh.setMatrixAt(i, tmpM);
        // Hit flash (bright), windup tint (warm), home-walk (faded).
        tmpC.setScalar(1);
        if (e.flash > 0) tmpC.setScalar(1 + e.flash * 10);
        else if (e.state === "windup") tmpC.setRGB(1.35, 0.85, 0.8);
        else if (e.state === "return") tmpC.setRGB(0.7, 0.75, 0.9);
        mesh.setColorAt(i, tmpC);
      });
      mesh.count = Math.min(list.length, capacity);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });
  return <>{parts.map((p, i) => <instancedMesh key={i} ref={el => { refs.current[i] = el; }} args={[p.geometry, p.material, capacity]} frustumCulled={false} />)}</>;
}

/** Ground telegraphs: a red sector/circle that fills as the windup completes (spit: a target mark). */
export function Telegraphs({ ground, max = 24 }: { ground: Ground; max?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const fills = useRef<(THREE.Mesh | null)[]>([]);
  const geos = useRef(new Map<number, THREE.CircleGeometry>());
  const geo = (arc: number) => {
    const key = Math.round(arc * 100);
    if (!geos.current.has(key)) geos.current.set(key, new THREE.CircleGeometry(1, 40, Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2));
    return geos.current.get(key)!;
  };
  useEffect(() => { const cache = geos.current; return () => cache.forEach(g => g.dispose()); }, []);
  useFrame(() => {
    let n = 0;
    for (const e of combat.rt.enemies) {
      if (e.state !== "windup" || n >= max) continue;
      const a = e.type.attack, k = Math.min(1, e.t / a.windup);
      const outline = refs.current[n], fill = fills.current[n];
      if (!outline || !fill) continue;
      const spit = a.shape === "spit";
      const arc = spit ? Math.PI * 2 : a.shape === "slam" ? Math.PI * 2 : a.arc;
      const r = spit ? 0.9 : a.range;
      const cx = spit ? e.aim.x : e.x, cz = spit ? e.aim.z : e.z;
      for (const m of [outline, fill]) {
        m.geometry = geo(arc);
        m.position.set(cx, ground(cx, cz) + 0.05, cz);
        m.rotation.y = spit ? 0 : e.facing - Math.PI / 2 + Math.PI / 2;
        m.visible = true;
      }
      outline.scale.setScalar(r);
      fill.scale.setScalar(r * k);
      (outline.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.1 * k;
      n++;
    }
    for (let i = n; i < max; i++) { if (refs.current[i]) refs.current[i]!.visible = false; if (fills.current[i]) fills.current[i]!.visible = false; }
  });
  return <>{Array.from({ length: max }, (_, i) => <group key={i}>
    <mesh ref={el => { refs.current[i] = el; }} visible={false} renderOrder={2}><meshBasicMaterial color="#ff4040" transparent opacity={0.2} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={el => { fills.current[i] = el; }} visible={false} renderOrder={3}><meshBasicMaterial color="#ff2a2a" transparent opacity={0.35} depthWrite={false} toneMapped={false} /></mesh>
  </group>)}</>;
}

const COLORS = { arrow: new THREE.Color("#f5e6c8"), bolt: new THREE.Color("#c9a7ff"), spit: new THREE.Color("#9be35a") };
export function Projectiles({ ground, max = 48 }: { ground: Ground; max?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const mesh = ref.current; if (!mesh) return;
    const list = combat.rt.projectiles.slice(0, max);
    list.forEach((s, i) => {
      tmpQ.setFromAxisAngle(UP, Math.atan2(s.vx, s.vz));
      tmpS.set(s.kind === "arrow" ? 0.07 : 0.22, s.kind === "arrow" ? 0.07 : 0.22, s.kind === "arrow" ? 0.7 : 0.22);
      tmpP.set(s.x, ground(s.x, s.z) + 0.9, s.z);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      mesh.setColorAt(i, COLORS[s.kind]);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, max]} frustumCulled={false}>
    <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial toneMapped={false} />
  </instancedMesh>;
}

/** Summoned wisps and blasts share the firefly glow sprite. */
export function Wisps({ ground, max = 4 }: { ground: Ground; max?: number }) {
  const glow = useTexture("/assets/sky/sun.png");
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    for (let i = 0; i < max; i++) {
      const s = refs.current[i]; if (!s) continue;
      const m = combat.rt.minions[i];
      s.visible = !!m;
      if (m) { s.position.set(m.x, ground(m.x, m.z) + 1.1 + Math.sin(clock.elapsedTime * 4 + i) * 0.15, m.z); s.material.opacity = Math.min(1, m.life) * 0.9; }
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[0.7, 0.7, 1]} visible={false}>
    <spriteMaterial map={glow} color="#9fe8ff" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </sprite>)}</>;
}

export function Blasts({ ground, max = 8 }: { ground: Ground; max?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useMemo(() => new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), []);
  useEffect(() => () => ring.dispose(), [ring]);
  useFrame(() => {
    for (let i = 0; i < max; i++) {
      const m = refs.current[i]; if (!m) continue;
      const b = combat.rt.blasts[i];
      m.visible = !!b;
      if (!b) continue;
      const k = b.age / b.life;
      m.position.set(b.x, ground(b.x, b.z) + 0.08, b.z);
      m.scale.setScalar(b.radius * (0.3 + 0.7 * Math.min(1, k * 1.6)));
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(b.color); mat.opacity = 0.85 * (1 - k);
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <mesh key={i} ref={el => { refs.current[i] = el; }} geometry={ring} visible={false} renderOrder={4}>
    <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </mesh>)}</>;
}

/** Mouse aim: a ring on the ground plus a thin guide line for ranged weapons. */
export function AimReticle({ player, ground }: { player: React.RefObject<THREE.Vector3>; ground: Ground }) {
  const ring = useRef<THREE.Mesh>(null), line = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = combat.rt.player, a = p.aim, pl = player.current;
    const kind = WEAPONS[p.weapon].kind, ranged = kind === "bow" || kind === "staff";
    if (ring.current) { ring.current.position.set(a.x, ground(a.x, a.z) + 0.06, a.z); ring.current.visible = p.alive && !combat.rt.casting; }
    if (line.current) {
      const len = Math.min(Math.hypot(a.x - pl.x, a.z - pl.z), WEAPONS[p.weapon].range);
      line.current.visible = ranged && p.alive;
      line.current.position.set(pl.x + Math.sin(p.facing) * len / 2, ground(pl.x, pl.z) + 0.05, pl.z + Math.cos(p.facing) * len / 2);
      line.current.rotation.set(-Math.PI / 2, 0, p.facing + Math.PI);
      line.current.scale.set(0.06, len, 1);
    }
  });
  return <>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}><ringGeometry args={[0.28, 0.36, 32]} /><meshBasicMaterial color="#fff4c8" transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={line} renderOrder={5}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#fff4c8" transparent opacity={0.35} depthWrite={false} toneMapped={false} /></mesh>
  </>;
}

/** The equipped weapon in the player's hand (row 140), swinging for melee. */
export function HeldWeapon({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const W = { sword: WEAPONS["sword-driftwood"], bow: WEAPONS["bow-willow"], staff: WEAPONS["staff-oak"], summon: WEAPONS["tome-spirits"] };
  const sword = useGLTF(W.sword.model).scene, bow = useGLTF(W.bow.model).scene, staff = useGLTF(W.staff.model).scene;
  const models = useMemo(() => ({ melee: sword.clone(), bow: bow.clone(), staff: staff.clone(), summon: staff.clone() }), [sword, bow, staff]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current; if (!g) return;
    const p = combat.rt.player, pl = player.current;
    const side = p.facing + Math.PI / 2;
    g.position.set(pl.x + Math.sin(side) * -0.32 + Math.sin(p.facing) * 0.15, pl.y + 0.55, pl.z + Math.cos(side) * -0.32 + Math.cos(p.facing) * 0.15);
    const swing = p.swing > 0 ? (1 - p.swing / 0.22) * 2.4 - 1.2 : 0;
    g.rotation.set(0, p.facing + swing, 0);
    g.visible = p.alive;
    (Object.keys(models) as (keyof typeof models)[]).forEach(k => { models[k].visible = k === WEAPONS[p.weapon].kind; });
  });
  return <group ref={group}>
    <primitive object={models.melee} scale={W.sword.modelScale} rotation={[0, Math.PI / 2, -0.3]} position={[0, 0, 0.3]} />
    <primitive object={models.bow} scale={W.bow.modelScale} position={[0, -0.2, 0.1]} />
    <primitive object={models.staff} scale={W.staff.modelScale} position={[0, -0.3, 0.1]} />
    <primitive object={models.summon} scale={W.summon.modelScale} position={[0, -0.2, 0.1]} />
  </group>;
}

/** Projects runtime floaters (damage numbers) onto pooled DOM nodes registered by the HUD. */
export const floaterNodes: (HTMLDivElement | null)[] = [];
export function FloaterProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const list = combat.rt.floaters;
    floaterNodes.forEach((node, i) => {
      if (!node) return;
      const f = list[list.length - 1 - i];
      if (!f) { node.style.opacity = "0"; return; }
      v.set(f.x, f.y + f.age * 0.9, f.z).project(camera);
      node.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%) scale(${f.kind === "crit" ? 1.35 : 1})`;
      node.style.opacity = String(Math.max(0, Math.min(1, 1.6 - f.age / 0.7)));
      node.dataset.kind = f.kind;
      if (node.textContent !== f.text) node.textContent = f.text;
    });
  });
  return null;
}
