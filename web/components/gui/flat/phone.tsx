"use client";

/**
 * The phone (design bible UI 8d). Round 9 (David on the UI view's bar: "pressing a button and a phone pops up on the
 * bottom right and the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"); round 10
 * ("phone model, make it 3d blender with a slide up animation"): a slider phone modelled in Blender
 * (art/ui/slider_phone.py). Round 12 (David: "the phone is angled so the ui also needs to have the same angle, i want
 * either the ui to be baked in the model", "the phone tiles with the mouse", "make it pull out and filp open and not 1
 * motion", "current ui but green highlights and giving it a pixel finish from the overall pixelation"): the model is
 * drawn live in a small canvas at the world's pixel finish, it leans toward the cursor, it pulls out and then flips open
 * (phoneMotion.ts), and its screen is a texture on the model's glass: today's UI (white cards, the library's icons, the
 * kit's font) with green highlights, so the pixel finish washes it like the island. Invisible buttons laid on the
 * glass by the same projection take the clicks, the keyboard and screen readers. The strap and its star are their own
 * model (`charm`), hung on the top half, so a charm can be swapped. An app opens its own sheet while the phone tucks
 * down out of the way (`away`). Colours: the theme's --ui-* tokens. Plain props; nothing here knows the game. Shown on
 * /lab/gui?only=phone.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PIXEL_FINISH } from "@/lib/game/qualityTier";
import { FLAT_DEFINE } from "@/lib/game/curvedWorld";
import { afterEntry } from "@/lib/game/sceneGate";
import { SCREEN, TEX, phoneBox, quadMatrix, restMotion, screenLayout, settled, stepMotion, type PhoneMotion } from "./phoneMotion";
import p from "./phone.module.css";

export interface PhoneApp {
  id: string; label: string; icon: ReactNode;
  /** The key that opens it from the world (not shown on a touch screen). */
  keyLabel?: string;
  /** New things inside (letters, friend asks). */
  badge?: number;
  onOpen: () => void;
}

export const PHONE_URL = "/assets/ui/phone/phone.glb";
/** The charm on the strap: the jelly star (a cosmetic slot: another charm is another model hung the same way). */
export const CHARM_STAR = "/assets/ui/phone/charm-star.glb";
/** How far the top half slides up to open (model units), the phone's resting lean, and how far it follows the cursor (rad). */
const SLIDE = 4.8, REST = { yaw: -0.2, pitch: -0.1 }, FOLLOW = { yaw: 0.26, pitch: 0.14 };
/** The camera's distance (units): far enough to keep the phone's shape, near enough that its lean reads as 3D. */
const CAM_Z = 28;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── The screen's texture ─────────────────────────────────────────────────────────────────────────────────────
/** The pointing hand on the keyboard's pick (round 11's pixel hand): o its outline, w its fill. */
const HAND = ["..ooo....", ".owwwoooo", "owwwwwwwo", "owwwwoooo", "owwwwwo..", ".owwwwo..", "..oooo..."];
type Ink = Record<"screen" | "card" | "ink" | "ink2" | "line" | "glow" | "glowSoft" | "pill" | "badge" | "badgeInk" | "shade", string>;
const TOKENS: Record<keyof Ink, string> = {
  screen: "--ui-phone-screen", card: "--ui-card", ink: "--ui-ink", ink2: "--ui-ink-2", line: "--ui-line", glow: "--ui-phone-glow",
  glowSoft: "--ui-phone-glow-soft", pill: "--ui-pill", badge: "--ui-heart", badgeInk: "--ui-accent-ink", shade: "--ui-shade",
};
function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }

/** The home screen, in the screen's own pixels (SCREEN, drawn at TEX times): the status line, the app cards, the home bar. */
function drawScreen(tex: THREE.CanvasTexture, c: HTMLCanvasElement, apps: readonly PhoneApp[], icons: readonly (HTMLImageElement | null)[], pick: { at: number | null; keys: boolean },
  hint: string | undefined, ink: Ink, font: string) {
  const g = c.getContext("2d");
  if (!g) return;
  const L = screenLayout(apps.length);
  g.setTransform(TEX, 0, 0, TEX, 0, 0);
  g.fillStyle = ink.screen; g.fillRect(0, 0, SCREEN.w, SCREEN.h);
  // The status line: the signal and the battery, quiet.
  g.fillStyle = ink.ink2;
  for (let i = 0; i < 3; i++) g.fillRect(8 + i * 3, 7 - i * 1.5, 2, 1.5 + i * 1.5);
  g.strokeStyle = ink.ink2; g.lineWidth = 1; round(g, SCREEN.w - 19.5, 3.5, 10, 5, 1.2); g.stroke();
  g.fillRect(SCREEN.w - 9, 5, 1.2, 2); g.fillStyle = ink.glow; g.fillRect(SCREEN.w - 18, 5, 7, 2);
  g.textAlign = "center"; g.textBaseline = "middle";
  L.tiles.forEach(([x, y, w, h], i) => {
    const a = apps[i], on = pick.at === i, lift = on ? -1 : 0;
    // A white card in a soft shadow; picked, it's green (round 12: "green highlights") and up a pixel.
    g.fillStyle = `rgb(${ink.shade} / 0.13)`; round(g, x, y + 1.5, w, h, 6); g.fill();
    g.fillStyle = on ? ink.glowSoft : ink.card; round(g, x, y + lift, w, h, 6); g.fill();
    g.lineWidth = on ? 1.6 : 0.8; g.strokeStyle = on ? ink.glow : ink.line; round(g, x + 0.4, y + lift + 0.4, w - 0.8, h - 0.8, 5.6); g.stroke();
    const icon = icons[i];
    if (icon) g.drawImage(icon, x + w / 2 - 9, y + lift + 5, 18, 18);
    let size = 8.5;
    g.font = `800 ${size}px ${font}`;
    while (size > 6 && g.measureText(a.label).width > w - 6) g.font = `800 ${(size -= 0.5)}px ${font}`;
    g.fillStyle = ink.ink; g.fillText(a.label, x + w / 2, y + lift + h - 8.5);
    if (a.keyLabel) {
      g.fillStyle = ink.pill; round(g, x + 3, y + lift + 3, 9, 9, 2.5); g.fill();
      g.fillStyle = ink.ink2; g.font = `800 6.5px ${font}`; g.fillText(a.keyLabel, x + 7.5, y + lift + 7.8);
    }
    if (a.badge) {
      g.fillStyle = ink.badge; g.beginPath(); g.arc(x + w - 5, y + lift + 5, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink.badgeInk; g.font = `800 6px ${font}`; g.fillText(a.badge > 9 ? "9+" : String(a.badge), x + w - 5, y + lift + 5.4);
    }
    if (on && pick.keys) {
      HAND.forEach((row, r) => [...row].forEach((ch, col) => {
        if (ch === ".") return;
        g.fillStyle = ch === "o" ? ink.ink : ink.card; g.fillRect(x - 3 + col * 1.5, y + lift + h / 2 - 5 + r * 1.5, 1.5, 1.5);
      }));
    }
  });
  // The home bar: a pill with the key that puts it away; green when picked.
  const [hx, hy, hw, hh] = L.home, homeOn = pick.at === apps.length;
  g.fillStyle = homeOn ? ink.glow : ink.pill; round(g, hx, hy, hw, hh, hh / 2); g.fill();
  if (hint) { g.fillStyle = homeOn ? ink.card : ink.ink2; g.font = `800 6.5px ${font}`; g.fillText(hint, hx + hw / 2, hy + hh / 2 + 0.4); }
  tex.needsUpdate = true;
}

/** An app's icon (the library's drawing, in its tone) as a picture for the texture. */
function iconImage(el: Element | null): Promise<HTMLImageElement | null> {
  const svg = el?.querySelector("svg");
  if (!svg) return Promise.resolve(null);
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", "48"); copy.setAttribute("height", "48");
  copy.setAttribute("style", `color: ${getComputedStyle(svg).color}`);
  copy.setAttribute("stroke-width", "2");
  return new Promise(done => {
    const img = new Image(); img.onload = () => done(img); img.onerror = () => done(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  });
}

// ── The model ────────────────────────────────────────────────────────────────────────────────────────────────
type Box = ReturnType<typeof phoneBox>;
interface Live {
  open: boolean; away: boolean; box: Box;
  /** The cursor, from -1 to 1 either way of the phone's middle. */
  aim: { x: number; y: number };
  screen: HTMLElement | null; hitTop: HTMLElement | null; hitBase: HTMLElement | null;
  onRest: (gone: boolean) => void;
}

const corners = (o: THREE.Object3D, box: THREE.Box3) => [
  new THREE.Vector3(box.min.x, box.max.y, box.max.z), new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  new THREE.Vector3(box.max.x, box.min.y, box.max.z), new THREE.Vector3(box.min.x, box.min.y, box.max.z),
].map(v => o.localToWorld(v));

/** The phone, its sliding top half, the glass, the strap's swing, and the faces the hit areas follow. */
function buildRig(scene: THREE.Object3D, charmScene: THREE.Object3D, texture: THREE.Texture) {
  const phone = scene.clone(true), hang = charmScene.clone(true);
  const top = phone.getObjectByName("top")!, screen = phone.getObjectByName("screen") as THREE.Mesh;
  screen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  screen.geometry.computeBoundingBox();
  const swing = new THREE.Group();
  phone.getObjectByName("charm_mount")!.add(swing); swing.add(hang);
  // The base and the top half's fronts, for the invisible hit areas (the open phone's face, whatever its lean).
  const face = (name: string) => { const o = phone.getObjectByName(name)!; return { o, box: new THREE.Box3().setFromObject(o, true) }; };
  // Outside the world: none of the island's horizon bend (lib/game/curvedWorld), which would sink it from its camera.
  phone.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.defines = { ...m.defines, [FLAT_DEFINE]: "" }; m.needsUpdate = true; } });
  const root = new THREE.Group(); root.add(phone); phone.position.y = -2.4;  // it turns about the open phone's middle
  return { root, top, screen, swing, base: face("base"), topBody: face("top_body") };
}
type Rig = ReturnType<typeof buildRig>;

/** The camera frames the box's view of the phone exactly (phoneMotion.VIEW), looking straight in. */
function frameCamera(cam: THREE.PerspectiveCamera, v: Box["view"]) {
  cam.position.set((v.left + v.right) / 2, (v.bottom + v.top) / 2, CAM_Z);
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((v.top - v.bottom) / 2 / CAM_Z));
  cam.aspect = (v.right - v.left) / (v.top - v.bottom); cam.near = 1; cam.far = 80;
  cam.updateProjectionMatrix();
}

/** One frame: the two motions, the lean toward the cursor, and the screen's buttons laid on the glass. */
function poseRig(rig: Rig, m: PhoneMotion, t: { yaw: number; pitch: number }, L: Live, camera: THREE.Camera, dt: number) {
  stepMotion(m, { open: L.open, tucked: L.away }, dt, reduced());
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
  rig.swing.rotation.z = m.swing.x * 0.5 + t.yaw * 0.15;
  rig.root.updateMatrixWorld(true);
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
  const still = settled(m, { open: L.open, tucked: L.away }) && Math.abs(yaw - t.yaw) < 1e-3 && Math.abs(pitch - t.pitch) < 1e-3;
  return { still, gone: still && !L.open && m.rise.x < 1e-3 };
}

function Model({ live, texture, charm, open, away }: { live: React.RefObject<Live>; texture: THREE.Texture; charm: string; open: boolean; away: boolean }) {
  const { scene } = useGLTF(PHONE_URL), { scene: charmScene } = useGLTF(charm);
  const { camera, invalidate, size } = useThree();
  const rig = useMemo(() => buildRig(scene, charmScene, texture), [scene, charmScene, texture]);
  const motion = useRef(restMotion());
  const tilt = useRef({ yaw: REST.yaw, pitch: REST.pitch });
  const was = useRef<boolean | null>(null);
  useEffect(() => { frameCamera(camera as THREE.PerspectiveCamera, live.current.box.view); invalidate(); }, [camera, invalidate, size, live]);
  // Opened, put away or tucked: wake up and move.
  useEffect(() => invalidate(), [invalidate, open, away]);
  useEffect(() => {
    const move = () => invalidate();
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [invalidate]);
  useFrame((_, dt) => {
    const { still, gone } = poseRig(rig, motion.current, tilt.current, live.current, camera, dt);
    if (!still) invalidate();
    if (gone !== was.current) { was.current = gone; live.current.onRest(gone); }
  });
  return <primitive object={rig.root} />;
}

// Fetched once the world is in, so it never comes up blank.
afterEntry(() => { useGLTF.preload(PHONE_URL); useGLTF.preload(CHARM_STAR); });

export function Phone({ open, apps, away, hint, onClose, pixelated = true, touch = false, charm = CHARM_STAR, testId = "phone" }: {
  open: boolean; apps: readonly PhoneApp[];
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
  const icons = useRef<HTMLSpanElement[]>([]);
  const [pics, setPics] = useState<(HTMLImageElement | null)[]>([]);
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = SCREEN.w * TEX; c.height = SCREEN.h * TEX; return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas ?? undefined); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false; return t;  // glTF's UVs run top down
  }, [canvas]);
  const state = useRef<Live>({ open, away: !!away, box: phoneBox(1440, 900, touch, PIXEL_FINISH), aim: { x: -0.5, y: 0.3 }, screen: null, hitTop: null, hitBase: null, onRest: g => setGone(g) });
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
  const iconKey = apps.map(a => a.id).join();
  useEffect(() => {
    let alive = true;
    void Promise.all(apps.map((_, i) => iconImage(icons.current[i] ?? null))).then(list => { if (alive) setPics(list); });
    return () => { alive = false; };
  }, [iconKey]); // eslint-disable-line react-hooks/exhaustive-deps -- the icons follow the apps' ids
  // Draw the screen whenever what's on it changes (and again once the font is in).
  const [fontIn, setFontIn] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontIn(n => n + 1)); }, []);
  useEffect(() => {
    const el = nav.current;
    if (!el || !canvas) return;
    const css = getComputedStyle(el);
    const ink = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, css.getPropertyValue(v).trim()])) as Ink;
    drawScreen(texture, canvas, apps, pics, pick, touch ? undefined : hint, ink, css.fontFamily);
  }, [apps, pics, pick, hint, touch, canvas, texture, fontIn]);
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
    {live && box && <Canvas className={p.stage} frameloop="demand" dpr={pixelated ? 1 / PIXEL_FINISH : [1, 2]} camera={{ fov: 30, position: [0, 0, CAM_Z] }}
      gl={{ antialias: !pixelated, alpha: true }} style={{ imageRendering: pixelated ? "pixelated" : "auto" }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      {/* A soft light from the upper right and the front, so the pearl keeps its shape and the clear parts their edge. */}
      <hemisphereLight args={["#ffffff", "#cdd8cc", 1.15]} />
      <directionalLight position={[4, 5, 7]} intensity={1.5} />
      <directionalLight position={[-5, 1, 4]} intensity={0.45} />
      <Suspense fallback={null}><Model live={state} texture={texture} charm={charm} open={open} away={!!away} /></Suspense>
    </Canvas>}
    <div ref={el => { state.current.hitBase = el; }} className={p.hit} />
    <div ref={el => { state.current.hitTop = el; }} className={p.hit} />
    <nav ref={el => { nav.current = el; state.current.screen = el; }} className={p.screen} style={{ width: SCREEN.w, height: SCREEN.h }} aria-label="Phone">
      {apps.map((a, i) => <button key={a.id} type="button" className={p.app} style={at(L.tiles[i])} onClick={a.onOpen} tabIndex={usable ? undefined : -1}
        onPointerEnter={focus(i, false)} onPointerLeave={blur} onFocus={e => setPick({ at: i, keys: e.currentTarget.matches(":focus-visible") })} onBlur={blur}
        aria-label={a.badge ? `${a.label}, ${a.badge} new` : a.label} title={a.keyLabel ? `${a.label} (${a.keyLabel})` : a.label}>
        <span ref={el => { if (el) icons.current[i] = el; }} className={p.icon} aria-hidden="true">{a.icon}</span>
      </button>)}
      <button type="button" className={p.app} style={at(L.home)} onClick={onClose} tabIndex={usable ? undefined : -1} aria-label="Put the phone away"
        onPointerEnter={focus(apps.length, false)} onPointerLeave={blur} onFocus={e => setPick({ at: apps.length, keys: e.currentTarget.matches(":focus-visible") })} onBlur={blur} />
    </nav>
  </div>;
}
