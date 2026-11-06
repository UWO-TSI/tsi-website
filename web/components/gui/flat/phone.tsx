"use client";

/**
 * The phone (design bible UI 8d). Round 9 (David on the UI view's bar: "pressing a button and a phone pops up on the
 * bottom right and the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"); round 10
 * ("phone model, make it 3d blender with a slide up animation"): a slider phone modelled in Blender
 * (art/ui/slider_phone.py). Round 12 (David: "the phone is angled so the ui also needs to have the same angle, i want
 * either the ui to be baked in the model", "the phone tiles with the mouse", "make it pull out and filp open and not 1
 * motion", "current ui but green highlights and giving it a pixel finish from the overall pixelation"): the model is
 * drawn live in a small canvas at the world's pixel finish, it leans toward the cursor, it pulls out and then flips open
 * (phoneMotion.ts), and its screen is a texture on the model's glass. Invisible buttons laid on the glass by the same
 * projection take the clicks, the keyboard and screen readers. Round 13 (David: "the ui and app design needs to be
 * redone to fit the theme", "should have pixel wash but shouldnt be pixel wash over pixel, should be 1 and lighter",
 * "the charm on the phone is a accessory, and it has proper physics"): the screen is the phone's own pixel-art design
 * (phoneScreen.ts), and it and the keypad's digits are drawn after the body's pixel pass, so their one pixel finish is their
 * own. The charm (`charm`, its own model: a strap and a pendant) hangs on the top half, so a charm can be swapped. Round
 * 14 (David: "keep it old but lewss blurry", "numbers can be lighter with the pixel effect on it", "the string is not
 * made to physics"): the home screen is round 12's (today's UI, green highlights) again, the glass and the digits get one
 * light pixel finish (a CSS pixel a pixel, half the island's), and the strap bends along a short simulated rope. An app opens its own sheet while the
 * phone tucks down out of the way (`away`). Colours: the theme's --ui-* tokens. Plain props; nothing here knows the
 * game. Shown on /lab/gui?only=phone.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PIXEL_FINISH } from "@/lib/game/qualityTier";
import { FLAT_DEFINE } from "@/lib/game/curvedWorld";
import { afterEntry } from "@/lib/game/sceneGate";
import { SCREEN, TEX, charmStill, hangCharm, phoneBox, quadMatrix, restMotion, screenLayout, settled, stepCharm, stepMotion, type CharmSim, type PhoneMotion, type V3 } from "./phoneMotion";
import { HOME_TOKENS, INK_TOKENS, drawHome, type Ink } from "./phoneScreen";
import { KeywordIcon, type KeywordKind } from "./keyword";
import p from "./phone.module.css";

export interface PhoneApp {
  id: string; label: string;
  /** Its icon on the card: the icon library's drawing, in its tone. */
  icon: KeywordKind;
  /** The key that opens it from the world (not shown on a touch screen). */
  keyLabel?: string;
  /** New things inside (letters, friend asks). */
  badge?: number;
  onOpen: () => void;
}

/** A screen of its own on the glass in place of the home screen (an app, or a moment like setting it up). */
export interface PhoneView {
  /** Changes when it's a different screen: its clock starts again. */
  id: string;
  /** Draws the glass in screen pixels (phoneScreen's helpers); `t` is seconds since this screen came up. */
  draw: (g: CanvasRenderingContext2D, ink: Ink, t: number) => void;
  /** Animating: drawn every frame while true. */
  moving?: boolean;
  /** Its controls, in screen pixels, laid on the glass like the apps. */
  controls?: ReactNode;
}

export const PHONE_URL = "/assets/ui/phone/phone.glb";
/** The charm on the strap: the jelly star (a cosmetic slot: another charm is another model hung the same way). */
export const CHARM_STAR = "/assets/ui/phone/charm-star.glb";
/** How far the top half slides up to open (model units), the phone's resting lean, and how far it follows the cursor (rad). */
const SLIDE = 4.8, REST = { yaw: -0.2, pitch: -0.1 }, FOLLOW = { yaw: 0.26, pitch: 0.14 };
/** The camera's distance (units): far enough to keep the phone's shape, near enough that its lean reads as 3D. */
const CAM_Z = 28;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The layer drawn after the body's pixel pass, with its own light finish: the glass and the keypad's digits. */
const SHARP = 1;
/** The strap's links: enough that it bends like a string, few enough to stay cheap. */
const STRAP_LINKS = 5;

// ── The model ────────────────────────────────────────────────────────────────────────────────────────────────
type Box = ReturnType<typeof phoneBox>;
interface Live {
  open: boolean; away: boolean; box: Box;
  /** The cursor, from -1 to 1 either way of the phone's middle. */
  aim: { x: number; y: number };
  screen: HTMLElement | null; hitTop: HTMLElement | null; hitBase: HTMLElement | null;
  onRest: (gone: boolean) => void;
  /** The model hands over how to wake it (draw a frame: the screen's texture changed). */
  onWake: (wake: () => void) => void;
}

const corners = (o: THREE.Object3D, box: THREE.Box3) => [
  new THREE.Vector3(box.min.x, box.max.y, box.max.z), new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  new THREE.Vector3(box.max.x, box.min.y, box.max.z), new THREE.Vector3(box.min.x, box.min.y, box.max.z),
].map(v => o.localToWorld(v));

/**
 * The charm's two parts (charm-star.glb, and any charm made the same way): the strap, modelled straight from the mount
 * (its origin) to the pendant, and the pendant at its end. The strap's mesh bends along the rope (`bendStrap`): each
 * vertex keeps how far down the strap it is and its offset from the strap's line. The pendant swings about its top.
 */
function charmRig(charmScene: THREE.Object3D) {
  const hang = charmScene.clone(true), root = hang.getObjectByName("charm") ?? hang;
  const pendant = root.getObjectByName("pendant")!, drop = pendant.position.clone();
  let mesh: THREE.Mesh | null = null;
  root.getObjectByName("strap")?.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  const strap = mesh as unknown as THREE.Mesh;
  hang.updateMatrixWorld(true);
  const mid = new THREE.Box3().setFromObject(pendant, true).getCenter(new THREE.Vector3()).sub(drop);
  // Its own copy of the strap, in the charm's space (the phone and the pitch's phone each bend theirs).
  const geo = strap.geometry.clone();
  geo.applyMatrix4(strap.matrix); strap.position.set(0, 0, 0); strap.quaternion.identity(); strap.scale.set(1, 1, 1);
  strap.geometry = geo; strap.frustumCulled = false;
  const axis = drop.clone().normalize(), length = drop.length(), pos = geo.attributes.position, nor = geo.attributes.normal;
  const along = new Float32Array(pos.count), off = new Float32Array(pos.count * 3), rest = Float32Array.from(nor.array);
  for (let i = 0; i < pos.count; i++) {
    const v = tmp.a.fromBufferAttribute(pos, i), d = v.dot(axis);
    along[i] = Math.min(1, Math.max(0, d / length));
    v.addScaledVector(axis, -d).toArray(off, i * 3);
  }
  const swing = new THREE.Group();
  root.add(swing); swing.add(pendant); pendant.position.set(0, 0, 0);
  return { root, strap, swing, axis, midAxis: mid.clone().normalize(), len: [...Array<number>(STRAP_LINKS).fill(length / STRAP_LINKS), mid.length()], along, off, rest };
}
type CharmRig = ReturnType<typeof charmRig>;

/** The phone, its sliding top half, the glass, the charm, and the faces the hit areas follow. */
function buildRig(scene: THREE.Object3D, charmScene: THREE.Object3D, texture: THREE.Texture) {
  const phone = scene.clone(true);
  const top = phone.getObjectByName("top")!, screen = phone.getObjectByName("screen") as THREE.Mesh;
  screen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  screen.geometry.computeBoundingBox();
  // The glass and the digits are drawn after the body's pixel pass, at full resolution (round 13).
  screen.layers.set(SHARP);
  phone.getObjectByName("digits")?.traverse(o => o.layers.set(SHARP));
  const mount = phone.getObjectByName("charm_mount")!, charm = charmRig(charmScene);
  mount.add(charm.root);
  // The base and the top half's fronts, for the invisible hit areas (the open phone's face, whatever its lean).
  const face = (name: string) => { const o = phone.getObjectByName(name)!; return { o, box: new THREE.Box3().setFromObject(o, true) }; };
  // Outside the world: none of the island's horizon bend (lib/game/curvedWorld), which would sink it from its camera.
  phone.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.defines = { ...m.defines, [FLAT_DEFINE]: "" }; m.needsUpdate = true; } });
  const root = new THREE.Group(); root.add(phone); phone.position.y = -2.4;  // it turns about the open phone's middle
  return { root, phone, top, screen, mount, charm, base: face("base"), topBody: face("top_body") };
}
type Rig = ReturnType<typeof buildRig>;

/** The camera frames the box's view of the phone exactly (phoneMotion.VIEW), looking straight in. */
function frameCamera(cam: THREE.PerspectiveCamera, v: Box["view"]) {
  cam.position.set((v.left + v.right) / 2, (v.bottom + v.top) / 2, CAM_Z);
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((v.top - v.bottom) / 2 / CAM_Z));
  cam.aspect = (v.right - v.left) / (v.top - v.bottom); cam.near = 1; cam.far = 80;
  cam.updateProjectionMatrix();
}

const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion() };
/** The phone's side and faces, in its own space: the charm's points stay outside them (the star's and the ring's size). */
function solidFor(phone: THREE.Object3D, pendantAt: number) {
  const inv = new THREE.Matrix4();
  return (p: V3, i: number): V3 | null => {
    inv.copy(phone.matrixWorld).invert();
    const l = tmp.a.set(...p).applyMatrix4(inv), r = i === pendantAt ? 0.75 : 0.2, side = -2.5 - r, front = 0.62 + r, back = -0.72 - r;
    if (l.x <= side || l.z >= front || l.z <= back) return null;
    const out = [side - l.x, front - l.z, back - l.z];
    const k = [Math.abs(out[0]), Math.abs(out[1]), Math.abs(out[2])].reduce((best, d, j, all) => (d < all[best] ? j : best), 0);
    if (k === 0) l.x = side; else l.z = k === 1 ? front : back;
    return v3(l.applyMatrix4(phone.matrixWorld));
  };
}
const SAMPLES = 4 * STRAP_LINKS + 1;
const bend = { p: Array.from({ length: SAMPLES }, () => new THREE.Vector3()), q: Array.from({ length: SAMPLES }, () => new THREE.Quaternion()), r: [] as THREE.Vector3[] };
/**
 * The strap bent along the rope (a curve through its points, from the pin) and the pendant hung from its end: in the
 * charm's own space, each vertex is the curve's point at its way down the strap plus its offset turned to the curve's
 * direction there, and its normal turned the same.
 */
function bendStrap(c: CharmRig, sim: CharmSim) {
  const r = bend.r, n = STRAP_LINKS;
  for (let i = 0; i <= n + 1; i++) {
    r[i] ??= new THREE.Vector3();
    if (i === 0) r[0].set(0, 0, 0); else c.root.worldToLocal(r[i].set(...sim.p[i - 1]));
  }
  const at = (i: number) => r[Math.max(0, Math.min(n, i))];
  // Catmull-Rom through the strap's points: a smooth string, no kinks at the joints.
  for (let k = 0; k < SAMPLES; k++) {
    const f = (k / (SAMPLES - 1)) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)], t2 = t * t, t3 = t2 * t;
    bend.p[k].set(0, 0, 0)
      .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
      .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
    const d = tmp.b.set(0, 0, 0)
      .addScaledVector(p0, -1.5 * t2 + 2 * t - 0.5).addScaledVector(p1, 4.5 * t2 - 5 * t)
      .addScaledVector(p2, -4.5 * t2 + 4 * t + 0.5).addScaledVector(p3, 1.5 * t2 - t);
    bend.q[k].setFromUnitVectors(c.axis, d.lengthSq() > 1e-12 ? d.normalize() : c.axis);
  }
  const pos = c.strap.geometry.attributes.position as THREE.BufferAttribute, nor = c.strap.geometry.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const f = c.along[i] * (SAMPLES - 1), k = Math.min(SAMPLES - 2, Math.floor(f)), q = bend.q[Math.round(f)];
    const v = tmp.a.fromArray(c.off, i * 3).applyQuaternion(q).add(tmp.b.lerpVectors(bend.p[k], bend.p[k + 1], f - k));
    pos.setXYZ(i, v.x, v.y, v.z);
    const m = tmp.a.fromArray(c.rest, i * 3).applyQuaternion(q);
    nor.setXYZ(i, m.x, m.y, m.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  // The pendant at the strap's end, turned to hang toward its own point.
  c.swing.position.copy(r[n]);
  c.swing.quaternion.setFromUnitVectors(c.midAxis, tmp.b.subVectors(r[n + 1], r[n]).normalize());
}

/** One frame: the two motions, the lean toward the cursor, the charm, and the screen's buttons laid on the glass. */
function poseRig(rig: Rig, m: PhoneMotion, t: { yaw: number; pitch: number }, sim: { s: CharmSim | null }, L: Live, camera: THREE.Camera, dt: number) {
  const calm = reduced();
  stepMotion(m, { open: L.open, tucked: L.away }, dt, calm);
  // It leans toward the cursor, easing there.
  const ease = 1 - Math.exp(-dt * 7);
  const yaw = REST.yaw + L.aim.x * FOLLOW.yaw, pitch = REST.pitch - L.aim.y * FOLLOW.pitch;
  t.yaw += (yaw - t.yaw) * ease; t.pitch += (pitch - t.pitch) * ease;
  const out = 1 - m.rise.x;
  // Pulled out: up from below the corner, lying back, and straightening as it comes; flipped open: the top half
  // slides up and the phone flicks back a touch with it.
  rig.root.position.set(0, -out * 16 + 2.4, 0);
  rig.root.rotation.set(t.pitch + out * 0.7 - m.slide.v * 0.01, t.yaw - out * 0.2, out * 0.25, "YXZ");
  rig.top.position.y = m.slide.x * SLIDE;
  rig.root.updateMatrixWorld(true);
  // The charm swings with whatever the mount did: hung afresh each time the phone comes out from away.
  const mount = v3(rig.mount.getWorldPosition(tmp.a));
  if (!sim.s || m.rise.x < 1e-3) sim.s = hangCharm(mount, rig.charm.len);
  else stepCharm(sim.s, mount, dt, solidFor(rig.phone, STRAP_LINKS), calm);
  bendStrap(rig.charm, sim.s);
  // The screen's buttons and the hit areas follow the glass: its corners, projected to the box's pixels.
  const { w, h } = L.box;
  const toPx = (v: THREE.Vector3) => { v.project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h] as const; };
  const lay = (el: HTMLElement | null, o: THREE.Object3D, box: THREE.Box3, bw: number, bh: number) => {
    if (!el) return;
    const [a, b, c, d] = corners(o, box).map(toPx);
    el.style.transform = quadMatrix(bw, bh, a, b, c, d);
  };
  lay(L.screen, rig.screen, rig.screen.geometry.boundingBox!, SCREEN.w, SCREEN.h);
  lay(L.hitTop, rig.topBody.o, rig.topBody.box, 100, 100);
  lay(L.hitBase, rig.base.o, rig.base.box, 100, 100);
  const done = settled(m, { open: L.open, tucked: L.away }) && charmStill(sim.s) && Math.abs(yaw - t.yaw) < 1e-3 && Math.abs(pitch - t.pitch) < 1e-3;
  return { still: done, gone: done && !L.open && m.rise.x < 1e-3 };
}

/**
 * The body's pixel pass, then the sharp layer's (rounds 13 and 14, David: "shouldnt be pixel wash over pixel, should be
 * 1 and lighter", "keep it old but lewss blurry"): the body and the charm render small, at the world's pixel finish; the
 * glass and the digits render at a CSS pixel a pixel (half the island's pixel, and the screen's texture finer still, so
 * nothing is sampled down twice), hidden where the body is in front (its depth, drawn into the same target first). Both
 * are scaled up without smoothing, the body under the glass. With the finish off it's one plain render.
 */
function usePasses(pixelated: boolean) {
  const { scene, size } = useThree();
  const pass = useMemo(() => {
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter } as const;
    const body = new THREE.WebGLRenderTarget(1, 1, opts), sharp = new THREE.WebGLRenderTarget(1, 1, { ...opts, samples: 4 });
    const quad = new THREE.PlaneGeometry(2, 2);
    const blit = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: body.texture, depthTest: false, depthWrite: false, blending: THREE.NoBlending }));
    // The sharp layer over it, its edges antialiased (premultiplied, as the target holds them); the glass's colours are exact (no tone map).
    const over = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: sharp.texture, depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    const depth = new THREE.MeshBasicMaterial({ colorWrite: false });
    depth.defines = { [FLAT_DEFINE]: "" };
    return { body, sharp, blit, over, flat: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), depth };
  }, []);
  useEffect(() => () => {
    pass.body.dispose(); pass.sharp.dispose(); pass.blit.geometry.dispose();
    (pass.blit.material as THREE.Material).dispose(); (pass.over.material as THREE.Material).dispose(); pass.depth.dispose();
  }, [pass]);
  useEffect(() => {
    pass.body.setSize(Math.max(1, Math.round(size.width / PIXEL_FINISH)), Math.max(1, Math.round(size.height / PIXEL_FINISH)));
    pass.sharp.setSize(Math.max(1, Math.round(size.width)), Math.max(1, Math.round(size.height)));
  }, [pass, size]);
  useEffect(() => { scene.traverse(o => { if ((o as THREE.Light).isLight) o.layers.enableAll(); }); });
  return ({ gl, scene, camera }: RootState) => {
    if (!pixelated) { camera.layers.enableAll(); gl.autoClear = true; gl.render(scene, camera); return; }
    gl.autoClear = false; gl.setClearColor(0, 0);
    camera.layers.set(0);
    gl.setRenderTarget(pass.body); gl.clear(); gl.render(scene, camera);
    gl.setRenderTarget(pass.sharp); gl.clear();
    scene.overrideMaterial = pass.depth; gl.render(scene, camera); scene.overrideMaterial = null;
    camera.layers.set(SHARP); gl.render(scene, camera);
    gl.setRenderTarget(null); gl.clear(); gl.render(pass.blit, pass.flat); gl.render(pass.over, pass.flat);
  };
}

function Model({ live, texture, charm, open, away, pixelated }: { live: React.RefObject<Live>; texture: THREE.Texture; charm: string; open: boolean; away: boolean; pixelated: boolean }) {
  const { scene } = useGLTF(PHONE_URL), { scene: charmScene } = useGLTF(charm);
  const { camera, invalidate, size } = useThree();
  const rig = useMemo(() => buildRig(scene, charmScene, texture), [scene, charmScene, texture]);
  const motion = useRef(restMotion());
  const tilt = useRef({ yaw: REST.yaw, pitch: REST.pitch });
  const sim = useRef<{ s: CharmSim | null }>({ s: null });
  const was = useRef<boolean | null>(null);
  const render = usePasses(pixelated);
  useEffect(() => { live.current.onWake(invalidate); }, [live, invalidate]);
  useEffect(() => { frameCamera(camera as THREE.PerspectiveCamera, live.current.box.view); invalidate(); }, [camera, invalidate, size, live]);
  // Opened, put away or tucked: wake up and move.
  useEffect(() => invalidate(), [invalidate, open, away, pixelated]);
  useEffect(() => {
    const move = () => invalidate();
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [invalidate]);
  // Priority 1: this frame draws the canvas itself (the two passes).
  useFrame((root, dt) => {
    const { still, gone } = poseRig(rig, motion.current, tilt.current, sim.current, live.current, camera, dt);
    render(root);
    if (!still) invalidate();
    if (gone !== was.current) { was.current = gone; live.current.onRest(gone); }
  }, 1);
  return <primitive object={rig.root} />;
}

/** An app's icon (the library's drawing, in its tone) as a picture for the texture. */
function iconImage(el: Element | null): Promise<HTMLImageElement | null> {
  const svg = el?.querySelector("svg");
  if (!svg) return Promise.resolve(null);
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", "72"); copy.setAttribute("height", "72");
  copy.setAttribute("style", `color: ${getComputedStyle(svg).color}`);
  copy.setAttribute("stroke-width", "2");
  return new Promise(done => {
    const img = new Image(); img.onload = () => done(img); img.onerror = () => done(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  });
}

// Fetched once the world is in, so it never comes up blank.
afterEntry(() => { useGLTF.preload(PHONE_URL); useGLTF.preload(CHARM_STAR); });

export function Phone({ open, apps, away, hint, onClose, pixelated = true, touch = false, charm = CHARM_STAR, view, testId = "phone" }: {
  open: boolean; apps: readonly PhoneApp[];
  /** A screen of its own in place of the home screen. */
  view?: PhoneView;
  /** An app is open: the phone tucks down out of the way until it closes. */
  away?: boolean;
  /** On the home bar: the key that puts it away. */
  hint?: string;
  /** The home bar: put the phone away. */
  onClose: () => void;
  /** The world's pixel finish is on: the phone is drawn at its pixel size, like the island. */
  pixelated?: boolean;
  /** A touch screen: the phone may take more of it. */
  touch?: boolean;
  /** The charm on its strap (a model URL). */
  charm?: string;
  testId?: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [gone, setGone] = useState(true);
  const [live, setLive] = useState(false);
  const [pick, setPick] = useState<{ at: number | null; keys: boolean }>({ at: null, keys: false });
  const nav = useRef<HTMLElement>(null);
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = SCREEN.w * TEX; c.height = SCREEN.h * TEX; return c;
  }, []);
  const texture = useMemo(() => {
    // glTF's UVs run top down. Each screen pixel is TEX texture pixels, so smooth sampling keeps them sharp squares.
    const t = new THREE.CanvasTexture(canvas ?? undefined); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false; return t;
  }, [canvas]);
  const state = useRef<Live>({ open, away: !!away, box: phoneBox(1440, 900, touch, PIXEL_FINISH), aim: { x: -0.5, y: 0.3 }, screen: null, hitTop: null, hitBase: null, onRest: g => setGone(g), onWake: f => { wake.current = f; } });
  const wake = useRef<(() => void) | null>(null);
  // The model reads these each frame.
  useEffect(() => {
    const L = state.current;
    L.open = open; L.away = !!away;
    if (box) L.box = box;
  }, [open, away, box]);
  // The model mounts at the first open, or a moment after the world is entered, so the first open doesn't wait for it.
  if (open && !live) setLive(true);
  if (open && gone) setGone(false);
  useEffect(() => afterEntry(() => window.setTimeout(() => setLive(true), 1500)), []);
  // Sized to the game's layer it sits in (the window, less any bar above it).
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current?.parentElement;
    if (!el) return;
    const fit = () => setBox(phoneBox(el.clientWidth, el.clientHeight, touch, PIXEL_FINISH));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [touch]);
  // It leans toward the cursor (from the phone's middle, a window's width or height either way).
  useEffect(() => {
    const aim = (e: PointerEvent) => {
      const r = host.current?.getBoundingClientRect();
      if (document.pointerLockElement || !r?.width) return;
      const cx = r.left + r.width * 0.6, cy = r.top + r.height * 0.45;
      state.current.aim = { x: Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))), y: Math.max(-1, Math.min(1, (cy - e.clientY) / (window.innerHeight / 2))) };
    };
    window.addEventListener("pointermove", aim);
    return () => window.removeEventListener("pointermove", aim);
  }, []);
  // The apps' icons as pictures for the texture, once they're on the page in their tones.
  const icons = useRef<(HTMLElement | null)[]>([]);
  const [pics, setPics] = useState<readonly (HTMLImageElement | null)[]>([]);
  const iconKey = apps.map(a => a.icon).join();
  useEffect(() => {
    let alive = true;
    void Promise.all(apps.map((_, i) => iconImage(icons.current[i] ?? null))).then(list => { if (alive) setPics(list); });
    return () => { alive = false; };
  }, [iconKey]); // eslint-disable-line react-hooks/exhaustive-deps -- the icons follow the apps' icons
  // Draw the screen whenever what's on it changes (a moving view, every frame; again once the font is in).
  const [fontIn, setFontIn] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontIn(n => n + 1)); }, []);
  const since = useRef({ id: "", at: 0 });
  useEffect(() => {
    const el = nav.current, g = canvas?.getContext("2d");
    if (!el || !g) return;
    const css = getComputedStyle(el);
    const read = <T extends Record<string, string>>(tokens: T) => Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, css.getPropertyValue(v).trim()])) as T;
    const ink = read(INK_TOKENS), home = read(HOME_TOKENS);
    if (view && since.current.id !== view.id) since.current = { id: view.id, at: performance.now() };
    let frame = 0;
    const draw = () => {
      if (view) view.draw(g, ink, (performance.now() - since.current.at) / 1000);
      else drawHome(g, apps, pics, pick, touch ? undefined : hint, home, css.fontFamily);
      texture.needsUpdate = true;
      wake.current?.();
      if (view?.moving) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [apps, pics, pick, hint, touch, canvas, texture, view, fontIn]);
  useEffect(() => () => texture.dispose(), [texture]);

  const shown = open || !gone;
  const L = screenLayout(apps.length);
  const at = ([x, y, w, h]: readonly number[]): CSSProperties => ({ left: x, top: y, width: w, height: h });
  const usable = open && !away;
  const focus = (i: number, keys: boolean) => () => setPick({ at: i, keys });
  const blur = () => setPick({ at: null, keys: false });
  return <div ref={host} className={`${p.phone} gui`} data-gui-flat="" data-state={open ? "open" : shown ? "closing" : undefined} data-away={away || undefined}
    style={box ? { left: box.left, top: box.top, width: box.w, height: box.h, visibility: shown ? undefined : "hidden" } : { visibility: "hidden" }}
    aria-hidden={!usable || undefined} data-testid={testId}>
    {live && box && <Canvas className={p.stage} frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, position: [0, 0, CAM_Z] }} gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      {/* A soft light from the upper right and the front, so the pearl keeps its shape and the clear parts their edge. */}
      <hemisphereLight args={["#ffffff", "#cdd8cc", 1.15]} />
      <directionalLight position={[4, 5, 7]} intensity={1.5} />
      <directionalLight position={[-5, 1, 4]} intensity={0.45} />
      <Suspense fallback={null}><Model live={state} texture={texture} charm={charm} open={open} away={!!away} pixelated={pixelated} /></Suspense>
    </Canvas>}
    <div ref={el => { state.current.hitBase = el; }} className={p.hit} />
    <div ref={el => { state.current.hitTop = el; }} className={p.hit} />
    <nav ref={el => { nav.current = el; state.current.screen = el; }} className={p.screen} style={{ width: SCREEN.w, height: SCREEN.h }} aria-label="Phone">
      {view ? view.controls : <>{apps.map((a, i) => <button key={a.id} type="button" className={p.app} style={at(L.tiles[i])} onClick={a.onOpen} tabIndex={usable ? undefined : -1}
        onPointerEnter={focus(i, false)} onPointerLeave={blur} onFocus={e => setPick({ at: i, keys: e.currentTarget.matches(":focus-visible") })} onBlur={blur}
        aria-label={a.badge ? `${a.label}, ${a.badge} new` : a.label} title={a.keyLabel ? `${a.label} (${a.keyLabel})` : a.label}>
        <span ref={el => { icons.current[i] = el; }} className={p.icon} aria-hidden="true"><KeywordIcon kind={a.icon} /></span>
      </button>)}
      <button type="button" className={p.app} style={at(L.home)} onClick={onClose} tabIndex={usable ? undefined : -1} aria-label="Put the phone away"
        onPointerEnter={focus(apps.length, false)} onPointerLeave={blur} onFocus={e => setPick({ at: apps.length, keys: e.currentTarget.matches(":focus-visible") })} onBlur={blur} /></>}
    </nav>
  </div>;
}
