"use client";

/**
 * Encounter visuals, all driven from the combat runtime inside useFrame (no
 * React state per frame): instanced enemies (one InstancedMesh per GLB part
 * per enemy type, posed by lib/game/combat/telegraph.ts), telegraphs,
 * projectiles, wisps, blasts, aim reticle, and
 * the damage-number projector that moves DOM floaters. The held weapon rides
 * the character's hand socket (PlayerAvatar `combat`).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { combat } from "@/lib/game/combat/runtime";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";
import { glow, marker, partPose } from "@/lib/game/combat/telegraph";

type Ground = (x: number, z: number) => number;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);

/**
 * The GLB as a flat node list (parent index, rest transform, part name) plus
 * one draw per mesh primitive. Part names come from the glTF nodes
 * (`userData.name`), so the per-primitive child meshes of a multi-material
 * node follow their named parent instead of being posed twice.
 */
function useRig(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const nodes: { parent: number; rest: THREE.Matrix4; role: string | null }[] = [];
    const parts: { node: number; geometry: THREE.BufferGeometry; material: THREE.Material; telegraph: boolean }[] = [];
    const walk = (o: THREE.Object3D, parent: number) => {
      o.updateMatrix();
      const node = nodes.push({ parent, rest: o.matrix.clone(), role: typeof o.userData.name === "string" ? o.userData.name : null }) - 1;
      if (o instanceof THREE.Mesh) {
        const src = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
        const telegraph = src.name === "telegraph";
        // The telegraph slot becomes unlit so the per-instance colour is its brightness (glow() in telegraph.ts).
        const material = telegraph ? new THREE.MeshBasicMaterial({ color: src.emissive, side: THREE.DoubleSide, toneMapped: false }) : src.clone();
        parts.push({ node, geometry: o.geometry, material, telegraph });
      }
      o.children.forEach(c => walk(c, node));
    };
    walk(scene, -1);
    return { nodes, parts };
  }, [scene]);
}

const ALLY_TINT = new THREE.Color(0.9, 2.2, 1.1), SHADE_TINT = new THREE.Color(1.5, 1.2, 2.6);
const poseM = new THREE.Matrix4(), poseQ = new THREE.Quaternion(), poseE = new THREE.Euler(), poseP = new THREE.Vector3(), poseS = new THREE.Vector3();

/**
 * Every enemy of one type in one draw call per model part. Each part is posed
 * from the shared telegraph helper (partPose/glow) every frame; the whole
 * mesh is culled when none of its instances is on screen.
 */
const DYNAMIC = { sunCaster: "dynamic" };

export function EnemyInstances({ typeId, capacity, ground, allies = false }: { typeId: string; capacity: number; ground: Ground;
  /** Your summons that borrow this model (kits.ts UNITS `model`, a Necromancer's shades): tinted spirit-green or shade-violet, a little smaller. */
  allies?: boolean }) {
  const type = ENEMIES[typeId];
  const { nodes, parts } = useRig(type.model);
  const world = useMemo(() => nodes.map(() => new THREE.Matrix4()), [nodes]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const list = (allies ? combat.rt.units.flatMap(u => u.body?.type.id === typeId ? [u.body] : [])
      : combat.rt.enemies.filter(e => e.type.id === typeId && !(e.state === "dead" && e.deadFor > 0.6))).slice(0, capacity);
    list.forEach((e, i) => {
      const dying = e.state === "dead" ? 1 - e.deadFor / 0.6 : 1;
      const bob = type.hover ? Math.sin(t * 6 + i) * 0.12 : 0;
      tmpQ.setFromAxisAngle(UP, (e.state === "active" ? e.beam : e.facing) + type.modelYaw);
      tmpS.setScalar(type.modelScale * dying * (allies ? 0.85 : 1));
      tmpP.set(e.x, ground(e.x, e.z) + type.hover + bob, e.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      nodes.forEach((n, ni) => {
        const m = world[ni].copy(n.rest);
        const pose = n.role && partPose(n.role, e, t, i * 1.7);
        if (pose) m.multiply(poseM.compose(poseP.set(0, pose.dy, pose.dz), poseQ.setFromEuler(poseE.set(pose.rx, pose.ry, pose.rz)), poseS.set(1, pose.sy, 1)));
        m.premultiply(n.parent < 0 ? tmpM : world[n.parent]);
      });
      const lit = glow(e, t);
      parts.forEach((part, pi) => {
        const mesh = refs.current[pi];
        if (!mesh) return;
        mesh.setMatrixAt(i, world[part.node]);
        // Telegraph parts: their glow. Others: hit flash (bright), windup tint (warm), home-walk (faded).
        if (part.telegraph) tmpC.setScalar(lit + e.flash * 4);
        else if (e.flash > 0) tmpC.setScalar(1 + e.flash * 10);
        else if (e.state === "windup") tmpC.setRGB(1.15, 0.95, 0.9);
        else if (e.state === "return") tmpC.setRGB(0.7, 0.75, 0.9);
        else tmpC.setScalar(1);
        if (allies) tmpC.multiply(e.id.startsWith("shade") ? SHADE_TINT : ALLY_TINT);
        mesh.setColorAt(i, tmpC);
      });
    });
    for (const mesh of refs.current) {
      if (!mesh) continue;
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  });
  // Solids that move: they cast the sun shadow every frame (SunShadows) and receive.
  return <>{parts.map((p, i) => <instancedMesh key={i} ref={el => { refs.current[i] = el; }} args={[p.geometry, p.material, capacity]} castShadow receiveShadow userData={DYNAMIC} />)}</>;
}

/** Outline and fill colours: red for danger, violet for the guardian's summon. */
const TONES = { danger: [new THREE.Color("#ff4040"), new THREE.Color("#ff2a2a")], summon: [new THREE.Color("#b48cff"), new THREE.Color("#9a6bff")] };

/** Unit sectors by arc, face up and opening toward -Z: made once per arc, disposed with the component. */
function useSectors(segments: number) {
  const cache = useRef(new Map<number, THREE.CircleGeometry>());
  useEffect(() => { const c = cache.current; return () => c.forEach(g => g.dispose()); }, []);
  return (arc: number) => {
    const key = Math.round(arc * 100);
    let g = cache.current.get(key);
    if (!g) cache.current.set(key, g = new THREE.CircleGeometry(1, segments, Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2));
    return g;
  };
}

/** Ground markers from marker(): sectors, circles, the smash's ring and the beam line, filling as the windup completes. */
export function Telegraphs({ ground, max = 24 }: { ground: Ground; max?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const fills = useRef<(THREE.Mesh | null)[]>([]);
  // The sector opens toward -Z, so yaw + π points it along the enemy's facing (sin, cos).
  const geo = useSectors(40);
  useFrame(() => {
    let n = 0;
    for (const e of combat.rt.enemies) {
      const mk = n < max ? marker(e) : null;
      if (!mk) continue;
      const outline = refs.current[n], fill = fills.current[n];
      if (!outline || !fill) continue;
      for (const m of [outline, fill]) {
        m.geometry = geo(mk.arc);
        m.position.set(mk.x, ground(mk.x, mk.z) + 0.05, mk.z);
        m.rotation.y = mk.rot + Math.PI;
        m.visible = true;
        (m.material as THREE.MeshBasicMaterial).color.copy(TONES[mk.tone][m === fill ? 1 : 0]);
      }
      outline.scale.setScalar(mk.r);
      fill.scale.setScalar(mk.r * mk.fill);
      (outline.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.1 * mk.fill;
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

/** Glow-sprite units: wisps (the charm's and the kits'), bone wisps, the Illusionist's phantom. */
const SPRITE_TINT: Record<string, string> = { wisp: "#9fe8ff", "weapon-wisp": "#9fe8ff", "bone-wisp": "#f2ecdc", decoy: "#d9b8ff" };
export function Wisps({ ground, max = 10 }: { ground: Ground; max?: number }) {
  const glow = useTexture("/assets/sky/sun.png");
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const list = combat.rt.units.filter(u => !u.body && SPRITE_TINT[u.def.key]);
    for (let i = 0; i < max; i++) {
      const s = refs.current[i]; if (!s) continue;
      const m = list[i];
      s.visible = !!m;
      if (!m) continue;
      const decoy = m.def.kind === "decoy";
      s.position.set(m.x, ground(m.x, m.z) + (decoy ? 0.9 : 1.1 + Math.sin(clock.elapsedTime * 4 + i) * 0.15), m.z);
      s.scale.set(decoy ? 1.1 : 0.7, decoy ? 1.9 : 0.7, 1);
      s.material.color.set(SPRITE_TINT[m.def.key]);
      s.material.opacity = Math.min(1, m.life ?? 1) * (decoy ? 0.55 + Math.sin(clock.elapsedTime * 9) * 0.1 : 0.9);
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[0.7, 0.7, 1]} visible={false}>
    <spriteMaterial map={glow} color="#9fe8ff" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </sprite>)}</>;
}

/** Totems (a carved post and the circle it covers, so overlaps read), tripwires (a small disc), and a ring under each of your summons: green, violet for a shade. */
const TOTEM_COLOR: Record<string, string> = { "totem-ember": "#ff8a3d", "totem-mending": "#7dff9e", "totem-warding": "#8fd0ff", tripwire: "#ffe08a", shade: "#c9a7ff", decoy: "#d9b8ff" };
export function Totems({ ground, max = 16 }: { ground: Ground; max?: number }) {
  const posts = useRef<(THREE.Mesh | null)[]>([]), rings = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useMemo(() => new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), []);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), []);
  useEffect(() => () => { ring.dispose(); disc.dispose(); }, [ring, disc]);
  useFrame(({ clock }) => {
    const list = combat.rt.units.filter(u => u.source !== "weapon");
    for (let i = 0; i < max; i++) {
      const post = posts.current[i], r = rings.current[i], u = list[i];
      if (!post || !r) continue;
      post.visible = r.visible = !!u;
      if (!u) continue;
      const g = ground(u.x, u.z), c = TOTEM_COLOR[u.def.key] ?? "#7dff9e", totem = u.def.kind === "totem", area = totem || u.def.kind === "trap";
      post.visible = totem;
      r.geometry = area ? disc : ring;
      post.position.set(u.x, g + 0.6, u.z);
      (post.material as THREE.MeshStandardMaterial).color.set(c);
      (post.material as THREE.MeshStandardMaterial).emissive.set(c);
      r.position.set(u.x, g + 0.05, u.z);
      r.scale.setScalar(area ? u.def.radius! : 0.75);
      const m = r.material as THREE.MeshBasicMaterial;
      m.color.set(c); m.opacity = totem ? 0.16 + Math.sin(clock.elapsedTime * 3 + i) * 0.04 : area ? 0.55 : 0.85;
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <group key={i}>
    <mesh ref={el => { posts.current[i] = el; }} visible={false}><cylinderGeometry args={[0.16, 0.24, 1.2, 8]} />
      <meshStandardMaterial color="#ff8a3d" emissive="#ff8a3d" emissiveIntensity={0.6} roughness={0.8} /></mesh>
    <mesh ref={el => { rings.current[i] = el; }} geometry={disc} visible={false} renderOrder={2}>
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
    </mesh>
  </group>)}</>;
}

/** On the player: a shield bubble, the raised guard's arc, and a ring while transformed (Transmuter). */
export function PlayerAuras({ player, ground }: { player: React.RefObject<THREE.Vector3>; ground: Ground }) {
  const bubble = useRef<THREE.Mesh>(null), guard = useRef<THREE.Mesh>(null), body = useRef<THREE.Mesh>(null);
  const arc = useMemo(() => new THREE.CircleGeometry(1.1, 32, Math.PI / 2 - 0.9, 1.8).rotateX(-Math.PI / 2), []);
  useEffect(() => () => arc.dispose(), [arc]);
  useFrame(({ clock }) => {
    const rt = combat.rt, p = rt.player, pl = player.current, g = ground(pl.x, pl.z);
    if (bubble.current) {
      bubble.current.visible = p.shield > 0.5 && p.alive;
      bubble.current.position.set(pl.x, g + 0.95, pl.z);
      (bubble.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.min(0.18, p.shield / p.maxHp);
    }
    if (guard.current) {
      guard.current.visible = rt.buffs.some(b => b.stat === "block") && p.alive;
      guard.current.position.set(pl.x, g + 0.06, pl.z);
      guard.current.rotation.y = p.facing + Math.PI;
    }
    if (body.current) {
      body.current.visible = !!rt.transform && p.alive;
      body.current.position.set(pl.x, g + 0.05, pl.z);
      body.current.rotation.y = clock.elapsedTime * 1.5;
    }
  });
  return <>
    <mesh ref={bubble} visible={false} renderOrder={6}><sphereGeometry args={[0.95, 24, 16]} />
      <meshBasicMaterial color="#bfe3ff" transparent opacity={0.2} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} /></mesh>
    <mesh ref={guard} geometry={arc} visible={false} renderOrder={5}>
      <meshBasicMaterial color="#ffd27a" transparent opacity={0.45} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={body} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}><ringGeometry args={[0.7, 0.85, 6]} />
      <meshBasicMaterial color="#c9a7ff" transparent opacity={0.7} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>
  </>;
}

/** Ability and hit effects: rings for circles, filled sectors for cones, a lit strip for beams. */
export function Blasts({ ground, max = 12 }: { ground: Ground; max?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useMemo(() => new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), []);
  const strip = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), []);
  const sector = useSectors(32);
  useEffect(() => () => { ring.dispose(); strip.dispose(); }, [ring, strip]);
  useFrame(() => {
    for (let i = 0; i < max; i++) {
      const m = refs.current[i]; if (!m) continue;
      const b = combat.rt.blasts[combat.rt.blasts.length - 1 - i];
      m.visible = !!b;
      if (!b) continue;
      const k = b.age / b.life, grow = 0.3 + 0.7 * Math.min(1, k * 1.6);
      m.position.set(b.x, ground(b.x, b.z) + 0.08, b.z);
      if (b.length) { m.geometry = strip; m.rotation.set(0, b.rot ?? 0, 0); m.scale.set(b.radius * 2, 1, b.length); }
      else if (b.arc) { m.geometry = sector(b.arc); m.rotation.set(0, (b.rot ?? 0) + Math.PI, 0); m.scale.setScalar(b.radius * grow); }
      else { m.geometry = ring; m.rotation.set(0, 0, 0); m.scale.setScalar(b.radius * grow); }
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(b.color); mat.opacity = (b.length || b.arc ? 0.6 : 0.85) * (1 - k);
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <mesh key={i} ref={el => { refs.current[i] = el; }} geometry={ring} visible={false} renderOrder={4}>
    <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
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
