"use client";

/**
 * The arrival's boat scenes (specs/v1-drop.md §1.2-1.3), in the reflection creator's own canvas while the island's is
 * paused under it: aboard Bram's boat out at sea, the world heavily blurred and washed out (your memories are gone);
 * then you lean over the side and your reflection in the water is the character creator. Every change sends a ripple
 * across the water that rewrites that feature; each choice sharpens the reflection and the world a little; Yes clears it.
 *
 * Built from the game's own parts: the wharf's boat (BOAT), Bram in the roster's look, you on the shared rig. The water
 * is a planar mirror: a render target drawn from the camera mirrored in the sea, only while this canvas exists (it is
 * disposed with it). The frame is drawn into a second target with its mip chain, and one composite pass blurs and washes
 * it by how clear you are, keeping the reflection readable (the "focus" round your face's reflection blurs least).
 * Matte throughout (row 264).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { CHARACTER_SCALE, type CharacterMotion } from "@/components/game/character/Character";
import { ThumbBaker } from "@/components/game/character/CreatorStage";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { BOAT } from "@/lib/game/wharf";
import { parseLook, type CharacterLook } from "@/lib/game/character/look";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { arrivalRun } from "@/lib/game/arrival/arrivalStore";
import { ARRIVAL_TIMES, clarityAt } from "@/lib/game/arrival/sequence";
import { mirrorCamera, renderReflection } from "@/lib/game/arrival/reflectionPasses";

useGLTF.preload(BOAT.url);

/** How high your face is up your body from the hips' pivot (the creator's framing aims its reflection there). */
const FACE_UP = CHARACTER_SCALE * 0.82;
/** Where your face is over the water as you lean out (the boat's frame, on the sea): ripples rewrite you from there. */
export function faceOverWater(): { x: number; z: number } {
  return { x: SET.you.x - FACE_UP * Math.sin(SET.you.lean), z: SET.you.z };
}

/** A ripple on the water: where (the boat's frame, on the sea), when it started (s, this canvas's clock) and how strong. */
export interface Ripple { x: number; z: number; t: number; strength: number }

/**
 * The set, in the boat's frame (bow +z, the sea at y 0): where you kneel and lean out over the starboard side, where
 * Bram stands, the two camera framings. Tuned by eye against David's sketch (dev: window.__reflect).
 */
export const SET = {
  /**
   * Your feet by the gunwale, facing out (-x), and how far you lean over it (radians). Upright, not crouched: the
   * crouch bows the head, and the water then sees the face from the forehead side, where David's fringes cover the
   * eyes (checked on all 21 hairstyles, specs/evidence/v1-opening/07-hairstyles-reflection.webp). Leaning past 45
   * degrees the camera sees the back of your head, not your face, and your chest is out over the water: its
   * reflection (your shirt) shows under your face's.
   */
  you: { x: -0.6, y: BOAT.floor - BOAT.draft, z: 0.15, lean: 1.0, crouch: false },
  /** Bram at the stern by the motor, facing you. */
  bram: { x: 0.28, y: BOAT.floor - BOAT.draft, z: -0.62, yaw: -0.9 },
  /** Aboard, looking up at Bram from where you were laid down (your eyes). */
  aboard: { pos: [-0.62, 0.62, 0.55] as const, look: [0.28, 1.25, -0.62] as const, fov: 46, roll: -0.08 },
  /**
   * Leaning over (playtest round 1: the reflection reads upright, the shirt in frame): the camera orbits a point on your
   * reflection, `aim` of the way from its face (0) down to its chest (1), at `dist`, `azimuth` round from inboard (+x)
   * toward the bow (+z) and `elevation` above the sea. Its up is the reflection's own up, so the face in the water is
   * always upright on screen; `roll` turns the frame from there. Out over the water off the stern quarter: the back of
   * your head bottom left, the gunwale on a diagonal under it, your reflection face and shirt in the middle (the sketch).
   */
  creator: { aim: 0.8, dist: 5.5, azimuth: 4.0, elevation: 0.98, fov: 24, roll: 0 },
};
/** The sea's colours at golden hour (the deep, the shallower tint, the sky the reflection shows round you). */
const SEA = { deep: "#2a6c80", shallow: "#4b9aa6", sky: "#dfe9e4", haze: "#f3e6cf", sun: "#fff1cf" };

const WATER_VERT = /* glsl */ `
uniform mat4 uTex;
varying vec3 vW;
varying vec4 vR;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vR = uTex * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = /* glsl */ `
uniform sampler2D tRefl;
uniform float uTime, uBlur, uClarity;
uniform vec4 uRip[6];
uniform vec3 uDeep, uShallow, uSun, uCam;
varying vec3 vW;
varying vec4 vR;
// Slow swells and a fine chop, as a height's slope (the reflection's wobble and the light on it).
vec2 slope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  g += vec2(0.6, 0.3) * cos(dot(p, vec2(0.6, 0.3)) * 2.1 + t * 0.9) * 0.05;
  g += vec2(-0.25, 0.7) * cos(dot(p, vec2(-0.25, 0.7)) * 3.3 + t * 1.3) * 0.035;
  g += vec2(0.8, -0.5) * cos(dot(p, vec2(0.8, -0.5)) * 7.0 + t * 2.1) * 0.012;
  g += vec2(-0.7, -0.6) * cos(dot(p, vec2(-0.7, -0.6)) * 11.0 + t * 2.7) * 0.007;
  return g;
}
void main() {
  vec2 p = vW.xz;
  vec2 g = slope(p, uTime);
  float ring = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    float age = uTime - r.z;
    if (age < 0.0 || age > 4.0) continue;
    vec2 d = p - r.xy;
    float dist = length(d), front = age * 0.85, x = dist - front;
    float env = exp(-x * x / 0.012) * r.w * exp(-age * 0.9);
    vec2 n = d / max(dist, 1e-3);
    g += n * env * sin(x * 38.0) * 0.55;
    // The drop's splash where it lands, the first moment.
    g += d * 6.0 * exp(-dist * dist / 0.01) * exp(-age * 7.0) * r.w * sin(age * 40.0);
    ring += env;
  }
  vec4 proj = vR;
  proj.xy += g * 0.22 * proj.w;
  vec3 refl = texture2D(tRefl, proj.xy / proj.w, uBlur).rgb;
  vec3 V = normalize(uCam - vW);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  // The water's own colour, a little brighter where the swell faces the light.
  vec3 water = mix(uDeep, uShallow, clamp(0.45 + dot(g, vec2(1.6, 1.0)) * 3.0, 0.0, 1.0));
  vec3 col = mix(water, refl, 0.8 + 0.15 * fres);
  // Light on the rings and sparkles off the chop, only once the world is clearing.
  col += uSun * (ring * 0.12 + smoothstep(0.07, 0.1, length(g)) * 0.25 * uClarity);
  gl_FragColor = vec4(col, 1.0);
}`;

const POST_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
/** The composite: a soft disk blur on the frame's mips (less round your reflection), washed toward the morning haze. */
const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes, uFocus, uFocusR;
uniform float uLod, uWash, uFocusOn;
uniform vec3 uHaze;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - uFocus) / uFocusR;
  float m = uFocusOn * (1.0 - smoothstep(0.55, 1.0, length(q)));
  float lod = mix(uLod, uLod * 0.2, m);
  float r = exp2(lod) * 1.35 / uRes.y;
  vec2 k = vec2(uRes.y / uRes.x, 1.0) * r;
  vec3 c = texture2D(tScene, vUv, lod).rgb * 2.0;
  c += texture2D(tScene, vUv + vec2(1.0, 0.0) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(-1.0, 0.0) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(0.0, 1.0) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(0.0, -1.0) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(0.7, 0.7) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(-0.7, 0.7) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(0.7, -0.7) * k, lod).rgb;
  c += texture2D(tScene, vUv + vec2(-0.7, -0.7) * k, lod).rgb;
  c /= 10.0;
  float wash = uWash * (1.0 - 0.75 * m);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, mix(vec3(l), uHaze, 0.5) * 1.06 + 0.04, wash);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop, uHorizon, uSun;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.65, h));
  float sun = max(dot(normalize(vDir), normalize(vec3(0.6, 0.18, 0.75))), 0.0);
  c += uSun * (pow(sun, 24.0) * 0.6 + pow(sun, 4.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
}`;
const SKY_VERT = /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BRAM_LOOK = parseLook(RESIDENT_LOOKS["wharf-keeper"]);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LEAN_AT = ARRIVAL_TIMES.aboard - 1.9;

/** Dev (tuning the set against the sketch): `window.__reflect` holds SET; edit it live. */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __reflect?: typeof SET }).__reflect = SET;

type Gpu = ReturnType<typeof makeGpu>;
/** The mirror's and the frame's targets, the mirror camera, the water's, the composite's and the sky's materials. */
function makeGpu() {
  const opts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace } as const;
  const refl = new THREE.WebGLRenderTarget(1024, 1024, { ...opts, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const frame = new THREE.WebGLRenderTarget(4, 4, { ...opts, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, samples: 4 });
  const mirror = new THREE.PerspectiveCamera();
  const texMatrix = new THREE.Matrix4();
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.002);
  const water = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    uniforms: {
      tRefl: { value: refl.texture }, uTex: { value: texMatrix }, uTime: { value: 0 }, uBlur: { value: 2 }, uClarity: { value: 0 },
      uRip: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uDeep: { value: new THREE.Color(SEA.deep) }, uShallow: { value: new THREE.Color(SEA.shallow) },
      uSun: { value: new THREE.Color(SEA.sun) }, uCam: { value: new THREE.Vector3() },
    },
  });
  const composite = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: frame.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: new THREE.Vector2(0.5, 0.5) }, uFocusR: { value: new THREE.Vector2(0.2, 0.2) },
      uLod: { value: 4 }, uWash: { value: 0.6 }, uFocusOn: { value: 0 }, uHaze: { value: new THREE.Color(SEA.haze) } },
  });
  const post = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const sky = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color("#9fc7d6") }, uHorizon: { value: new THREE.Color("#f4d8ae") }, uSun: { value: new THREE.Color(SEA.sun) } } });
  return { refl, frame, mirror, texMatrix, clip, water, composite, post, postCam, sky };
}
/** Everything the creator's canvas made, gone with it (the mirror exists only while the creator does). */
function disposeGpu(gpu: Gpu) {
  gpu.refl.dispose(); gpu.frame.dispose(); gpu.water.dispose(); gpu.composite.dispose(); gpu.sky.dispose();
  gpu.post.traverse(o => (o as THREE.Mesh).geometry?.dispose());
}
function resizeGpu(gpu: Gpu, w: number, h: number) { gpu.frame.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }

interface Frame {
  gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; size: { width: number; height: number }; gpu: Gpu;
  tmp: { a: THREE.Vector3; b: THREE.Vector3; up: THREE.Vector3; head: THREE.Vector3; eye: THREE.Vector3; aim: THREE.Vector3; qa: THREE.Quaternion; qc: THREE.Quaternion };
  clock: React.RefObject<number>; ripples: React.RefObject<Ripple[]>; view: React.RefObject<{ x: number; y: number; w: number; h: number } | null>;
  you: THREE.Group | null; bram: THREE.Group | null; boat: THREE.Group | null; water: THREE.Mesh | null; youMotion: CharacterMotion; bramMotion: CharacterMotion;
}
const Y = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();
/** A camera at `eye` looking at `at` with `up`, turned `roll` about its view axis, as a quaternion. */
function lookQuat(eye: THREE.Vector3, at: THREE.Vector3, up: THREE.Vector3, roll: number, out: THREE.Quaternion) {
  _m.lookAt(eye, at, up);
  out.setFromRotationMatrix(_m);
  if (roll) out.multiply(_rq.setFromAxisAngle(_z, roll));
  return out;
}
const _rq = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
/**
 * The creator's framing (SET.creator) for your lean now: where the camera is (`eye`), the point on your reflection it
 * looks at (`aim`) and its up (`up`), the reflection's: your head's up mirrored in the sea, so the face reads upright.
 */
export function creatorView(C: typeof SET.creator, out: { eye: THREE.Vector3; aim: THREE.Vector3; up: THREE.Vector3 }) {
  const lean = SET.you.lean, s = Math.sin(lean), c = Math.cos(lean), y0 = SET.you.y;
  // Your face and chest leaning out over the side (the lean turns you about your feet), mirrored in the sea.
  const face = FACE_UP, chest = FACE_UP * 0.58, h = face + (chest - face) * C.aim;
  out.aim.set(SET.you.x - h * s, -(y0 + h * c), SET.you.z);
  out.up.set(-s, -c, 0);
  const ce = Math.cos(C.elevation);
  out.eye.set(out.aim.x + C.dist * ce * Math.cos(C.azimuth), out.aim.y + C.dist * Math.sin(C.elevation), out.aim.z + C.dist * ce * Math.sin(C.azimuth));
  return out;
}

/**
 * One frame of the boat scene, module scope (the react compiler forbids writing through hook values): the swell, where
 * you and Bram are, the camera's move from aboard to over your shoulder, the mirror camera, the uniforms; then the
 * mirror pass, the frame and the composite.
 */
function drawReflection(f: Frame, dt: number) {
  const { gl, scene, gpu, tmp, size } = f, cam = f.camera, a = arrivalRun.current;
  const t = (f.clock.current += dt), now = performance.now();
  const phase = a?.phase ?? "creator", since = a ? (now - a.at) / 1000 : 10;
  // The lean: aboard you are laid down looking up at Bram; near the end you come up onto your knees and lean out.
  const lean = phase === "aboard" ? smooth(LEAN_AT, ARRIVAL_TIMES.aboard, since) : 1;
  const clarity = a ? clarityAt(a, now) : 1;
  // The boat rides a gentle swell; everything aboard rides with it.
  const bob = Math.sin(t * 0.9) * 0.025, roll = Math.sin(t * 0.7 + 1) * 0.022, pitch = Math.sin(t * 0.55) * 0.015;
  f.boat?.position.set(0, -BOAT.draft + bob, 0);
  f.boat?.rotation.set(pitch, 0, roll);
  if (f.you) {
    f.you.position.set(SET.you.x, SET.you.y + bob, SET.you.z);
    f.you.rotation.set(0, 0, SET.you.lean * lean);
    f.you.visible = lean > 0.25;
  }
  f.youMotion.pose = SET.you.crouch ? "CrouchIdle" : "Idle";
  f.bram?.position.set(SET.bram.x, SET.bram.y + bob, SET.bram.z);
  // Bram watches you, and looks out at the water with you once you lean over.
  f.bramMotion.yaw = THREE.MathUtils.lerp(SET.bram.yaw, -Math.PI / 2 - 0.2, lean);
  // The camera: aboard, your eyes on him; then up behind you, down at your reflection, turned so it reads upright.
  const A = SET.aboard, C = SET.creator, k = smooth(0, 1, lean);
  creatorView(C, tmp);
  tmp.a.set(...A.pos).lerp(tmp.eye, k);
  tmp.a.y += bob + Math.sin(t * 0.8) * 0.01;
  cam.position.copy(tmp.a);
  lookQuat(tmp.a, tmp.b.set(...A.look), Y, A.roll, tmp.qa);
  lookQuat(tmp.a, tmp.aim, tmp.up, C.roll, tmp.qc);
  cam.quaternion.slerpQuaternions(tmp.qa, tmp.qc, k);
  cam.rotateZ(roll * 0.5);
  cam.fov = THREE.MathUtils.lerp(A.fov, C.fov, k);
  // Framed in the scene's part of the canvas as the panels come in (the whole canvas aboard): the lens's frame is that
  // part (its size and shape, a phone's square or a desktop's two-thirds), and the canvas a window round it.
  const v = f.view.current, W = size.width, H = size.height;
  const fw = v ? W + (v.w - W) * k : W, fh = v ? H + (v.h - H) * k : H, ox = v ? -v.x * k : 0, oy = v ? -v.y * k : 0;
  cam.aspect = fw / fh;
  cam.setViewOffset(fw, fh, ox, oy, W, H);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  // The mirror: the camera reflected in the sea (y 0), drawing only what is above it (lib/game/arrival/reflectionPasses.ts).
  mirrorCamera(cam, gpu.mirror, gpu.texMatrix);

  // Uniforms: time, ripples, how clear you are, where your face's reflection is on screen.
  const w = gpu.water.uniforms;
  w.uTime.value = t; w.uClarity.value = clarity; w.uCam.value.copy(cam.position);
  w.uBlur.value = (1 - clarity) * 1.0;
  const rip = w.uRip.value as THREE.Vector4[], list = f.ripples.current;
  for (let i = 0; i < rip.length; i++) { const r = list[list.length - 1 - i]; rip[i].set(r?.x ?? 0, r?.z ?? 0, r?.t ?? 0, r ? r.strength : 0); }
  const c = gpu.composite.uniforms;
  c.uLod.value = (1 - clarity) * 5.2;
  c.uWash.value = (1 - clarity) * 0.8;
  c.uFocusOn.value = lean;
  c.uRes.value.set(gpu.frame.width, gpu.frame.height);
  // Your reflection, face and shirt (the creator's aim), on screen: the blur keeps off it.
  tmp.head.copy(tmp.aim).project(cam);
  c.uFocus.value.set(tmp.head.x * 0.5 + 0.5, tmp.head.y * 0.5 + 0.5);
  c.uFocusR.value.set(0.3 * Math.min(1, H / W), 0.3);

  // The mirror pass and the frame, of the one scene: the you over the side and the you in the water are the same character.
  renderReflection(gl, scene, f.water, cam, gpu.mirror, gpu, gpu.clip);
  gl.setRenderTarget(null);
  gl.render(gpu.post, gpu.postCam);
}

export default function ReflectionScene({ look, ripples, clock, view }: {
  /** The look the scene shows (it lags the panel's while a ripple rewrites it). */
  look: CharacterLook;
  ripples: React.RefObject<Ripple[]>;
  /** This canvas's clock (s), shared with the ripples' start times. */
  clock: React.RefObject<number>;
  /**
   * The part of the canvas the scene shows in once the panels are in (px, from the top left): the creator's framing is
   * centred there (the panel covers the rest), aboard the whole canvas. Null: the whole canvas.
   */
  view: React.RefObject<{ x: number; y: number; w: number; h: number } | null>;
}) {
  const { gl, scene, camera, size } = useThree();
  const { scene: boatGltf } = useGLTF(BOAT.url);
  const boat = useMemo(() => prepareModel(boatGltf, BOAT.url, undefined, "solid"), [boatGltf]);
  useEffect(() => () => disposeModelMaterials(boat), [boat]);
  const you = useRef<THREE.Group>(null), bram = useRef<THREE.Group>(null), boatGroup = useRef<THREE.Group>(null);
  const youMotion = useRef<CharacterMotion>({ speed: 0, yaw: -Math.PI / 2, lift: 0, pose: "CrouchIdle", play: null });
  const bramMotion = useRef<CharacterMotion>({ speed: 0, yaw: SET.bram.yaw, lift: 0, pose: "Idle", play: null });

  // The two targets: the mirror (its own camera's view of the world above the sea) and the frame (with mips, for the blur).
  const gpu = useMemo(() => makeGpu(), []);
  useEffect(() => () => disposeGpu(gpu), [gpu]);
  useEffect(() => resizeGpu(gpu, size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio()), [gpu, size, gl]);
  const waterMesh = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(), head: new THREE.Vector3(), eye: new THREE.Vector3(),
    aim: new THREE.Vector3(), qa: new THREE.Quaternion(), qc: new THREE.Quaternion() }), []);
  // Takes over the canvas's rendering (priority 1): the mirror, the frame, the composite. The thumbnail baker (priority 0) reads back before it.
  useFrame((_, raw) => drawReflection({ gl, scene, camera: camera as THREE.PerspectiveCamera, size, gpu, tmp, clock, ripples, view, you: you.current, bram: bram.current,
    boat: boatGroup.current, water: waterMesh.current, youMotion: youMotion.current, bramMotion: bramMotion.current }, Math.min(raw, 0.1)), 1);

  return <>
    <hemisphereLight args={["#fff2dc", "#7f9c9a", 1.05]} />
    <directionalLight position={[6, 4.5, 7]} intensity={2.3} color="#ffe6bf" />
    <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#cfe0ee" />
    {/* The light off the water onto a face leaning over it: what lets the reflection read. */}
    <directionalLight position={[-1.5, -4, 0.5]} intensity={1.6} color="#f3ead8" />
    <mesh material={gpu.sky} renderOrder={-10}><sphereGeometry args={[80, 32, 16]} /></mesh>
    <mesh ref={waterMesh} material={gpu.water} rotation-x={-Math.PI / 2}><planeGeometry args={[160, 160, 1, 1]} /></mesh>
    <group ref={boatGroup}><primitive object={boat} scale={BOAT.scale} /></group>
    <group ref={bram}><Suspense fallback={null}><Character look={BRAM_LOOK} motion={bramMotion} lod={false} faceSize={1024} /></Suspense></group>
    <group ref={you}><Suspense fallback={null}><Character look={look} motion={youMotion} lod={false} faceSize={1024} /></Suspense></group>
    <ThumbBaker />
  </>;
}
