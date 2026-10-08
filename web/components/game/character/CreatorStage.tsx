"use client";

/**
 * The creator's 3D (Li'l Lads reference, David 2026-10-08): the portrait and the thumbnail baker, in one canvas.
 *
 * Portrait: the character lit like a studio photo: a soft warm key on the face from the front left, a cool fill from
 * the right, a rim from behind, a soft contact shadow, all matte (row 264). The camera eases between framings (the
 * face up close for face parts, head to toe for clothes); the character turns by drag and by the two buttons.
 *
 * Thumbnails: hair (and any part without an item icon) is drawn once per hair colour and skin, off to the side of the
 * same canvas in the frame before the portrait draws over it, read back and kept as an image for the session. Never a
 * live 3D view per tile.
 */
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Character, { type CharacterMotion } from "./Character";
import { DEFAULT_LOOK, PART_BY_ID, wear, type CharacterLook } from "@/lib/game/character/look";
import type { Framing } from "@/lib/game/character/creatorCategories";

/** Camera per framing (the character stands at scale 1: 1.045 m, the face centre about 0.87 m up). */
export const FRAMES: Record<Framing, { pos: [number, number, number]; at: [number, number, number]; fov: number; yaw: number }> = {
  face: { pos: [0, 0.885, 0.98], at: [0, 0.865, 0], fov: 25, yaw: -0.12 },
  head: { pos: [0, 0.86, 1.42], at: [0, 0.82, 0], fov: 27, yaw: -0.38 },
  upper: { pos: [0, 0.72, 2.02], at: [0, 0.64, 0], fov: 29, yaw: -0.32 },
  body: { pos: [0, 0.6, 2.85], at: [0, 0.5, 0], fov: 29, yaw: -0.32 },
};

/** The studio: key, fill and rim fixed to the camera's side of the set, a little warm sky, nothing shiny. */
function Lights() {
  return <>
    <hemisphereLight args={["#fff4e2", "#cdb995", 0.62]} />
    <directionalLight position={[-1.5, 2.1, 2.5]} intensity={2.3} color="#fff0d9" />
    <directionalLight position={[2.4, 0.9, 1.4]} intensity={0.62} color="#e6eef9" />
    <directionalLight position={[0.9, 2.2, -2.6]} intensity={1.7} color="#fff1dc" />
  </>;
}

/** A soft round shadow under the feet: one textured quad. */
let shadowTex: THREE.Texture | null = null;
function contactTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!, grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(70,50,30,0.55)"); grad.addColorStop(0.55, "rgba(70,50,30,0.22)"); grad.addColorStop(1, "rgba(70,50,30,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}
function Contact() {
  const map = useMemo(() => contactTexture(), []);
  return <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} renderOrder={-1}>
    <planeGeometry args={[0.78, 0.6]} />
    <meshBasicMaterial map={map} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}

const damp = THREE.MathUtils.damp;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Ease the camera toward a framing (snap the first frame, and always under reduced motion). Module scope: hook values are never written in a component. */
function frameCamera(camera: THREE.PerspectiveCamera, at: THREE.Vector3, f: (typeof FRAMES)[Framing], jump: boolean, dt: number) {
  const k = 7, e = (a: number, b: number) => (jump ? b : damp(a, b, k, dt));
  camera.position.set(e(camera.position.x, f.pos[0]), e(camera.position.y, f.pos[1]), e(camera.position.z, f.pos[2]));
  at.set(e(at.x, f.at[0]), e(at.y, f.at[1]), e(at.z, f.at[2]));
  const fov = e(camera.fov, f.fov);
  if (fov !== camera.fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.lookAt(at);
}
/** The turn eases toward its target (the buttons' quarter turns); a drag moves both. */
function easeTurn(yaw: { now: number; target: number }, motion: CharacterMotion, dt: number) {
  yaw.now = reduced() ? yaw.target : damp(yaw.now, yaw.target, 9, dt);
  motion.yaw = yaw.now;
}

/** The portrait: camera easing between framings, the turn eased toward its target. */
export function Portrait({ look, framing, yaw }: { look: CharacterLook; framing: Framing; yaw: RefObject<{ now: number; target: number }> }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: FRAMES[framing].yaw, lift: 0, pose: null, play: null });
  const at = useRef(new THREE.Vector3(...FRAMES[framing].at));
  const snapped = useRef(false);
  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    frameCamera(camera as THREE.PerspectiveCamera, at.current, FRAMES[framing], reduced() || !snapped.current, dt);
    snapped.current = true;
    easeTurn(yaw.current, motion.current, dt);
  });
  return <>
    <Lights />
    <Contact />
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={1024} lod={false} /></Suspense>
  </>;
}

// ── Thumbnails ────────────────────────────────────────────────────────────────────────────────────────────────────

type ThumbView = "front" | "back" | "body";
interface Job { key: string; look: CharacterLook; view: ThumbView }
/** Baked thumbnails for the session (data URLs), by key; the queue the baker works through. */
const thumbs = new Map<string, string>();
let queue: Job[] = [];
/** The job on the baker's set now. */
let current: Job | null = null;
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version++; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** What a hair piece (or a part with no item icon) is drawn on: a plain look, so a thumbnail never needs redrawing for an unrelated choice. */
export function thumbJob(id: string, look: CharacterLook): Job {
  const part = PART_BY_ID.get(id);
  const slot = part?.slot;
  const plain: CharacterLook = { ...DEFAULT_LOOK, skin: look.skin, hair: look.hair, colors: { ...look.colors } };
  const view: ThumbView = slot === "back" ? "back" : slot === "bangs" || part?.group === "head" || part?.group === "face" ? "front" : "body";
  const worn = slot ? wear(plain, slot, id) : plain;
  const colour = part?.materials.some(m => m.tint === "outfit") ? `|c${look.colors[id] ?? "-"}` : "";
  return { key: `${view}|${id}|h${look.hair}|s${look.skin}${colour}`, look: worn, view };
}
/** The baked thumbnail for a job (queued on first ask), or undefined while it waits. */
export function useThumb(job: Job | null): string | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (!job || thumbs.has(job.key) || current?.key === job.key || queue.some(j => j.key === job.key)) return;
    queue.push(job);
    if (!current) current = queue.shift()!;
    notify();
  }, [job]);
  return job ? thumbs.get(job.key) : undefined;
}
/** Jobs for tiles no longer shown wait at the back: the visible category bakes first. */
export function prioritiseThumbs(keys: ReadonlySet<string>) {
  queue = [...queue.filter(j => keys.has(j.key)), ...queue.filter(j => !keys.has(j.key))];
}

const SIZE = 160;
const VIEWS: Record<ThumbView, { pos: [number, number, number]; at: [number, number, number]; fov: number }> = {
  front: { pos: [0.42, 0.98, 1.08], at: [0, 0.875, 0], fov: 23 },
  back: { pos: [0.5, 0.98, -1.05], at: [0, 0.86, 0], fov: 24 },
  body: { pos: [0.6, 0.66, 2.3], at: [0, 0.52, 0], fov: 28 },
};
const still: CharacterMotion = { speed: 0, yaw: 0, lift: 0, pose: null, play: null };

/** The baker's set: its own scene (never drawn by the portrait), camera and read-back buffers. One creator at a time. */
const BAKE = { scene: null as THREE.Scene | null, cam: null as THREE.PerspectiveCamera | null, px: new Uint8Array(SIZE * SIZE * 4), canvas: null as HTMLCanvasElement | null,
  v: new THREE.Vector4(), s: new THREE.Vector4(), size: new THREE.Vector2(), clear: new THREE.Color() };
const bakeScene = () => (BAKE.scene ??= new THREE.Scene());

/**
 * Draw the posed character into the canvas's bottom-left corner and read it back, before the portrait draws this frame
 * over it (the drawing buffer is still this frame's). Same programs, tone mapping and colour space as the portrait.
 */
function bake(gl: THREE.WebGLRenderer, job: Job): boolean {
  const pr = gl.getPixelRatio();
  gl.getDrawingBufferSize(BAKE.size);
  if (BAKE.size.x < SIZE || BAKE.size.y < SIZE) return false;
  const cam = (BAKE.cam ??= new THREE.PerspectiveCamera(24, 1, 0.05, 20)), v = VIEWS[job.view];
  cam.fov = v.fov; cam.position.set(...v.pos); cam.lookAt(...v.at); cam.updateProjectionMatrix();
  gl.getViewport(BAKE.v); gl.getScissor(BAKE.s);
  const scissor = gl.getScissorTest(), alpha = gl.getClearAlpha();
  gl.getClearColor(BAKE.clear);
  gl.setViewport(0, 0, SIZE / pr, SIZE / pr); gl.setScissor(0, 0, SIZE / pr, SIZE / pr); gl.setScissorTest(true);
  gl.setClearColor(0x000000, 0); gl.clear(); gl.render(bakeScene(), cam);
  const ctx = gl.getContext();
  ctx.readPixels(0, 0, SIZE, SIZE, ctx.RGBA, ctx.UNSIGNED_BYTE, BAKE.px);
  gl.setClearColor(BAKE.clear, alpha); gl.setScissorTest(scissor); gl.setViewport(BAKE.v); gl.setScissor(BAKE.s);
  thumbs.set(job.key, encode(BAKE));
  return true;
}

/** Bakes the queue one thumbnail at a time inside the portrait's canvas (no second WebGL context). */
export function ThumbBaker() {
  const job = useSyncExternalStore(subscribe, () => current, () => null);
  const frames = useRef(-1);
  const motion = useRef<CharacterMotion>({ ...still });
  useFrame(({ gl }) => {
    if (!job || frames.current < 0 || ++frames.current < 4) return; // a few frames: the mixer has posed it and the face is set
    if (!bake(gl, job)) return;
    frames.current = -1;
    current = queue.shift() ?? null;
    notify();
  });
  return job ? createPortal(<>
    <Lights />
    <Suspense fallback={null}><Character key={job.key} look={job.look} motion={motion} scale={1} faceSize={1024} lod={false} /><Ready onReady={() => { frames.current = 0; }} /></Suspense>
  </>, bakeScene()) : null;
}
/** Runs once its Suspense boundary has everything (the character's models and atlas). */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}
/** Bottom-up premultiplied pixels to a top-down image. */
function encode(b: { px: Uint8Array; canvas: HTMLCanvasElement | null }) {
  const c = (b.canvas ??= Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE }));
  const g = c.getContext("2d")!, img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = ((SIZE - 1 - y) * SIZE + x) * 4, o = (y * SIZE + x) * 4, a = b.px[i + 3];
    const un = a > 0 && a < 255 ? 255 / a : 1;
    img.data[o] = Math.min(255, b.px[i] * un); img.data[o + 1] = Math.min(255, b.px[i + 1] * un); img.data[o + 2] = Math.min(255, b.px[i + 2] * un); img.data[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/webp", 0.9);
}
