"use client";

/**
 * The TSI keycap keychain (specs/merch/tsi-keycap-keychain.md), built from David's photos
 * (art/merch/build_keycap_keychain.py; its keycap faces +z): it hangs from its keyring and swings on its chain (lib/game/keychainSwing.ts),
 * and a click on the keycap presses it in with a click (with the keycap off, the bare stem) (the "keyswitch" sound, through the game's audio: its mute and
 * volume). On the shop's wall (`grab`) you can take hold of it: drag pulls it about and twists it, and let go it swings
 * back. In the shop's detail view the stage turns it instead (TurnStage), and a tap on the keycap presses it.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { prepareModel } from "@/lib/game/modelMaterials";
import { capOffset, dragSwing, newPress, newSwing, pressDepth, pressKey, spinTwist, stepCap, stepSwingFor, type Swing } from "@/lib/game/keychainSwing";

export const KEYCHAIN_URL = "/assets/game/items/merch-tsi-keycap-keychain.glb";
/** How far the keycap goes in, bottomed out (model units: the switch's 4 mm travel). */
export const KEYCAP_TRAVEL = 0.035;
const PARTS = ["keychain_ring", "keychain_chain_0", "keychain_chain_1", "keychain_chain_2", "keychain_chain_3", "keychain_body"] as const;

interface Rig { root: THREE.Group; parts: THREE.Object3D[]; keycap: THREE.Object3D; keycapRest: THREE.Vector3; stem: THREE.Object3D; stemRest: THREE.Vector3 }
/** The model, prepared (the shared presets; the acrylic see-through), taken apart into the parts that swing. */
function buildRig(scene: THREE.Object3D): Rig {
  const model = prepareModel(scene, KEYCHAIN_URL);
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m.name.startsWith("P_Glass")) { m.transparent = true; m.depthWrite = false; mesh.renderOrder = 2; }
  });
  model.updateMatrixWorld(true);
  const root = new THREE.Group();
  const parts = PARTS.map(name => {
    const part = model.getObjectByName(name);
    if (!part) throw new Error(`keychain model has no ${name}`);
    root.add(part);              // out of the static tree: each part is posed from the swing
    return part;
  });
  const body = parts[parts.length - 1];
  const keycap = body.getObjectByName("keychain_keycap")!, stem = body.getObjectByName("keychain_stem")!;
  return { root, parts, keycap, keycapRest: keycap.position.clone(), stem, stemRest: stem.position.clone() };
}

const down = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3(), twistQ = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
/** Module scope (the frame loop writes the three objects): pose each part from its link of the swing; the stem in by
 * the press, and the keycap on it, or `cap` of the way off and aside. */
function pose(rig: Rig, s: Swing, depth: number, cap: number) {
  rig.parts.forEach((part, i) => {
    const a = s.p[i], b = s.p[i + 1];
    part.position.set(a[0], a[1], a[2]);
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    part.quaternion.setFromUnitVectors(down, dir);
    if (i === rig.parts.length - 1) part.quaternion.multiply(twistQ.setFromAxisAngle(yAxis, s.twist));
  });
  const pressIn = depth * KEYCAP_TRAVEL;            // in, toward the block (−z)
  rig.stem.position.set(rig.stemRest.x, rig.stemRest.y, rig.stemRest.z - pressIn);
  const [ox, oy, oz, turn] = capOffset(cap);
  rig.keycap.position.set(rig.keycapRest.x + ox, rig.keycapRest.y + oy, rig.keycapRest.z + oz - (cap > 0 ? 0 : pressIn));
  rig.keycap.rotation.y = turn;
}

const isPart = (o: THREE.Object3D | null, name: string) => { for (let x = o; x; x = x.parent) if (x.name === name) return true; return false; };
/** The click, as the keycap goes in (the file carries the return too). */
export function playKeyswitch() { AudioManager.playSFX("keyswitch", { gain: 0.9 }); }

export default function KeycapKeychain({ grab = false, onKeycapDown, scale = 1, position, press, keycapOff = false }: {
  /** On the shop's wall: drag it about; a click on the keycap presses it. */
  grab?: boolean;
  /** In the detail view: the keycap's pointer-down (the stage decides if it was a tap). */
  onKeycapDown?: (pressNow: () => void) => void;
  scale?: number; position?: [number, number, number];
  /** Pressed from outside (the evidence script): a counter that presses it each time it changes. */
  press?: number;
  /** The keycap off (the merch view's button): it lifts off the stem and hovers beside the block; the stem presses. */
  keycapOff?: boolean;
}) {
  const { scene } = useGLTF(KEYCHAIN_URL);
  const rig = useMemo(() => buildRig(scene), [scene]);
  const swing = useRef<Swing>(newSwing());
  const keyPress = useRef(newPress());
  const cap = useRef(0);
  const gesture = useRef<{ id: number; x: number; y: number; moved: number; keycap: boolean } | null>(null);
  const group = useRef<THREE.Group>(null);
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const pressNow = useMemo(() => () => { pressKey(keyPress.current, performance.now() / 1000); playKeyswitch(); }, []);
  useEffect(() => { if (press) pressNow(); }, [press, pressNow]);
  useFrame((_, dt) => {
    stepSwingFor(swing.current, dt);
    cap.current = stepCap(cap.current, keycapOff, Math.min(dt, 0.1));
    pose(rig, swing.current, pressDepth(keyPress.current, performance.now() / 1000), cap.current);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    // What presses: the keycap while it's on, the bare stem while it's off.
    const keycap = keycapOff ? isPart(e.object, "keychain_stem") && cap.current >= 1 : isPart(e.object, "keychain_keycap") && cap.current <= 0;
    if (!grab) { if (keycap) { e.stopPropagation(); onKeycapDown?.(pressNow); } return; }
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, keycap };
    // The drag's plane: through the hook, square to the camera's view.
    const g = group.current!;
    g.getWorldPosition(hit);
    plane.setFromNormalAndCoplanarPoint(e.camera.getWorldDirection(new THREE.Vector3()).negate(), hit);
    document.body.style.cursor = "grabbing";
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const gs = gesture.current;
    if (!grab || !gs || gs.id !== e.pointerId) return;
    e.stopPropagation();
    gs.moved += Math.abs(e.clientX - gs.x) + Math.abs(e.clientY - gs.y);
    const dx = e.clientX - gs.x;
    gs.x = e.clientX; gs.y = e.clientY;
    if (gs.moved < 5 || !e.ray.intersectPlane(plane, hit)) return;
    group.current!.worldToLocal(hit);
    dragSwing(swing.current, [hit.x, hit.y, hit.z]);
    spinTwist(swing.current, dx * 0.6);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const gs = gesture.current;
    if (!grab || !gs || gs.id !== e.pointerId) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    if (gs.moved < 5 && gs.keycap) pressNow();
    dragSwing(swing.current, null);
    gesture.current = null;
    document.body.style.cursor = "";
  };
  return <group ref={group} position={position} scale={scale}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    onClick={e => e.stopPropagation()}
    onPointerOver={() => { if (grab && !gesture.current) document.body.style.cursor = "grab"; }}
    onPointerOut={() => { if (!gesture.current) document.body.style.cursor = ""; }}>
    <primitive object={rig.root} />
  </group>;
}

useGLTF.preload(KEYCHAIN_URL);
