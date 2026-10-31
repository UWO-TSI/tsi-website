"use client";

/**
 * The TSI lanyard (specs/merch/tsi-lanyard.md), built from David's photo and print files (art/merch/build_lanyard.py):
 * a navy ribbon printed both sides, folded over a peg, its two strands down to the sewn tab, a D-ring and a swivel snap
 * hook. It sways a little on its own; on the shop's wall (`grab`) you can take hold of it and pull it about, and let go
 * it settles back. The sway is the keychain's verlet chain (lib/game/keychainSwing.ts) down the strands; the strap bends
 * along it (its vertices carried by the chain, worked out once from where each sits at rest) and the hardware hangs
 * from its foot.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { prepareModel } from "@/lib/game/modelMaterials";
import { dragSwing, newSwing, stepSwingFor, type Swing } from "@/lib/game/keychainSwing";
import { afterEntry } from "@/lib/game/sceneGate";

export const LANYARD_URL = "/assets/game/items/merch-tsi-lanyard.glb";
export const LANYARD_SLUG = "merch-tsi-lanyard";
/** From the peg to the snap hook's foot, at rest (model units of 10 cm: 48.6 cm). */
export const LANYARD_HANG = 4.86;
/** The strands' foot below the peg (build_lanyard.py S_STRAND), and the swing's links: the strap in three, the hardware. */
const DROP = 4.356;
export const LANYARD_LINKS = [1.45, 1.45, DROP - 2.9, 0.5] as const;
/** The slight sway on its own: how hard, and how slow (rad/s). */
const BREEZE = 0.00018, BREEZE_W = 0.7;

interface Bent { mesh: THREE.Mesh; along: Float32Array; local: Float32Array; localN: Float32Array }
interface Rig { root: THREE.Group; strap: Bent[]; hardware: THREE.Object3D }
/** The model, prepared (the shared presets), and each vertex of the strap (its print and its stitching) placed on the
 * chain: how far down it is and where it sits round the chain's line there. */
function buildRig(scene: THREE.Object3D): Rig {
  const model = prepareModel(scene, LANYARD_URL);
  model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const strapNode = model.getObjectByName("lanyard_strap"), hardware = model.getObjectByName("lanyard_hardware");
  if (!strapNode || !hardware) throw new Error("lanyard model has no strap or hardware");
  const strap: Bent[] = [];
  strapNode.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();                   // its own copy: it bends
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute, nrm = mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const n = pos.count, along = new Float32Array(n), local = new Float32Array(n * 3), localN = new Float32Array(nrm.array);
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i), d = Math.min(DROP, Math.max(0, -y));   // over the peg: 0 (held); below the foot: the foot
      along[i] = d;
      local[i * 3] = pos.getX(i); local[i * 3 + 1] = y + d; local[i * 3 + 2] = pos.getZ(i);
    }
    strap.push({ mesh, along, local, localN });
  });
  const root = new THREE.Group();
  root.add(model);
  return { root, strap, hardware };
}

const down = new THREE.Vector3(0, -1, 0), dA = new THREE.Vector3(), dB = new THREE.Vector3(), dir = new THREE.Vector3();
const q = new THREE.Quaternion(), v = new THREE.Vector3(), p = new THREE.Vector3();
/** Module scope (the frame loop writes the three objects): bend the strap along the chain, hang the hardware. */
function pose(rig: Rig, s: Swing) {
  const pts = s.p, lens = s.len;
  for (const part of rig.strap) {
    const pos = part.mesh.geometry.getAttribute("position") as THREE.BufferAttribute, nrm = part.mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const P = pos.array as Float32Array, N = nrm.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      let d = part.along[i], k = 0;
      while (k < 2 && d > lens[k]) { d -= lens[k]; k++; }
      const t = Math.min(1, d / lens[k]);
      const a = pts[k], b = pts[k + 1];
      p.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      // the line's direction, eased from one link to the next across each joint, so the strap bends smoothly
      dA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const c = pts[Math.min(k + 2, 3)];
      dB.set(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
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
  // the hardware hangs from the strap's foot, along the last link
  const f = pts[3], e = pts[4];
  rig.hardware.position.set(f[0], f[1], f[2]);
  dir.set(e[0] - f[0], e[1] - f[1], e[2] - f[2]);
  if (dir.lengthSq() > 1e-10) rig.hardware.quaternion.setFromUnitVectors(down, dir.normalize());
}

export default function Lanyard({ grab = false, scale = 1, position, still = false }: {
  /** On the shop's wall: take hold of it and pull it about. */
  grab?: boolean;
  scale?: number; position?: [number, number, number];
  /** No sway of its own (the merch view's stage turns it instead). */
  still?: boolean;
}) {
  const { scene } = useGLTF(LANYARD_URL);
  const rig = useMemo(() => buildRig(scene), [scene]);
  const swing = useRef<Swing>(newSwing(LANYARD_LINKS));
  const gesture = useRef<{ id: number } | null>(null);
  const group = useRef<THREE.Group>(null);
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => rig.strap.forEach(b => b.mesh.geometry.dispose()), [rig]);
  useFrame(({ clock }, dt) => {
    const s = swing.current;
    if (!still && !gesture.current) {                         // a breath of air: the end drifts a hair side to side
      const last = s.p.length - 1;
      s.prev[last][0] -= Math.sin(clock.elapsedTime * BREEZE_W) * BREEZE;
      s.prev[last][2] -= Math.cos(clock.elapsedTime * BREEZE_W * 0.7) * BREEZE * 0.5;
    }
    stepSwingFor(s, dt);
    pose(rig, s);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!grab) return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    gesture.current = { id: e.pointerId };
    group.current!.getWorldPosition(hit);
    plane.setFromNormalAndCoplanarPoint(e.camera.getWorldDirection(new THREE.Vector3()).negate(), hit);
    document.body.style.cursor = "grabbing";
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const gs = gesture.current;
    if (!grab || !gs || gs.id !== e.pointerId) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(plane, hit)) return;
    group.current!.worldToLocal(hit);
    dragSwing(swing.current, [hit.x, hit.y, hit.z]);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const gs = gesture.current;
    if (!grab || !gs || gs.id !== e.pointerId) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    dragSwing(swing.current, null);
    gesture.current = null;
    document.body.style.cursor = "";
  };
  return <group ref={group} position={position} scale={scale}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    onClick={e => { if (grab) e.stopPropagation(); }}
    onPointerOver={() => { if (grab && !gesture.current) document.body.style.cursor = "grab"; }}
    onPointerOut={() => { if (!gesture.current) document.body.style.cursor = ""; }}>
    <primitive object={rig.root} />
  </group>;
}

afterEntry(() => useGLTF.preload(LANYARD_URL));
