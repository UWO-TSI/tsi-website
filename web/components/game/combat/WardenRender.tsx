"use client";

/**
 * What the Warden kits leave in the world that the FX registry can't draw from one event (design sheet §1.7; classes
 * v2): the lightning between linked totems and their zaps, the toad's tongue, the Druid's vine, totems flying to where
 * they plant, the Escape Rabbits flood (one instanced mesh, never entities), the World Tree growing round the Druid,
 * thorn walls, the Shadow Garden's pool and the Summoner's ritual circle. All of it reads the pure state (field.ts,
 * totems.ts, beasts.ts) every frame; nothing allocated per frame. Streaks use the combat pack and its particle
 * material (one draw for every link, zap, tongue and vine); models are the Blender ones (build_warden.py), matte.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { combat } from "@/lib/game/combat/runtime";
import { field, FIELD } from "@/lib/game/combat/field";
import { totemState } from "@/lib/game/combat/totems";
import { beastKit, beastState, RITUAL, tamedList } from "@/lib/game/combat/beasts";
import { nextToTame } from "@/lib/combat/wardenData";
import { COMBAT_PACK, COMBAT_PACK_COLS, COMBAT_PACK_URL, type CombatSprite } from "@/lib/game/fx/combatPack";
import { DEFAULT_RAMP, RampTable, sharedRamps, type Ramp } from "@/lib/game/fx/combat";
import { createCombatParticleMaterial, rampMap } from "@/lib/game/fx/fxMaterial";
import styles from "../DefaultIslandWorld.module.css";

type Ground = (x: number, z: number) => number;
const P = "/assets/game/props/", E = "/assets/game/enemies/";
const ramps = (sharedRamps.table ??= new RampTable());
let pack: THREE.Texture | null = null;
const frameOf = (s: CombatSprite, f: number) => COMBAT_PACK[s].row * COMBAT_PACK_COLS + (f % 8);
const INK: Ramp = ["#d8ffe6", "#2f7a54", "#0b1410"], TONGUE: Ramp = ["#ffe6ee", "#d86a8a", "#3a1020"], VINE: Ramp = ["#f4ffe2", "#6fae3e", "#1d3010"];
const ease = (u: number) => u * u * (3 - 2 * u);

/** Streaks: up to 48 quads in the combat particle layout, written each frame (links, zaps, tongues, the vine, the ritual's rune). */
const MAX = 48;
function useStreaks() {
  return useMemo(() => {
    pack ??= Object.assign(new THREE.TextureLoader().load(COMBAT_PACK_URL), { colorSpace: THREE.NoColorSpace });
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    for (const n of ["position", "uv"]) g.setAttribute(n, quad.getAttribute(n));
    const arr = [0, 1, 2, 3].map(() => new Float32Array(MAX * 4));
    const attrs = arr.map((a, k) => { const at = new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage); g.setAttribute(`i${"ABCD"[k]}`, at); return at; });
    g.instanceCount = 0;
    const glow = new THREE.Mesh(g, createCombatParticleMaterial(pack, rampMap(ramps), true));
    glow.frustumCulled = false; glow.renderOrder = 3.55;
    let n = 0;
    /** One quad: centre, size, rotation, sprite frame, alpha, ramp row; face 0 billboard, 1 flat on the ground, 2 streaked along (dx, dz). */
    const put = (x: number, y: number, z: number, w: number, h: number, frame: number, alpha: number, row: number, face: number, dx = 1, dz = 0, rot = 0) => {
      if (n >= MAX) return;
      const [A, B, C, D] = arr, q = n * 4;
      A[q] = x; A[q + 1] = y; A[q + 2] = z; A[q + 3] = y - 10;
      B[q] = w; B[q + 1] = h; B[q + 2] = rot; B[q + 3] = frame;
      C[q] = C[q + 1] = C[q + 2] = 1; C[q + 3] = alpha;
      D[q] = dx; D[q + 1] = row; D[q + 2] = dz; D[q + 3] = face;
      n++;
    };
    const begin = () => { n = 0; };
    const end = () => { g.instanceCount = n; glow.visible = n > 0; for (const a of attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; } };
    return { glow, g, put, begin, end };
  }, []);
}

/** A model's meshes baked into one geometry with vertex colours (the instanced rabbits and thorns). */
function bake(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    const src = g.getAttribute("color"), count = g.getAttribute("position").count, col = new Float32Array(count * 3);
    const lit = mat.emissiveIntensity > 0 && mat.emissive?.getHex() ? mat.emissive : null;
    for (let i = 0; i < count; i++) { const s = src ? src.getX(i) : 1, c = lit ?? mat.color; col[i * 3] = c.r * (lit ? 1 : s); col[i * 3 + 1] = c.g * (lit ? 1 : s); col[i * 3 + 2] = c.b * (lit ? 1 : s); }
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach(p => p.dispose());
  return merged;
}

export default function WardenRender({ ground, player }: { ground: Ground; player: React.RefObject<THREE.Vector3> }) {
  const scene = useThree(s => s.scene);
  const streaks = useStreaks();
  useEffect(() => { scene.add(streaks.glow); return () => { scene.remove(streaks.glow); streaks.g.dispose(); (streaks.glow.material as THREE.Material).dispose(); }; }, [scene, streaks]);
  // Models (matte, from build_warden.py): the totems in flight, the tree, the thorns and the rabbits.
  const tree = useGLTF(`${P}world-tree.glb`).scene, thorns = useGLTF(`${P}thorn-wall.glb`).scene, rabbit = useGLTF(`${P}rabbit.glb`).scene;
  const storm = useGLTF(`${E}totem-storm.glb`).scene, fire = useGLTF(`${E}totem-fire.glb`).scene, earth = useGLTF(`${E}totem-earth.glb`).scene, post = useGLTF(`${E}totem-spirit.glb`).scene;
  const kit = useMemo(() => {
    const treeObj = tree.clone(true), thornGeo = bake(thorns.clone(true)), rabbitGeo = bake(rabbit.clone(true));
    const matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const thornMesh = new THREE.InstancedMesh(thornGeo, matte, 16), rabbitMesh = new THREE.InstancedMesh(rabbitGeo, matte, 4 * 64);
    for (const m of [thornMesh, rabbitMesh]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; }
    const flying: Record<string, THREE.Object3D> = { "totem-storm": storm, "totem-fire": fire, "totem-earth": earth, "totem-spirit": post };
    const flights = Array.from({ length: 4 }, () => Object.fromEntries(Object.entries(flying).map(([k, m]) => [k, m.clone(true)])) as Record<string, THREE.Object3D>);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 } }, transparent: true, depthWrite: false,
      vertexShader: "varying vec2 vP; void main() { vP = position.xz; vec3 transformed = position;\n#include <project_vertex>\n}",
      // An ink pool: dark at its heart, its edge broken by moving tendrils and fading out (no solid rim: §1.7 readability).
      fragmentShader: `uniform float uTime, uFade; varying vec2 vP;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() { float r = length(vP), a = atan(vP.y, vP.x); float edge = 0.82 + 0.16 * n(vec2(a * 3.0, uTime * 0.8));
  float alpha = smoothstep(edge, edge - 0.3, r) * 0.62 * uFade; float vein = smoothstep(0.08, 0.0, abs(n(vP * 4.0 + uTime * 0.3) - 0.5)) * 0.35;
  if (alpha < 0.01) discard; gl_FragColor = vec4(mix(vec3(0.03, 0.05, 0.04), vec3(0.2, 0.75, 0.45), vein), alpha); }`,
    }));
    pool.renderOrder = 3.3; pool.visible = false;
    const group = new THREE.Group();
    group.add(treeObj, thornMesh, rabbitMesh, pool);
    for (const f of flights) for (const o of Object.values(f)) { o.visible = false; group.add(o); }
    treeObj.visible = false;
    treeObj.traverse(o => { o.castShadow = true; });
    return { group, treeObj, thornMesh, rabbitMesh, flights, pool, matte, thornGeo, rabbitGeo };
  }, [tree, thorns, rabbit, storm, fire, earth, post]);
  useEffect(() => { scene.add(kit.group); return () => { scene.remove(kit.group); kit.thornGeo.dispose(); kit.rabbitGeo.dispose(); kit.matte.dispose(); }; }, [scene, kit]);
  const ritualLabel = useRef<HTMLDivElement>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler() }), []);

  // The frame loop writes these three objects every frame: through a ref (they're the memo's, built once per load).
  const kitRef = useRef(kit);
  useEffect(() => { kitRef.current = kit; }, [kit]);
  useFrame(({ clock }) => {
    const K = kitRef.current, rt = combat.rt, t = clock.elapsedTime, f = field(rt), st = totemState(rt), bs = beastState(rt), v = rt.v2;
    const row = ramps.row(v?.kit.look.ramp ?? DEFAULT_RAMP);
    rampMap(ramps);
    const s = streaks;
    s.begin();
    const streak = (ax: number, az: number, bx: number, bz: number, lift: number, width: number, sprite: CombatSprite, alpha: number, r = row) => {
      const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
      if (d < 0.05) return;
      const y = (ground(ax, az) + ground(bx, bz)) / 2 + lift;
      s.put((ax + bx) / 2, y, (az + bz) / 2, d, width, frameOf(sprite, Math.floor(t * 18)), alpha, r, 2, dx / d, dz / d);
    };
    // Lightning between linked totems (it flashes bright after an Overcharge) and the zaps.
    for (const [a, b] of st.links) streak(a.x, a.z, b.x, b.z, 0.85, 0.55 + st.flash * 1.2, "bolt", Math.min(1, 0.75 + st.flash * 2));
    for (const z of st.zaps) streak(z.from.x, z.from.z, z.to.x, z.to.z, 0.9, 0.5, "bolt", 1 - z.t / 0.18);
    for (const g of bs.tongues) streak(g.from.x, g.from.z, g.to.x, g.to.z, 0.45, 0.22, "beam", 1 - g.t / 0.25, ramps.row(TONGUE));
    const te = f.tether, me = player.current;
    if (te && me) streak(me.x, me.z, te.x, te.z, 1.3, 0.16, "beam", 0.95, ramps.row(VINE));
    // The ritual circle (a Summoner with a beast still to tame): its rune turning on the ground, the ward during a ritual.
    const tamed = v && beastKit(v.kit) ? tamedList(rt) : null, offer = tamed ? nextToTame(tamed) : null;
    if (offer) {
      s.put(RITUAL.x, ground(RITUAL.x, RITUAL.z) + 0.05, RITUAL.z, RITUAL.r * 2.2, RITUAL.r * 2.2, frameOf("rune", 3), 0.55 + 0.2 * Math.sin(t * 2), ramps.row(INK), 1, 1, 0, t * 0.3);
      if (bs.ritual) for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2 + t * 0.4; s.put(RITUAL.x + Math.cos(a) * RITUAL.ward, ground(RITUAL.x, RITUAL.z) + 0.25, RITUAL.z + Math.sin(a) * RITUAL.ward, 0.5, 0.5, frameOf("shadow", Math.floor(t * 10) + k), 0.5, ramps.row(INK), 0); }
    }
    s.end();
    if (ritualLabel.current) {
      const near = !!offer && !!me && Math.hypot(me.x - RITUAL.x, me.z - RITUAL.z) < 14 && !bs.ritual;
      ritualLabel.current.style.display = near ? "" : "none";
      if (near) ritualLabel.current.textContent = `Ritual of shadows · step in to face the untamed ${offer === "rabbits" ? "hare" : offer}`;
    }
    // Totems flying to where they plant (an arc, tumbling).
    K.flights.forEach((slot, i) => {
      const fl = f.flights[i];
      for (const [k, o] of Object.entries(slot)) o.visible = !!fl && fl.unit === k;
      if (!fl) return;
      const o = slot[fl.unit], u = Math.min(1, fl.t / Math.max(0.01, fl.life));
      const x = fl.from.x + (fl.to.x - fl.from.x) * u, z = fl.from.z + (fl.to.z - fl.from.z) * u;
      o.position.set(x, ground(x, z) + 0.9 + 2.4 * 4 * u * (1 - u) - 0.9 * u, z);
      o.rotation.set(u * 6, 0, u * 2);
      o.scale.setScalar(1.65);
    });
    // The World Tree: grows round the Druid in its first half second, sways, and shrinks away as the zone ends.
    const tz = f.zones.find(z => z.key === "druid.tree");
    K.treeObj.visible = !!tz;
    if (tz) {
      const grow = ease(Math.min(1, tz.t / 0.6)), fade = Math.min(1, (tz.life - tz.t) / 0.45);
      K.treeObj.position.set(tz.x, ground(tz.x, tz.z) - 0.05, tz.z);
      K.treeObj.scale.setScalar(1.3 * Math.max(0.01, grow * fade) * (1 + 0.05 * Math.sin(tz.t * 2)));
      K.treeObj.rotation.set(0.02 * Math.sin(t * 1.3), tz.t * 0.05, 0.02 * Math.cos(t * 1.1));
    }
    // Thorn walls: segments along each wall, rising in and sinking out.
    let n = 0;
    for (const w of f.walls) {
      const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z), segs = Math.max(1, Math.round(len)), yaw = Math.atan2(w.b.x - w.a.x, w.b.z - w.a.z) - Math.PI / 2;
      const rise = ease(Math.min(1, w.t / 0.3)) * Math.min(1, (w.life - w.t) / 0.4);
      for (let k = 0; k < segs && n < 16; k++, n++) {
        const u = (k + 0.5) / segs, x = w.a.x + (w.b.x - w.a.x) * u, z = w.a.z + (w.b.z - w.a.z) * u;
        tmp.q.setFromEuler(tmp.e.set(0, yaw + (k % 2) * Math.PI, 0));
        K.thornMesh.setMatrixAt(n, tmp.m.compose(tmp.p.set(x, ground(x, z) - 0.8 * (1 - rise), z), tmp.q, tmp.s.set(1.3 * len / segs, 1.3 * Math.max(0.05, rise), 1.3)));
      }
    }
    K.thornMesh.count = n; K.thornMesh.visible = n > 0; K.thornMesh.instanceMatrix.needsUpdate = true;
    // The rabbit flood: each rabbit hops away from where it poured out, fanning wider, and shrinks to nothing (no entities).
    n = 0;
    for (const fd of f.floods) {
      const u = fd.t / FIELD.flood;
      for (let k = 0; k < fd.count && n < 256; k++, n++) {
        const h = Math.sin(fd.seed * 12.9898 + k * 78.233) * 43758.5453, r1 = h - Math.floor(h), r2 = (r1 * 7.31) % 1;
        const a = fd.dir + Math.PI + (r1 - 0.5) * Math.PI * 1.7, dist = (1.2 + r2 * 5.5) * ease(Math.min(1, u * 1.15)) + 0.4 * r1;
        const x = fd.x + Math.sin(a) * dist, z = fd.z + Math.cos(a) * dist, hop = Math.abs(Math.sin(u * 14 + k)) * 0.25 * (1 - u);
        tmp.q.setFromAxisAngle(tmp.up, a);
        const sc = 1.3 * (0.8 + 0.4 * r2) * Math.min(1, (1 - u) * 2.5) * Math.min(1, u * 12);
        K.rabbitMesh.setMatrixAt(n, tmp.m.compose(tmp.p.set(x, ground(x, z) + hop, z), tmp.q, tmp.s.setScalar(Math.max(0.001, sc))));
      }
    }
    K.rabbitMesh.count = n; K.rabbitMesh.visible = n > 0; K.rabbitMesh.instanceMatrix.needsUpdate = true;
    // Shadow Garden's pool.
    const gz = f.zones.find(z => z.key === "summoner.garden");
    K.pool.visible = !!gz;
    if (gz) {
      const open = ease(Math.min(1, gz.t / 0.35)), close = Math.min(1, (gz.life - gz.t) / 0.4);
      K.pool.position.set(gz.x, ground(gz.x, gz.z) + 0.03, gz.z);
      K.pool.scale.setScalar(gz.radius * open);
      (K.pool.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (K.pool.material as THREE.ShaderMaterial).uniforms.uFade.value = close;
    }
  });
  return <Html position={[RITUAL.x, 2.4, RITUAL.z]} center distanceFactor={10} zIndexRange={[3, 0]}><div ref={ritualLabel} className={styles.cue} style={{ display: "none" }} /></Html>;
}
