"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import * as THREE from "three";

import styles from "./Lanyard.module.css";
import { PEOPLE } from "@/components/site/marks";

// The club's own lanyard, the game's model (specs/merch/tsi-lanyard.md, art/merch/build_lanyard.py): one unit is 10 cm,
// hung from a peg at its origin, its two strands down to the sewn tab, a D-ring and a snap hook. Here the strands follow
// a physics rope (three links, the game's LANYARD_LINKS) and the hook holds the card, a 12 x 17 cm invite.
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
  gravity?: [number, number, number];
  fov?: number;
  /** false: the scene stops drawing (off screen). */
  active?: boolean;
  /** A click (or tap) on the card, not a drag. */
  onOpen?: () => void;
};

export default function Lanyard({ position = [0, 0, 30], gravity = [0, -40, 0], fov = 20, active = true, onOpen }: LanyardProps) {
  // Touch screens can't drag the card (it would fight the page scroll); a tap still opens it.
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band touch={touch} onOpen={onOpen} />
        </Physics>
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

function Band({ maxSpeed = 50, minSpeed = 0, touch, onOpen }: { maxSpeed?: number; minSpeed?: number; touch: boolean; onOpen?: () => void }) {
  /* eslint-disable @typescript-eslint/no-explicit-any -- rapier's rigid body refs */
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */

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

  const [scratch] = useState(() => ({
    vec: new THREE.Vector3(), dir: new THREE.Vector3(), rot: new THREE.Vector3(), ang: new THREE.Vector3(),
    quat: new THREE.Quaternion(), pts: [0, 1, 2, 3, 4].map(() => new THREE.Vector3()),
  }));
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);
  const press = useRef<{ x: number; y: number } | null>(null);

  const segmentProps = { type: "dynamic", canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 } as const;
  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], LINKS[0]]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], LINKS[1]]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], LINKS[2]]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, SLOT_Y + HOOK, 0]]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? "grabbing" : "pointer";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    const { vec, dir: d, rot, ang, quat, pts } = scratch;
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      d.copy(vec).sub(state.camera.position).normalize();
      vec.add(d.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (!fixed.current || !j1.current || !j2.current || !j3.current || !card.current) return;
    // The two middle joints are eased toward the physics, so the strap bends without jitter.
    [j1, j2].forEach((ref) => {
      if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
      const gap = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
      ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + gap * (maxSpeed - minSpeed)));
    });
    pts[0].copy(fixed.current.translation());
    pts[1].copy(j1.current.lerped);
    pts[2].copy(j2.current.lerped);
    pts[3].copy(j3.current.translation());
    const r = card.current.rotation();
    quat.set(r.x, r.y, r.z, r.w);
    pts[4].set(0, SLOT_Y, 0).applyQuaternion(quat).add(card.current.translation());
    bend(rig, pts);
    // The card keeps turning back to face the room.
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());
    card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    press.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    if (touch) return;
    (e.target as unknown as HTMLElement).setPointerCapture(e.pointerId);
    drag(new THREE.Vector3().copy(e.point).sub(scratch.vec.copy(card.current.translation())));
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (touch) return;
    (e.target as unknown as HTMLElement).releasePointerCapture(e.pointerId);
    drag(false);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const at = press.current;
    press.current = null;
    if (at && Math.hypot(e.nativeEvent.clientX - at.x, e.nativeEvent.clientY - at.y) > 6) return; // that was a drag
    onOpen?.();
  };

  const x0 = LINKS[0] * 0.7;
  return (
    <>
      <group position={[0, PEG_Y, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[x0, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[x0 * 2, 0, 0]} ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[x0 * 3, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[x0 * 3, -(SLOT_Y + HOOK), 0]} ref={card} {...segmentProps} type={dragged ? "kinematicPosition" : "dynamic"}>
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, CARD_T / 2]} />
          <group onPointerOver={() => hover(true)} onPointerOut={() => hover(false)} onPointerDown={onDown} onPointerUp={onUp} onClick={onClick}>
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
        </RigidBody>
      </group>
      <primitive object={rig.root} />
    </>
  );
}
