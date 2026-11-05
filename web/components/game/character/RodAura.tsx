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
 * `strength` (1 as made) makes one holder's effect stronger, easing to it: its parts turn and bob faster and further, its
 * swelling parts (the Tidewarden's pearl, the Tempest's tornado) and its halos grow, and it throws sparks more often (the
 * awakening cutscene; David's pick 2026-11-05: "the aura gets a strength setting").
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
import { useGlowParticles, type GlowParticles } from "../GlowFx";

/** The effect a rod's GLB names (its scene extras), or null. */
export const rodFxUrl = (rod: THREE.Object3D): string | null =>
  typeof rod.userData.rodFx === "string" ? `/assets/game/props/rodfx-${rod.userData.rodFx}.glb` : null;

const HALO_STOPS = [[0, 1], [0.15, 0.7], [0.4, 0.22], [1, 0]] as const;

const AURA_VERT = `varying float vFace;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
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
      if (/Aura/.test(name)) {
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
  const t: Template = { root, glows, auras, halos, sparks, frame: -1 };
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
    return { t, group, halos, moving: nodesOf(group), clock: { next: 0, seed: rod.id * 7919, k: 1 } };
  }, [scene, rod]);
  useEffect(() => {
    rod.add(fx.group);
    return () => { fx.group.removeFromParent(); };
  }, [rod, fx]);
  useFrame(({ camera, clock }, delta) => idle(rod, fx, glow, camera, clock.elapsedTime, delta, strength));
  return null;
}

const v = new THREE.Vector3(), cam = new THREE.Vector3(), s = new THREE.Vector3();
/** A step of crackle, the same for every holder in a frame: a fresh random level every 1/16 s. */
const crackle = (t: number) => { const k = Math.floor(t * 16); return 0.55 + 0.45 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1); };

/** Module scope (the react compiler forbids writing through hook values): the idle animation, the glows and sparks. */
function idle(rod: THREE.Object3D, fx: { t: Template; group: THREE.Object3D; halos: THREE.Sprite[]; moving: THREE.Object3D[]; clock: { next: number; seed: number; k: number } },
  glow: GlowParticles, camera: THREE.Camera, t: number, delta: number, strength: number) {
  const night = nightLit(), b = breath(t, 1.3), { t: tpl } = fx;
  const power = fx.clock.k += (strength - fx.clock.k) * (1 - Math.exp(-Math.min(delta, 0.1) * 3)), grow = 1 + 0.45 * (power - 1);
  // Shared materials: once a frame.
  if (tpl.frame !== Math.floor(t * 1000)) {
    tpl.frame = Math.floor(t * 1000);
    for (const g of tpl.glows) g.material.color.copy(g.base).multiplyScalar((g.flicker ? 1 - g.flicker * (1 - crackle(t)) : b) * (1 + 0.35 * night));
    for (const a of tpl.auras) a.uniforms.opacity.value = (0.55 + 0.3 * night) * b;
    for (const h of tpl.halos) h.material.opacity = (0.7 + 0.3 * night) * b;
  }
  for (const n of fx.moving) {
    const home = n.userData.home as { position: THREE.Vector3; rotation: number; phase: number }, u = n.userData;
    if (u.spin) n.rotation.y = home.rotation + (u.turned = Number(u.turned ?? t * Number(u.spin)) + Math.min(delta, 0.1) * Number(u.spin) * power);
    if (u.bob) n.position.y = home.position.y + Math.sin(t * TAU * Number(u.rate ?? 1) + home.phase) * Number(u.bob) * power;
    const pulse = u.pulse ? grow * (1 + Number(u.pulse) * Math.sin(t * 2.6 + home.phase)) : 1;
    // A crackle jitters across the rod a little, stepped like the light.
    const jit = u.flicker ? 1 + 0.18 * (crackle(t + 0.37) - 0.75) : 1;
    n.scale.set(pulse * jit, pulse, pulse * (2 - jit));
  }
  if (!rod.visible) return;
  rod.updateWorldMatrix(true, false);
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
  fx.clock.next = sp.every / Math.max(1, power);
  const seed = ++fx.clock.seed, r = (n: number) => Math.abs(Math.sin(seed * 78.233 + n * 12.9898) * 43758.5453 % 1);
  const p = rod.localToWorld(v.set((r(1) - 0.5) * 0.08, sp.lo + (sp.hi - sp.lo) * r(2), (r(3) - 0.5) * 0.08));
  glow.pool.burst(sp.recipe, p.x, p.y, p.z, p.y - 2, 0, 0, 1, sp.tint, seed);
}
const TAU = Math.PI * 2;
