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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { combat, type Projectile } from "@/lib/game/combat/runtime";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";
import { glow, marker, partPose, type MarkerFamily } from "@/lib/game/combat/telegraph";
import { CAPS } from "@/lib/combat/kits";

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
    const box = new THREE.Box3().setFromObject(scene);
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
    return { nodes, parts, top: box.max.y };
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
/** A defeated enemy's pop: seconds it swells before it vanishes. */
const POP = 0.12;

export function EnemyInstances({ typeId, capacity, ground, allies = false }: { typeId: string; capacity: number; ground: Ground;
  /** Your summons that borrow this model (kits.ts UNITS `model`, a Necromancer's shades): tinted spirit-green or shade-violet, a little smaller. */
  allies?: boolean }) {
  const type = ENEMIES[typeId];
  const { nodes, parts, top } = useRig(type.model);
  useEffect(() => { BAR_TOP[typeId] = top * type.modelScale; }, [typeId, top, type.modelScale]);
  const world = useMemo(() => nodes.map(() => new THREE.Matrix4()), [nodes]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const list = (allies ? combat.rt.units.flatMap(u => u.body?.type.id === typeId ? [u.body] : [])
      : combat.rt.enemies.filter(e => e.type.id === typeId && !(e.state === "dead" && e.deadFor > POP))).slice(0, capacity);
    list.forEach((e, i) => {
      // A hit swells it a little with the flash; a defeat pops it a size up and it's gone in a puff (RuinsScene).
      const dying = e.state === "dead" ? 1 + 0.18 * Math.sin((e.deadFor / POP) * Math.PI * 0.5) : 1 + e.flash * 0.45;
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

/**
 * One look per attack family (combat polish 6): its colour, its rim's colour, and how deep the rim band is (area rings
 * read as a thick ring). The rims draw over every fill, so overlapping markers in a pack each keep their own edge.
 */
const FAMILY: Record<MarkerFamily, { fill: THREE.Color; rim: THREE.Color; band: number }> = {
  melee: { fill: new THREE.Color("#ff4538"), rim: new THREE.Color("#ffd9cf"), band: 0.93 },
  ranged: { fill: new THREE.Color("#ffc43a"), rim: new THREE.Color("#fff3c4"), band: 0.88 },
  area: { fill: new THREE.Color("#ff4fc8"), rim: new THREE.Color("#ffd6f3"), band: 0.82 },
  boss: { fill: new THREE.Color("#8a6cff"), rim: new THREE.Color("#ece4ff"), band: 0.9 },
};

/** Unit sectors (or, with `band`, their outer rim) by arc, face up and opening toward -Z: made once each, disposed with the component. */
function useSectors(segments: number) {
  const cache = useRef(new Map<string, THREE.BufferGeometry>());
  useEffect(() => { const c = cache.current; return () => c.forEach(g => g.dispose()); }, []);
  return (arc: number, band = 0) => {
    const key = `${Math.round(arc * 100)}:${band}`;
    let g = cache.current.get(key);
    if (!g) cache.current.set(key, g = (band ? new THREE.RingGeometry(band, 1, segments, 1, Math.PI / 2 - arc / 2, arc) : new THREE.CircleGeometry(1, segments, Math.PI / 2 - arc / 2, arc)).rotateX(-Math.PI / 2));
    return g;
  };
}

/**
 * Ground markers from marker(), filling as the windup completes: a melee sector, a ranged line from the source to its
 * landing circle, an area ring, the boss's violet (its beam a thin sweep). Each has a faint body, a growing fill and a rim.
 */
const MARK = ["body", "fill", "rim", "line", "lineFill"] as const;
export function Telegraphs({ ground, max = 24 }: { ground: Ground; max?: number }) {
  const parts = useRef(MARK.map(() => [] as (THREE.Mesh | null)[]));
  // The sector opens toward -Z, so yaw + π points it along the enemy's facing (sin, cos). The line runs along +Z from its source.
  const geo = useSectors(40);
  const strip = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), []);
  useEffect(() => () => strip.dispose(), [strip]);
  useFrame(() => {
    let n = 0;
    const [bodies, fills, rims, lines, lineFills] = parts.current;
    for (const e of combat.rt.enemies) {
      const mk = n < max ? marker(e) : null;
      if (!mk) continue;
      const body = bodies[n], fill = fills[n], rim = rims[n], line = lines[n], lineFill = lineFills[n];
      if (!body || !fill || !rim || !line || !lineFill) continue;
      const look = FAMILY[mk.family], y = ground(mk.x, mk.z) + 0.05;
      for (const m of [body, fill, rim]) {
        m.geometry = geo(mk.arc, m === rim ? look.band : 0);
        m.position.set(mk.x, y, mk.z);
        m.rotation.y = mk.rot + Math.PI;
        m.visible = true;
        (m.material as THREE.MeshBasicMaterial).color.copy(m === rim ? look.rim : look.fill);
      }
      body.scale.setScalar(mk.r);
      rim.scale.setScalar(mk.r);
      fill.scale.setScalar(mk.r * mk.fill);
      (body.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.1 * mk.fill;
      (rim.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * mk.fill;
      // Ranged: the path from the source to the landing circle, filling toward it as the windup completes.
      const from = mk.from, len = from ? Math.max(0, Math.hypot(mk.x - from.x, mk.z - from.z) - mk.r) : 0;
      line.visible = lineFill.visible = len > 0.05;
      if (from && len > 0.05) {
        const yaw = Math.atan2(mk.x - from.x, mk.z - from.z);
        for (const m of [line, lineFill]) {
          m.position.set(from.x, ground(from.x, from.z) + 0.05, from.z);
          m.rotation.set(0, yaw, 0);
          (m.material as THREE.MeshBasicMaterial).color.copy(m === line ? look.fill : look.rim);
        }
        line.scale.set(0.22, 1, len);
        lineFill.scale.set(0.09, 1, len * mk.fill);
      }
      n++;
    }
    for (const list of parts.current) for (let i = n; i < max; i++) if (list[i]) list[i]!.visible = false;
  });
  return <>{Array.from({ length: max }, (_, i) => <group key={i}>
    <mesh ref={el => { parts.current[0][i] = el; }} visible={false} renderOrder={2}><meshBasicMaterial transparent opacity={0.2} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={el => { parts.current[1][i] = el; }} visible={false} renderOrder={3}><meshBasicMaterial transparent opacity={0.32} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={el => { parts.current[2][i] = el; }} visible={false} renderOrder={4}><meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={el => { parts.current[3][i] = el; }} geometry={strip} visible={false} renderOrder={2}><meshBasicMaterial transparent opacity={0.3} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={el => { parts.current[4][i] = el; }} geometry={strip} visible={false} renderOrder={4}><meshBasicMaterial transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
  </group>)}</>;
}

/**
 * A static GLB (art/props-enemies) as one geometry for an instanced pool: transforms baked in, each primitive's material
 * colour folded into its vertex colours (COLOR_0 is the model's top-light gradient). `keep` picks the meshes by material.
 */
function bakeModel(scene: THREE.Object3D, keep: (material: THREE.Material) => boolean = () => true): THREE.BufferGeometry {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  scene.traverse(o => {
    const mesh = o as THREE.Mesh, mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mesh.isMesh || !keep(mat)) return;
    const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const src = g.getAttribute("color"), n = g.getAttribute("position").count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const s = src ? src.getX(i) : 1; col[i * 3] = mat.color.r * s; col[i * 3 + 1] = mat.color.g * s; col[i * 3 + 2] = mat.color.b * s; }
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach(p => p.dispose());
  return merged;
}
function useBaked(url: string, keep?: (material: THREE.Material) => boolean) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => bakeModel(scene, keep), [scene, keep]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Projectiles (combat polish 7): the arrow, the staff's rune shard and the spore glob, modelled in Blender
 * (art/props-enemies/build_combat_fx.py), each trailing a short glow that fades to nothing (additive, black at its tail).
 */
const P = "/assets/game/props/";
const SHOT: Record<Projectile["kind"], { model: string; scale: number; trail: THREE.Color; width: number; lit: boolean }> = {
  arrow: { model: `${P}projectile-arrow.glb`, scale: 1.3, trail: new THREE.Color("#fff1cf"), width: 0.07, lit: true },
  bolt: { model: `${P}projectile-bolt.glb`, scale: 1.5, trail: new THREE.Color("#a77bff"), width: 0.24, lit: false },
  spit: { model: `${P}projectile-spit.glb`, scale: 2, trail: new THREE.Color("#8fd14f"), width: 0.22, lit: false },
};
const KINDS = Object.keys(SHOT) as Projectile["kind"][];
/** A flat sliver behind the shot (local -Z), white at its head and black at its tail. */
function trailGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 0, -1], 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 0, 0, 0], 3));
  return g;
}
export function Projectiles({ ground, max = 48 }: { ground: Ground; max?: number }) {
  return <>{KINDS.map(k => <ShotPool key={k} kind={k} ground={ground} max={max} />)}</>;
}
function ShotPool({ kind, ground, max }: { kind: Projectile["kind"]; ground: Ground; max: number }) {
  const look = SHOT[kind], body = useRef<THREE.InstancedMesh>(null), tail = useRef<THREE.InstancedMesh>(null);
  const geometry = useBaked(look.model);
  const trail = useMemo(() => trailGeometry(), []);
  useEffect(() => () => trail.dispose(), [trail]);
  useFrame(() => {
    const b = body.current, t = tail.current; if (!b || !t) return;
    let n = 0;
    for (const s of combat.rt.projectiles) {
      if (s.kind !== kind || n >= max) continue;
      const speed = Math.hypot(s.vx, s.vz);
      tmpQ.setFromAxisAngle(UP, Math.atan2(s.vx, s.vz));
      tmpP.set(s.x, ground(s.x, s.z) + 0.9, s.z);
      b.setMatrixAt(n, tmpM.compose(tmpP, tmpQ, tmpS.setScalar(look.scale)));
      t.setMatrixAt(n, tmpM.compose(tmpP, tmpQ, tmpS.set(look.width, 1, Math.min(1.4, speed * 0.06))));
      n++;
    }
    b.count = t.count = n;
    b.instanceMatrix.needsUpdate = t.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={body} args={[geometry, undefined, max]} frustumCulled={false}>
      {look.lit ? <meshStandardMaterial vertexColors roughness={1} metalness={0} /> : <meshBasicMaterial vertexColors toneMapped={false} />}
    </instancedMesh>
    <instancedMesh ref={tail} args={[trail, undefined, max]} frustumCulled={false} renderOrder={5}>
      <meshBasicMaterial vertexColors color={look.trail} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </instancedMesh>
  </>;
}

/** Glow-sprite units: wisps (the charm's and the kits'), bone wisps, the Illusionist's phantom. */
const colors = (hex: Record<string, string>) => Object.fromEntries(Object.entries(hex).map(([k, v]) => [k, new THREE.Color(v)]));
const SPRITE_TINT = colors({ wisp: "#9fe8ff", "weapon-wisp": "#9fe8ff", "bone-wisp": "#f2ecdc", decoy: "#d9b8ff" });
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
      s.material.color.copy(SPRITE_TINT[m.def.key]);
      s.material.opacity = Math.min(1, m.life ?? 1) * (decoy ? 0.55 + Math.sin(clock.elapsedTime * 9) * 0.1 : 0.9);
    }
  });
  return <>{Array.from({ length: max }, (_, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[0.7, 0.7, 1]} visible={false}>
    <spriteMaterial map={glow} color="#9fe8ff" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </sprite>)}</>;
}

/**
 * Totems (the carved post from art/props-enemies, its eyes and rings in the kind's colour, and the circle it covers, so
 * overlaps read), tripwires (a small disc), and a ring under each of your summons: green, violet for a shade.
 */
const TOTEM_COLOR = colors({ "totem-ember": "#ff8a3d", "totem-mending": "#7dff9e", "totem-warding": "#8fd0ff", tripwire: "#ffe08a", shade: "#c9a7ff", decoy: "#d9b8ff" }), TOTEM_DEFAULT = TOTEM_COLOR["totem-mending"];
const glowing = (m: THREE.Material) => m.name === "M_Glow", solid = (m: THREE.Material) => m.name !== "M_Glow";
export function Totems({ ground, max = 16 }: { ground: Ground; max?: number }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]), post = useRef<THREE.InstancedMesh>(null), eyes = useRef<THREE.InstancedMesh>(null);
  const postGeo = useBaked(`${P}totem.glb`, solid), glowGeo = useBaked(`${P}totem.glb`, glowing);
  const ring = useMemo(() => new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), []);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), []);
  useEffect(() => () => { ring.dispose(); disc.dispose(); }, [ring, disc]);
  useFrame(({ clock }) => {
    const list = combat.rt.units.filter(u => u.source !== "weapon"), p = post.current, e = eyes.current;
    let posts = 0;
    for (let i = 0; i < max; i++) {
      const r = rings.current[i], u = list[i];
      if (!r) continue;
      r.visible = !!u;
      if (!u) continue;
      const g = ground(u.x, u.z), c = TOTEM_COLOR[u.def.key] ?? TOTEM_DEFAULT, totem = u.def.kind === "totem", area = totem || u.def.kind === "trap";
      r.geometry = area ? disc : ring;
      if (totem && p && e) {
        // Face the camera (it looks along +z); the eyes and rings pulse softly with the totem's beat.
        tmpQ.setFromAxisAngle(UP, Math.PI);
        tmpM.compose(tmpP.set(u.x, g, u.z), tmpQ, tmpS.setScalar(1.3));
        p.setMatrixAt(posts, tmpM); e.setMatrixAt(posts, tmpM);
        e.setColorAt(posts, tmpC.copy(c).multiplyScalar(1.3 + 0.3 * Math.sin(clock.elapsedTime * 3 + i)));
        posts++;
      }
      r.position.set(u.x, g + 0.05, u.z);
      r.scale.setScalar(area ? u.def.radius! : 0.75);
      const m = r.material as THREE.MeshBasicMaterial;
      m.color.copy(c); m.opacity = totem ? 0.16 + Math.sin(clock.elapsedTime * 3 + i) * 0.04 : area ? 0.55 : 0.85;
    }
    if (p && e) {
      p.count = e.count = posts;
      p.instanceMatrix.needsUpdate = e.instanceMatrix.needsUpdate = true;
      if (e.instanceColor) e.instanceColor.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh ref={post} args={[postGeo, undefined, CAPS.totems]} frustumCulled={false} castShadow userData={DYNAMIC}><meshStandardMaterial vertexColors roughness={1} metalness={0} /></instancedMesh>
    <instancedMesh ref={eyes} args={[glowGeo, undefined, CAPS.totems]} frustumCulled={false}><meshBasicMaterial vertexColors toneMapped={false} /></instancedMesh>
    {Array.from({ length: max }, (_, i) => <mesh key={i} ref={el => { rings.current[i] = el; }} geometry={disc} visible={false} renderOrder={2}>
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
    </mesh>)}
  </>;
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
      // Toward the aim (your facing turns with your movement between shots).
      const len = Math.min(Math.hypot(a.x - pl.x, a.z - pl.z), WEAPONS[p.weapon].range), yaw = Math.atan2(a.x - pl.x, a.z - pl.z);
      line.current.visible = ranged && p.alive;
      line.current.position.set(pl.x + Math.sin(yaw) * len / 2, ground(pl.x, pl.z) + 0.05, pl.z + Math.cos(yaw) * len / 2);
      line.current.rotation.set(-Math.PI / 2, 0, yaw + Math.PI);
      line.current.scale.set(0.06, len, 1);
    }
  });
  return <>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}><ringGeometry args={[0.28, 0.36, 32]} /><meshBasicMaterial color="#fff4c8" transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={line} renderOrder={5}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#fff4c8" transparent opacity={0.35} depthWrite={false} toneMapped={false} /></mesh>
  </>;
}

/** Projects runtime floaters onto pooled DOM nodes registered by the HUD: damage numbers on one pool, status words on their own. */
export const floaterNodes: (HTMLDivElement | null)[] = [];
export const noteNodes: (HTMLDivElement | null)[] = [];
export function FloaterProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const list = combat.rt.floaters;
    let hit = 0, note = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i], info = f.kind === "info", node = info ? noteNodes[note++] : floaterNodes[hit++];
      if (!node) continue;
      v.set(f.x, f.y + f.age * 0.9, f.z).project(camera);
      node.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%) scale(${f.kind === "crit" ? 1.35 : 1})`;
      node.style.opacity = String(Math.max(0, Math.min(1, 1.6 - f.age / 0.7)));
      node.dataset.kind = f.kind;
      if (node.textContent !== f.text) node.textContent = f.text;
    }
    for (; hit < floaterNodes.length; hit++) if (floaterNodes[hit]) floaterNodes[hit]!.style.opacity = "0";
    for (; note < noteNodes.length; note++) if (noteNodes[note]) noteNodes[note]!.style.opacity = "0";
  });
  return null;
}

/**
 * Small health bars over damaged ordinary enemies and elites (the guardian has its own at the top): billboards above
 * each model (its height from EnemyInstances), coral for ordinary enemies, amber for elites.
 */
export const BAR_TOP: Record<string, number> = {};
const BAR = { width: 0.8, elite: 1.2, height: 0.085, normal: new THREE.Color("#e8704a"), eliteColor: new THREE.Color("#e3a43a") };
export function EnemyBars({ ground, max = 24 }: { ground: Ground; max?: number }) {
  const back = useRef<THREE.InstancedMesh>(null), fill = useRef<THREE.InstancedMesh>(null);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), []);
  useEffect(() => () => plane.dispose(), [plane]);
  const right = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const b = back.current, f = fill.current; if (!b || !f) return;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    let n = 0;
    for (const e of combat.rt.enemies) {
      if (n >= max || e.type.kind === "boss" || e.state === "dead" || e.state === "return" || e.hp >= e.type.hp) continue;
      const w = e.type.elite ? BAR.elite : BAR.width, k = e.hp / e.type.hp, y = ground(e.x, e.z) + e.type.hover + (BAR_TOP[e.type.id] ?? 1) + 0.25;
      tmpP.set(e.x, y, e.z).addScaledVector(right, -w / 2);
      b.setMatrixAt(n, tmpM.compose(tmpP, camera.quaternion, tmpS.set(w, BAR.height, 1)));
      f.setMatrixAt(n, tmpM.compose(tmpP, camera.quaternion, tmpS.set(w * k, BAR.height * 0.62, 1)));
      f.setColorAt(n, e.type.elite ? BAR.eliteColor : BAR.normal);
      n++;
    }
    b.count = f.count = n;
    b.visible = f.visible = n > 0;
    b.instanceMatrix.needsUpdate = f.instanceMatrix.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={back} args={[plane, undefined, max]} frustumCulled={false} renderOrder={7}><meshBasicMaterial color="#293e3b" transparent opacity={0.6} depthTest={false} depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={fill} args={[plane, undefined, max]} frustumCulled={false} renderOrder={8}><meshBasicMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} /></instancedMesh>
  </>;
}
