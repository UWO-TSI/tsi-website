/**
 * A rare or epic rod's effect, in anyone's hand (rods round 2, David 2026-11-02: "epic rods are supposed to look epic
 * ... needs to be more exaggerated with effects and get like default idle animatinos"; art/pipeline/build_rods.py).
 * Built the way the held lantern is (LanternGlow): no lights, a few unlit and additive draws on the rod.
 *
 * The rod's GLB names its effect in its scene extras (`rodFx`); the effect is its own GLB,
 * `/assets/game/props/rodfx-<name>.glb`, in the rod's own space. Its nodes say how they move in their extras (`spin`
 * rad/s about their own up, `bob` metres at `rate` Hz, `pulse` a scale swell, `flicker` a crackle) and its materials
 * how they draw by name (`Glow` unlit, `Light` unlit and additive, `Aura` a soft additive shell brightest where it
 * faces you, anything else lit as the rod). Each `Halo` empty is a glow sprite of its `size` and `color`, and the
 * scene's extras throw the sparks into the scene's one glow pool (GlowFx). Brighter at dusk and night (glow.ts).
 *
 * The types and what grows with `strength` are the effects library's (lib/game/fx/library.ts, specs/fx-library.md).
 * A node with a `trail` extra leaves a fading ribbon (that wide, from its `trailFrom` point) in its own colour. Parts
 * whose material is `Water`, `Foam` or `Spray` are the Water type (lib/game/fx/water.ts): each holder has its own copy
 * of those materials, so its water runs, foams, reaches and splashes at its own strength.
 * A node with a `sway` extra is soft (the library's Sway: the Cedar's foliage, David 2026-11-06: "the leaves sway a lil
 * when moved like physics"): lit as the rod, each holder its own copy of its materials, every vertex bent by a spring
 * that follows the holder's motion (and a little breeze), more the further it reaches from the rod's axis.
 * `strength` (1 as made; times the effect scene's `fxStrength`, the strength it is drawn at as made: an awakened rod's
 * water made to wind on, build_rods.py tidewarden) makes one holder's effect stronger, easing to it: its parts turn and bob faster and further, its
 * swelling parts (the Tempest's tip spark) grow, trails last longer, and it throws sparks more
 * often (the awakening cutscene; David's pick 2026-11-05: "the aura gets a strength setting"). `Halo` sprites are
 * the Titanium's, made before the library: a disc of light, which the library no longer makes.
 *
 * The parts are shared by every holder (one template per effect, cloned): a holder costs one draw per effect mesh
 * and one per halo (at most five, specs/perf/effects-cost.md), no shadow, no shader compiled into anything lit.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { breath, glowTexture, nightLit } from "@/lib/game/glow";
import { FACE, type Recipe } from "@/lib/game/fx/particles";
import { fxAt, fxGrow } from "@/lib/game/fx/library";
import { WATER_PART, waterAt, waterMaterial } from "@/lib/game/fx/water";
import { useGlowParticles, type GlowParticles } from "../GlowFx";

/** The effect a rod's GLB names (its scene extras), or null. */
export const rodFxUrl = (rod: THREE.Object3D): string | null =>
  typeof rod.userData.rodFx === "string" ? `/assets/game/props/rodfx-${rod.userData.rodFx}.glb` : null;

const HALO_STOPS = [[0, 1], [0.15, 0.7], [0.4, 0.22], [1, 0]] as const;

// Through project_vertex, so it bends with the curved world as the rod it hugs does (curvedWorld.ts; rg8-tempest-hand:
// "tempes aura is not on the rod body" was the unbent shell floating off the bent rod in hand).
const AURA_VERT = `varying float vFace;
void main() {
  vec3 transformed = position;
  #include <project_vertex>
  vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mvPosition.xyz)));
}`;
const AURA_FRAG = `uniform vec3 color; uniform float opacity; varying float vFace;
void main() { gl_FragColor = vec4(color, opacity * vFace * vFace); }`;

interface Template {
  root: THREE.Object3D;
  /** The materials that breathe or crackle, each eased once a frame however many hold the rod. */
  glows: { material: THREE.MeshBasicMaterial; base: THREE.Color; flicker: number }[];
  auras: THREE.ShaderMaterial[];
  halos: { at: THREE.Vector3; size: number; material: THREE.SpriteMaterial }[];
  sparks: { recipe: Recipe<string>; tint: number; every: number; lo: number; hi: number } | null;
  trails: { name: string; width: number; from: THREE.Vector3; material: THREE.MeshBasicMaterial }[];
  frame: number;
}
const templates = new WeakMap<THREE.Object3D, Template>();

function template(scene: THREE.Object3D): Template {
  const known = templates.get(scene);
  if (known) return known;
  const root = scene.clone(true), glows: Template["glows"] = [], auras: THREE.ShaderMaterial[] = [], halos: Template["halos"] = [];
  const made = new Map<THREE.Material, THREE.Material>();
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.name.startsWith("Halo")) {
      halos.push({ at: o.getWorldPosition(new THREE.Vector3()), size: Number(o.userData.size ?? 0.3),
        material: new THREE.SpriteMaterial({ map: glowTexture(HALO_STOPS), color: String(o.userData.color ?? "#ffffff"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }) });
      return;
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = made.get(src);
    if (!m) {
      const color = src.color.clone(), name = src.name;
      if (WATER_PART.test(name)) m = waterMaterial(name, color);
      else if (/Aura/.test(name)) {
        const a = new THREE.ShaderMaterial({ name, vertexShader: AURA_VERT, fragmentShader: AURA_FRAG, uniforms: { color: { value: color }, opacity: { value: 0.4 } },
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
        auras.push(a);
        m = a;
      } else if (/Glow|Light/.test(name)) {
        const light = /Light/.test(name);
        const g = new THREE.MeshBasicMaterial({ name, color, transparent: light, opacity: light ? 0.9 : 1, depthWrite: !light, toneMapped: false, fog: false,
          blending: light ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
        glows.push({ material: g, base: color.clone(), flicker: 0 });
        m = g;
      } else m = src;
      made.set(src, m);
    }
    mesh.material = m;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.fx = true;
    mesh.raycast = () => {};
    if (WATER_PART.test(m.name)) mesh.frustumCulled = false;      // its drops and tongues move off its bounds
    if (!/Aura/.test(m.name)) box.expandByObject(mesh);
    // A crackling node crackles its own glow.
    const flicker = Number(o.userData.flicker ?? 0);
    if (flicker) for (const g of glows) if (g.material === m) g.flicker = flicker;
  });
  for (const h of [...root.children].filter(c => c.name.startsWith("Halo"))) h.removeFromParent();
  for (const n of nodesOf(root)) n.userData.home = { position: n.position.clone(), rotation: n.rotation.y, phase: n.position.y * 7.1 + n.position.x * 3.3 };
  const x = scene.userData;
  const sparks = typeof x.spark === "string" ? {
    recipe: { sprite: String(x.sparkSprite ?? "sparkle"), count: [1, 1], life: [0.7, 1.1], size: [Number(x.sparkSize ?? 0.06) * 0.8, Number(x.sparkSize ?? 0.06) * 1.2], grow: 0.4,
      speed: [0, 0.06], spread: Math.PI, up: [Number(x.sparkRise ?? 0.3) * 0.5, Number(x.sparkRise ?? 0.3)], gravity: 0, drag: 0, wind: 0.3, alpha: 0.95, face: FACE.billboard, jitter: 0.05 } as Recipe<string>,
    tint: new THREE.Color(x.spark).getHex(), every: Number(x.sparkEvery ?? 0.2), lo: box.min.y, hi: box.max.y,
  } : null;
  const trails = root.children.filter(n => n.userData.trail).map(n => {
    const m = (n as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    return { name: n.name, width: Number(n.userData.trail), from: new THREE.Vector3(...((n.userData.trailFrom as number[] | undefined) ?? [0, 0, 0])),
      material: new THREE.MeshBasicMaterial({ color: m?.color ?? new THREE.Color(1, 1, 1), vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }) };
  });
  const t: Template = { root, glows, auras, halos, sparks, trails, frame: -1 };
  templates.set(scene, t);
  return t;
}

/** The nodes that move: any with a spin, bob, pulse or flicker in its extras. */
const nodesOf = (root: THREE.Object3D) => root.children.filter(n => ["spin", "bob", "pulse", "flicker"].some(k => n.userData[k] !== undefined));

/** `rod` the held model (the effect rides it, popping out and putting away with it). */
export default function RodAura({ rod, url, strength = 1 }: { rod: THREE.Object3D; url: string; strength?: number }) {
  const { scene } = useGLTF(url);
  const glow = useGlowParticles();
  const fx = useMemo(() => {
    const t = template(scene), group = t.root.clone(true);
    group.name = "RodAura";
    const halos = t.halos.map(h => { const s = new THREE.Sprite(h.material); s.renderOrder = 2; s.raycast = () => {}; s.userData.fx = true; group.add(s); return s; });
    const trails = t.trails.map(tr => ({ tr, node: group.getObjectByName(tr.name)!, ribbon: ribbon(tr.material), at: [] as THREE.Vector3[], wait: 0 }));
    for (const x of trails) group.add(x.ribbon);
    // the water's and the soft parts' materials are this holder's own: its strength and its swing are its own
    const waters: THREE.ShaderMaterial[] = [], sway = swayOf();
    group.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (WATER_PART.test((mesh.material as THREE.Material).name)) waters.push((mesh.material = (mesh.material as THREE.ShaderMaterial).clone()));
      for (let n: THREE.Object3D | null = mesh; n && n !== group; n = n.parent) if (n.userData.sway) { mesh.material = swaying(mesh.material as THREE.MeshStandardMaterial, sway, Number(n.userData.sway)); break; }
    });
    const made = Number(scene.userData.fxStrength ?? 1);
    return { t, group, halos, trails, waters, sway, made, moving: nodesOf(group), clock: { next: 0, seed: rod.id * 7919, k: made } };
  }, [scene, rod]);
  useEffect(() => {
    rod.add(fx.group);
    return () => { fx.group.removeFromParent(); };
  }, [rod, fx]);
  useFrame(({ camera, clock }, delta) => idle(rod, fx, glow, camera, clock.elapsedTime, delta, strength * fx.made));
  return null;
}

/** A trail's ribbon: TRAIL_N points, two vertices each, fading toward its end (additive, so black is clear). */
const TRAIL_N = 18;
function ribbon(material: THREE.MeshBasicMaterial): THREE.Mesh {
  const g = new THREE.BufferGeometry(), idx: number[] = [], fade = new Float32Array(TRAIL_N * 6);
  for (let i = 0; i < TRAIL_N; i++) { const f = (1 - i / (TRAIL_N - 1)) ** 1.6; fade.set([f, f, f, f, f, f], i * 6); }
  for (let i = 0; i < TRAIL_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3));
  g.setAttribute("color", new THREE.BufferAttribute(fade, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.raycast = () => {}; mesh.userData.fx = true; mesh.visible = false;
  return mesh;
}
type Trail = { tr: Template["trails"][number]; node: THREE.Object3D; ribbon: THREE.Mesh; at: THREE.Vector3[]; wait: number };
const up = new THREE.Vector3();
/** One frame of a trail: sample its point (in the effect's space) every length / TRAIL_N seconds, and lay the ribbon along them. */
function lay(x: Trail, group: THREE.Object3D, dt: number, k: number) {
  x.wait -= dt;
  if (x.wait <= 0) {
    x.wait = fxAt("trail", "length", k) / TRAIL_N;
    x.at.unshift(group.worldToLocal(x.node.localToWorld(x.tr.from.clone())));
    x.at.length = Math.min(x.at.length, TRAIL_N);
  } else if (x.at.length) x.at[0] = group.worldToLocal(x.node.localToWorld(x.tr.from.clone()));
  if (x.at.length < 2) return;
  x.ribbon.visible = true;
  // Across the ribbon: the part's own up, in the effect's space, the trail's width.
  up.set(0, 1, 0).transformDirection(x.node.matrix).multiplyScalar(x.tr.width / 2);
  const pos = x.ribbon.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < TRAIL_N; i++) {
    const p = x.at[Math.min(i, x.at.length - 1)];
    pos.setXYZ(i * 2, p.x + up.x, p.y + up.y, p.z + up.z);
    pos.setXYZ(i * 2 + 1, p.x - up.x, p.y - up.y, p.z - up.z);
  }
  pos.needsUpdate = true;
}

const v = new THREE.Vector3(), cam = new THREE.Vector3(), s = new THREE.Vector3();
/** A step of crackle, the same for every holder in a frame: a fresh random level every 1/16 s. */
const crackle = (t: number) => { const k = Math.floor(t * 16); return 0.55 + 0.45 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1); };

/** Module scope (the react compiler forbids writing through hook values): the idle animation, the glows and sparks. */
function idle(rod: THREE.Object3D, fx: { t: Template; group: THREE.Object3D; halos: THREE.Sprite[]; trails: Trail[]; waters: THREE.ShaderMaterial[]; sway: Sway; moving: THREE.Object3D[]; clock: { next: number; seed: number; k: number } },
  glow: GlowParticles, camera: THREE.Camera, t: number, delta: number, strength: number) {
  const night = nightLit(), b = breath(t, 1.3), { t: tpl } = fx;
  const power = fx.clock.k += (strength - fx.clock.k) * (1 - Math.exp(-Math.min(delta, 0.1) * 3)), grow = fxGrow("pulse", "size", power);
  for (const m of fx.waters) waterAt(m, t, power);
  // Shared materials: once a frame.
  if (tpl.frame !== Math.floor(t * 1000)) {
    tpl.frame = Math.floor(t * 1000);
    for (const g of tpl.glows) g.material.color.copy(g.base).multiplyScalar((g.flicker ? 1 - g.flicker * (1 - crackle(t)) : b) * (1 + 0.35 * night));
    for (const a of tpl.auras) a.uniforms.opacity.value = (0.55 + 0.3 * night) * b;
    for (const h of tpl.halos) h.material.opacity = (0.7 + 0.3 * night) * b;
  }
  for (const n of fx.moving) {
    const home = n.userData.home as { position: THREE.Vector3; rotation: number; phase: number }, u = n.userData;
    if (u.spin) n.rotation.y = home.rotation + (u.turned = Number(u.turned ?? t * Number(u.spin)) + Math.min(delta, 0.1) * Number(u.spin) * fxGrow("motion", "spin", power));
    if (u.bob) n.position.y = home.position.y + Math.sin(t * TAU * Number(u.rate ?? 1) + home.phase) * Number(u.bob) * fxGrow("motion", "bob", power);
    const pulse = u.pulse ? grow * (1 + Number(u.pulse) * Math.sin(t * 2.6 + home.phase)) : 1;
    // A crackle jitters across the rod a little, stepped like the light.
    const jit = u.flicker ? 1 + 0.18 * (crackle(t + 0.37) - 0.75) : 1;
    n.scale.set(pulse * jit, pulse, pulse * (2 - jit));
  }
  if (!rod.visible) return;
  rod.updateWorldMatrix(true, false);
  if (fx.sway.used) spring(fx.sway, rod, t, Math.min(delta, 0.1), power);
  if (fx.trails.length) { fx.group.updateMatrixWorld(true); for (const x of fx.trails) lay(x, fx.group, Math.min(delta, 0.1), power); }
  const k = rod.getWorldScale(s).x || 1;
  camera.getWorldPosition(cam);
  tpl.halos.forEach((h, i) => {
    // Slid toward the camera, out of the part it glows from (LanternGlow).
    const at = rod.localToWorld(v.copy(h.at)), sprite = fx.halos[i];
    at.add(cam.clone().sub(at).normalize().multiplyScalar(0.1));
    sprite.position.copy(rod.worldToLocal(at));
    sprite.scale.setScalar((h.size * 1.3 * (0.95 + 0.1 * b) * (1 + 0.2 * night) * (1 + 0.3 * (power - 1))) / k);
  });
  const sp = tpl.sparks;
  if (!sp || rod.scale.x < 0.5) return;
  fx.clock.next -= delta;
  if (fx.clock.next > 0) return;
  fx.clock.next = sp.every / Math.max(1, fxGrow("particles", "rate", power));
  const seed = ++fx.clock.seed, r = (n: number) => Math.abs(Math.sin(seed * 78.233 + n * 12.9898) * 43758.5453 % 1);
  const p = rod.localToWorld(v.set((r(1) - 0.5) * 0.08, sp.lo + (sp.hi - sp.lo) * r(2), (r(3) - 0.5) * 0.08));
  glow.pool.burst(sp.recipe, p.x, p.y, p.z, p.y - 2, 0, 0, 1, sp.tint, seed);
}
const TAU = Math.PI * 2;

/**
 * The Sway type's spring, one per holder: where the soft part's middle is in the world (`at`, `vel`), and how far it
 * hangs back (`off`, `offVel`, in the rod's own space). `uniforms` are shared by every material of this holder.
 */
interface Sway { used: boolean; at: THREE.Vector3; vel: THREE.Vector3; off: THREE.Vector3; offVel: THREE.Vector3; primed: boolean; uniforms: { uSway: { value: THREE.Vector3 }; uSwayT: { value: number } } }
const swayOf = (): Sway => ({ used: false, at: new THREE.Vector3(), vel: new THREE.Vector3(), off: new THREE.Vector3(), offVel: new THREE.Vector3(), primed: false,
  uniforms: { uSway: { value: new THREE.Vector3() }, uSwayT: { value: 0 } } });
/** The middle of the soft part, in the rod's own space (a rod's foliage). */
const SWAY_AT = new THREE.Vector3(0, 0.42, 0);
/** A lit material bent by the holder's spring: each vertex moved by the swing times (its reach from the rod's axis / `reach`) squared, and a breeze. */
function swaying(src: THREE.MeshStandardMaterial, sway: Sway, swing: number): THREE.MeshStandardMaterial {
  sway.used = true;
  const m = src.clone();
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sway.uniforms, { uSwing: { value: swing } });
    shader.vertexShader = "uniform vec3 uSway; uniform float uSwayT; uniform float uSwing;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  float reach = clamp(length(position.xz) / 0.13, 0.0, 1.0);
  float give = reach * reach * uSwing;
  transformed += (uSway + vec3(sin(uSwayT * 1.7 + position.y * 9.0), 0.0, cos(uSwayT * 1.3 + position.y * 7.0)) * 0.0025) * give;`);
  };
  m.customProgramCacheKey = () => "rod-sway-v1";
  return m;
}
const sw = new THREE.Vector3(), sv = new THREE.Vector3(), sa = new THREE.Vector3(), inv = new THREE.Quaternion();
/** One frame of a holder's spring: the soft part's middle's acceleration (in the rod's own space) pushes it back the other way. */
function spring(s: Sway, rod: THREE.Object3D, t: number, dt: number, power: number) {
  const now = rod.localToWorld(sw.copy(SWAY_AT)), scale = rod.getWorldScale(v).x || 1;
  if (!s.primed || dt <= 0) { s.at.copy(now); s.vel.set(0, 0, 0); s.primed = true; return; }
  const vel = sv.copy(now).sub(s.at).divideScalar(dt), acc = sa.copy(vel).sub(s.vel).divideScalar(dt);
  s.at.copy(now); s.vel.copy(vel);
  // into the rod's own space, in its own units
  acc.applyQuaternion(rod.getWorldQuaternion(inv).invert()).divideScalar(scale);
  const k = fxAt("sway", "stiffness"), d = fxAt("sway", "damping"), g = fxGrow("sway", "swing", power);
  // o'' = -k o - d o' - a / 8: a hard swing (8 units/s²) hangs it back about 0.026, and it springs past and settles
  s.offVel.addScaledVector(s.off, -k * dt).addScaledVector(s.offVel, -d * dt).addScaledVector(acc.clampLength(0, 60), -0.125 * g * dt);
  s.off.addScaledVector(s.offVel, dt).clampLength(0, 0.035);
  s.uniforms.uSway.value.copy(s.off);
  s.uniforms.uSwayT.value = t;
}
