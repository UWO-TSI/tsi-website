"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DRAG_SPIN, dragSwing, newSwing, spinTwist, stepSwingFor, type Swing } from "@/lib/game/keychainSwing";

import styles from "./Lanyard.module.css";
import { PEOPLE } from "@/components/site/marks";

// The club's own lanyard, the game's model (specs/merch/tsi-lanyard.md, art/merch/build_lanyard.py): one unit is 10 cm,
// hung from a peg at its origin, its two strands down to the sewn tab, a D-ring and a snap hook. It swings as the game's
// does (lib/game/keychainSwing.ts, a small verlet chain, no physics library): three links for the strands (the game's
// LANYARD_LINKS), one for the hook, one from the card's slot to its middle. The hook holds the card, a 12 x 17 cm invite.
const LANYARD_URL = "/assets/game/items/merch-tsi-lanyard.glb";
const DROP = 4.356;
const LINKS = [1.45, 1.45, DROP - 2.9];
const CARD_W = 1.2;
const CARD_H = 1.69;
const CARD_T = 0.02;
const CARD_R = 0.09;
const SLOT_W = 0.24;
const SLOT_H = 0.045;
const SLOT_Y = CARD_H / 2 - 0.09;
/** From the strands' foot to the hook's tip: the D-ring and the snap hook, which sits in the card's slot. */
const HOOK = 0.5;
/** The peg, above the frame, so the card hangs a little below the middle with the strands running up out of view. */
const PEG_Y = DROP + HOOK + SLOT_Y - 0.35;
const INK = "#0f0f10";
const PAPER = "#f1ffff";
const BLUE = "#1d9bf0";
const PX = 1024;

/** A canvas texture redrawn once the site's fonts have loaded (the faces are set in Söhne). */
function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => { g.clearRect(0, 0, w, h); paint(g); tex.needsUpdate = true; };
  draw();
  document.fonts?.ready.then(draw, () => {});
  return tex;
}

/** The Tethos mark (the six people), drawn at (x, y) to a width. */
function drawMark(g: CanvasRenderingContext2D, x: number, y: number, width: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(width / 1410, width / 1410);
  g.fillStyle = color;
  for (const p of PEOPLE) g.fill(new Path2D(p.d), p.evenodd ? "evenodd" : "nonzero");
  g.restore();
}

/** A faint field of characters over a face, on the site's grid. */
function drawField(g: CanvasRenderingContext2D, w: number, h: number, words: string, alpha: number) {
  g.save();
  g.font = `500 22px "Sohne Mono", ui-monospace, monospace`;
  g.fillStyle = PAPER;
  g.globalAlpha = alpha;
  const cw = 14, ch = 26;
  let k = 0;
  for (let y = ch; y < h; y += ch) for (let x = 0; x < w; x += cw) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    if (s - Math.floor(s) < 0.42) g.fillText(words[k++ % words.length], x, y);
  }
  g.restore();
}

/** The front: the invite. */
function paintFront(g: CanvasRenderingContext2D) {
  const W = PX, H = Math.round(PX * CARD_H / CARD_W);
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  drawField(g, W, H, "GENESIS · ", 0.07);
  const glow = g.createRadialGradient(W * 0.7, H * 0.45, 40, W * 0.7, H * 0.45, 640);
  glow.addColorStop(0, "rgba(29,155,240,0.26)"); glow.addColorStop(1, "rgba(29,155,240,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  drawMark(g, 80, 170, 120, PAPER);
  g.fillStyle = PAPER; g.font = `500 28px "Sohne Mono", ui-monospace, monospace`; g.globalAlpha = 0.6;
  g.fillText("TETHOS", 226, 222); g.fillText("TECH FOR SOCIAL IMPACT", 226, 258); g.globalAlpha = 1;
  g.font = `600 40px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = BLUE; g.fillText("YOU’RE INVITED", 80, 580);
  g.font = `700 196px "Sohne", sans-serif`; g.fillStyle = PAPER; g.fillText("GENESIS", 72, 780);
  g.fillStyle = BLUE; g.fillText("2027", 72, 970);
  g.font = `500 32px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.globalAlpha = 0.66;
  g.fillText("PROJECT SHOWCASE · MARCH 2027", 80, 1050); g.globalAlpha = 1;
  g.strokeStyle = "rgba(241,255,255,0.25)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(80, 1190); g.lineTo(W - 80, 1190); g.stroke();
  const cta = "SPONSOR GENESIS 2027  →";
  g.font = `600 34px "Sohne Mono", ui-monospace, monospace`;
  const pw = g.measureText(cta).width + 76;
  g.beginPath(); g.roundRect(80, 1240, pw, 84, 42); g.fillStyle = BLUE; g.fill();
  g.fillStyle = INK; g.textBaseline = "middle"; g.fillText(cta, 118, 1283); g.textBaseline = "alphabetic";
}

/** The back: the mark, big, and the address. */
function paintBack(g: CanvasRenderingContext2D) {
  const W = PX, H = Math.round(PX * CARD_H / CARD_W);
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  drawField(g, W, H, "TETHOS · BUILT FOR PURPOSE · ", 0.08);
  drawMark(g, W / 2 - 300, 440, 600, PAPER);
  g.font = `500 34px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.globalAlpha = 0.6;
  g.textAlign = "center"; g.fillText("TETHOS.CA", W / 2, 1300); g.textAlign = "left"; g.globalAlpha = 1;
}

/** A rounded rectangle traced into a shape or a hole. */
function rounded(p: THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
}

/** The card's outline: rounded corners, and the slot the hook goes through. */
function cardShape() {
  const s = new THREE.Shape();
  rounded(s, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_R);
  const slot = new THREE.Path();
  rounded(slot, -SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, SLOT_H / 2);
  s.holes.push(slot);
  return s;
}

/** A printed face: the outline, its texture laid over the whole card. */
function faceGeometry(shape: THREE.Shape) {
  const geo = new THREE.ShapeGeometry(shape, 12);
  const pos = geo.getAttribute("position"), uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CARD_W / 2) / CARD_W, (pos.getY(i) + CARD_H / 2) / CARD_H);
  return geo;
}

interface Bent { mesh: THREE.Mesh; along: Float32Array; local: Float32Array; localN: Float32Array }
interface Rig { root: THREE.Object3D; strap: Bent[]; hardware: THREE.Object3D }

/** The model, with each strap vertex placed on the rope: how far down it is, and where it sits round the rope's line
 * there (as the game's Lanyard does). The hardware is made metal. */
function buildRig(scene: THREE.Object3D): Rig {
  const root = scene.clone(true);
  root.updateMatrixWorld(true);
  const strapNode = root.getObjectByName("lanyard_strap"), hardware = root.getObjectByName("lanyard_hardware");
  if (!strapNode || !hardware) throw new Error("lanyard model has no strap or hardware");
  const metal = new THREE.MeshStandardMaterial({ color: "#c9ced3", metalness: 1, roughness: 0.3 });
  hardware.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = metal; });
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
  const strap: Bent[] = [];
  strapNode.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute, nrm = mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const n = pos.count, along = new Float32Array(n), local = new Float32Array(n * 3), localN = new Float32Array(nrm.array);
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i), d = Math.min(DROP, Math.max(0, -y));
      along[i] = d;
      local[i * 3] = pos.getX(i); local[i * 3 + 1] = y + d; local[i * 3 + 2] = pos.getZ(i);
    }
    strap.push({ mesh, along, local, localN });
  });
  return { root, strap, hardware };
}

const down = new THREE.Vector3(0, -1, 0), dA = new THREE.Vector3(), dB = new THREE.Vector3(), dir = new THREE.Vector3();
const q = new THREE.Quaternion(), v = new THREE.Vector3(), p = new THREE.Vector3();
/** Bend the strap along the rope (peg, two joints, the strands' foot) and hang the hardware from its foot toward the
 * card's slot. Module scope: the frame loop writes the three objects. */
function bend(rig: Rig, pts: THREE.Vector3[]) {
  for (const part of rig.strap) {
    const pos = part.mesh.geometry.getAttribute("position") as THREE.BufferAttribute, nrm = part.mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const P = pos.array as Float32Array, N = nrm.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      let d = part.along[i], k = 0;
      while (k < 2 && d > LINKS[k]) { d -= LINKS[k]; k++; }
      const t = Math.min(1, d / LINKS[k]);
      const a = pts[k], b = pts[k + 1];
      p.lerpVectors(a, b, t);
      // The rope's direction, eased from one link to the next across each joint, so the strap bends smoothly.
      dA.subVectors(b, a).normalize();
      dB.subVectors(pts[Math.min(k + 2, 3)], b);
      if (k < 2 && dB.lengthSq() > 1e-10) { dB.normalize(); dir.copy(dA).lerp(dB, Math.max(0, t - 0.5)).normalize(); } else dir.copy(dA);
      if (part.along[i] <= 0) dir.copy(down);
      q.setFromUnitVectors(down, dir);
      v.set(part.local[i * 3], part.local[i * 3 + 1], part.local[i * 3 + 2]).applyQuaternion(q).add(p);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      v.set(part.localN[i * 3], part.localN[i * 3 + 1], part.localN[i * 3 + 2]).applyQuaternion(q);
      N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
    }
    pos.needsUpdate = true; nrm.needsUpdate = true;
  }
  rig.hardware.position.copy(pts[3]);
  dir.subVectors(pts[4], pts[3]);
  if (dir.lengthSq() > 1e-10) rig.hardware.quaternion.setFromUnitVectors(down, dir.normalize());
}

type LanyardProps = {
  position?: [number, number, number];
  fov?: number;
  /** false: the scene stops drawing (off screen). */
  active?: boolean;
  /** A click (or tap) on the card, not a drag. */
  onOpen?: () => void;
};

export default function Lanyard({ position = [0, 0, 30], fov = 20, active = true, onOpen }: LanyardProps) {
  // Touch screens can't drag the card (it would fight the page scroll); a tap still opens it.
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  const [isMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  return (
    <div className={styles.lanyardWrapper}>
      <Canvas
        frameloop={active ? "always" : "never"}
        style={{ touchAction: "pan-y" }}
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      >
        {/* Soft enough that the strap stays navy and the card stays ink, as printed. */}
        <ambientLight intensity={1.2} />
        <Band touch={touch} onOpen={onOpen} />
        <Environment blur={0.75} environmentIntensity={0.6}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

/** The swing runs this much faster than the game's, so the card drops in and settles briskly. */
const PACE = 1.8;
const LINKS_ALL = [...LINKS, HOOK, SLOT_Y];
const PEG = new THREE.Vector3(0, PEG_Y, 0);

/** The chain laid out to the right of the peg, level with it, so it drops in and swings down as it appears. */
function droppingSwing(): Swing {
  const s = newSwing(LINKS_ALL);
  let x = 0;
  s.p.forEach((pt, i) => { if (i) x += LINKS_ALL[i - 1] * 0.8; pt[0] = x; pt[1] = 0; pt[2] = 0; });
  s.prev = s.p.map((pt) => [...pt] as [number, number, number]);
  s.spin = 2.5;
  return s;
}

function Band({ touch, onOpen }: { touch: boolean; onOpen?: () => void }) {
  const card = useRef<THREE.Group>(null);
  const { scene } = useGLTF(LANYARD_URL);
  const rig = useMemo(() => buildRig(scene), [scene]);
  useEffect(() => () => rig.strap.forEach((b) => b.mesh.geometry.dispose()), [rig]);
  const [front] = useState(() => canvasTexture(PX, Math.round(PX * CARD_H / CARD_W), paintFront));
  const [back] = useState(() => canvasTexture(PX, Math.round(PX * CARD_H / CARD_W), paintBack));
  const geo = useMemo(() => {
    const shape = cardShape();
    const body = new THREE.ExtrudeGeometry(shape, { depth: CARD_T, bevelEnabled: false, curveSegments: 12 });
    body.translate(0, 0, -CARD_T / 2);
    return { body, face: faceGeometry(shape) };
  }, []);

  const [swing] = useState(droppingSwing);
  const [scratch] = useState(() => ({
    pts: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3()), up: new THREE.Vector3(), q: new THREE.Quaternion(), turn: new THREE.Quaternion(),
    plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3(),
  }));
  // While dragged: the pointer's id, the grab's offset from the card's middle, and the last x (a sideways sweep spins it).
  const grab = useRef<{ id: number; dx: number; dy: number; x: number } | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const [hovered, hover] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!hovered && !dragging) return;
    document.body.style.cursor = dragging ? "grabbing" : "pointer";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered, dragging]);

  useFrame((_, delta) => {
    stepSwingFor(swing, delta * PACE);
    const { pts, up, q, turn } = scratch;
    swing.p.forEach((pt, i) => pts[i].set(pt[0], pt[1], pt[2]).add(PEG));
    bend(rig, pts);
    // The card hangs from its slot: its middle at the chain's end, upright along the last link, turned by the twist.
    const c = card.current;
    if (!c) return;
    c.position.copy(pts[5]);
    up.subVectors(pts[4], pts[5]).normalize();
    q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, up);
    turn.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, swing.twist);
    c.quaternion.copy(q).multiply(turn);
  });

  /** Where the pointer's ray meets the card's plane, in the swing's own units (the peg at 0). */
  const at = (e: ThreeEvent<PointerEvent>) => (e.ray.intersectPlane(scratch.plane, scratch.hit) ? scratch.hit.clone().sub(PEG) : null);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    press.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    if (touch) return;
    const p = at(e), mid = swing.p[5];
    if (!p) return;
    try { (e.target as unknown as Element).setPointerCapture?.(e.pointerId); } catch { /* not an active pointer */ }
    grab.current = { id: e.pointerId, dx: p.x - mid[0], dy: p.y - mid[1], x: e.nativeEvent.clientX };
    setDragging(true);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    const p = at(e);
    if (!p) return;
    dragSwing(swing, [p.x - g.dx, p.y - g.dy, 0]);
    spinTwist(swing, (e.nativeEvent.clientX - g.x) * DRAG_SPIN * 0.4);
    g.x = e.nativeEvent.clientX;
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    try { (e.target as unknown as Element).releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    dragSwing(swing, null);
    grab.current = null;
    setDragging(false);
  };
  // The card is several meshes, so one click arrives once for each under the pointer: only the first counts, and only
  // if it pressed on the card and barely moved (more than that was a drag).
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = press.current;
    press.current = null;
    if (!p || Math.hypot(e.nativeEvent.clientX - p.x, e.nativeEvent.clientY - p.y) > 6) return;
    onOpen?.();
  };

  return (
    <>
      <group ref={card} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={onClick}>
        {/* A matte card with rounded corners and a slot: the edge, and the two printed faces. */}
        <mesh geometry={geo.body}>
          <meshStandardMaterial color="#1b1b1e" roughness={0.9} />
        </mesh>
        <mesh geometry={geo.face} position={[0, 0, CARD_T / 2 + 0.001]}>
          <meshStandardMaterial map={front} roughness={0.85} />
        </mesh>
        <mesh geometry={geo.face} position={[0, 0, -CARD_T / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial map={back} roughness={0.85} />
        </mesh>
      </group>
      <primitive object={rig.root} />
    </>
  );
}
