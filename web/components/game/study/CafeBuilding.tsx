"use client";

/**
 * The café in the village (cafe-polish §8, art/cafe/build_building.py): warm
 * wood and glass under a green awning, the lightbox sign on the gable front.
 * Three states (`CafeState`):
 * - boarded: until the chapter 2 club goal opens it: planks over the windows
 *   and door, a CLOSED board, the sign and windows dark;
 * - soon: built but not open yet (v1, specs/v1-drop.md §2; lib/game/drops.ts):
 *   no planks, the A-frame chalkboard out front reading "Opening soon", the
 *   windows, sign and porch lanterns warm, the OPEN sign off; no door;
 * - open: the A-frame menu is out, the OPEN sign and the sign glow, and at
 *   night the windows glow amber and the porch lanterns light the step.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import type { IslandLight } from "@/lib/game/islandLighting";
import { modelContact, useContactShadow } from "../ContactShadows";

const URL = "/assets/game/buildings/cafe.glb";
useGLTF.preload(URL);
/** The sign's open face on the gable (build_building.py: a 2.0 x 0.5 lightbox at y 3.05, front at z −2.18). */
const SIGN = { at: [0, 3.05, -2.181] as [number, number, number], size: [1.9, 0.42] as [number, number] };

/** The sign's face and its glow mask: the diffuser glows, the painted letters don't. */
function signTextures() {
  const paint = (glow: boolean) => {
    const c = document.createElement("canvas");
    c.width = 950; c.height = 210;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(475, 105, 30, 475, 105, 520);
    grad.addColorStop(0, glow ? "#ffffff" : "#fffaf0"); grad.addColorStop(1, glow ? "#c9b48e" : "#f1e2c4");
    g.fillStyle = grad; g.fillRect(0, 0, 950, 210);
    g.fillStyle = glow ? "#000000" : "#3f5e47";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 128px "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.letterSpacing = "28px";
    g.fillText("CAFÉ", 489, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  return [paint(false), paint(true)] as const;
}

export type CafeState = "boarded" | "soon" | "open";
/** The open state's pieces the "soon" state leaves off: the OPEN sign and the chalk menu lines (its chalkboard reads "Opening soon"). */
const OPEN_ONLY = new Set(["M_OpenSign", "M_Chalk"]);
/**
 * The A-frame's front chalk face (build_building.py: 0.42 × 0.7 at x −1.35, its top hinged at y 0.86, z −2.45, the
 * front board leaning 0.16 rad out at the foot): the "Opening soon" card sits a hair in front of it, facing the street.
 */
const CHALKBOARD = { at: [-1.35, 0.489, -2.662] as [number, number, number], lean: 0.16, size: [0.4, 0.66] as [number, number] };

/** Module scope (the react compiler forbids writing through hook values): states and glow on the prepared model. */
function setState(model: THREE.Object3D, state: CafeState) {
  model.traverse(o => {
    if (o.name.startsWith("cafe_planks")) o.visible = state === "boarded";
    if (o.name.startsWith("cafe_open")) o.visible = state !== "boarded";
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.name.startsWith("cafe_open") && OPEN_ONLY.has((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name)) mesh.visible = state === "open";
  });
}

/** The chalkboard's face: "Opening soon" in chalk over the slate, a cup doodle, a dashed rule. Matte, unlit by itself. */
function chalkTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 422;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2a3330"; g.fillRect(0, 0, 256, 422);
  // A chalky haze where it was wiped.
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(232,226,212,${0.02 + 0.03 * ((i * 37) % 7) / 7})`; g.fillRect((i * 97) % 256, (i * 53) % 422, 18, 3); }
  g.fillStyle = "#ece6d6"; g.strokeStyle = "#ece6d6";
  g.textAlign = "center"; g.textBaseline = "middle";
  const hand = `"Chalkboard SE", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
  g.font = `700 54px ${hand}`; g.fillText("Opening", 128, 118);
  g.font = `700 64px ${hand}`; g.fillText("soon", 128, 186);
  g.lineWidth = 4; g.setLineDash([12, 9]); g.beginPath(); g.moveTo(44, 236); g.lineTo(212, 236); g.stroke(); g.setLineDash([]);
  // The cup: a body, a handle, steam.
  g.lineWidth = 5; g.beginPath(); g.moveTo(96, 290); g.lineTo(104, 352); g.lineTo(152, 352); g.lineTo(160, 290); g.closePath(); g.stroke();
  g.beginPath(); g.arc(166, 316, 14, -Math.PI / 2, Math.PI / 2); g.stroke();
  for (const x of [112, 128, 144]) { g.beginPath(); g.moveTo(x, 280); g.bezierCurveTo(x - 8, 268, x + 8, 260, x, 246); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function glowOf(model: THREE.Object3D) {
  const out: Record<"interior" | "lantern" | "open", THREE.MeshStandardMaterial[]> = { interior: [], lantern: [], open: [] };
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      if (m.name === "M_Interior") out.interior.push(m);
      if (m.name === "M_Lantern") out.lantern.push(m);
      if (m.name === "M_OpenSign") out.open.push(m);
    }
  });
  return out;
}
function ease(materials: THREE.MeshStandardMaterial[], target: number, delta: number) {
  for (const m of materials) m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, target, 2, delta);
}

/** `state` (or the older `open`: open or boarded). */
export default function CafeBuilding({ state: given, open = false, light }: { state?: CafeState; open?: boolean; light: IslandLight }) {
  const state: CafeState = given ?? (open ? "open" : "boarded");
  const { scene } = useGLTF(URL);
  const model = useMemo(() => prepareModel(scene, URL), [scene]);
  useContactShadow(model, useMemo(() => modelContact(model, URL, "solid"), [model]));
  useEffect(() => () => disposeModelMaterials(model), [model]);
  useEffect(() => setState(model, state), [model, state]);
  const glow = useMemo(() => glowOf(model), [model]);
  const [texture, mask] = useMemo(() => signTextures(), []);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, emissiveMap: mask, emissive: new THREE.Color("#fff3dc"), roughness: 0.9 }), [texture, mask]);
  useEffect(() => () => { texture.dispose(); mask.dispose(); face.dispose(); }, [texture, mask, face]);
  const chalk = useMemo(() => (state === "soon" ? chalkTexture() : null), [state]);
  useEffect(() => () => chalk?.dispose(), [chalk]);
  const lamp = useRef<THREE.PointLight>(null);
  // Night is light.windowGlow (as the clubhouse's windows). Open or opening soon, the room, the sign and the porch
  // lanterns are warm (emissive); only the open café lights its OPEN sign and the porch light.
  useFrame((_, raw) => {
    const delta = Math.min(raw, 0.1), night = light.windowGlow, lit = state === "boarded" ? 0 : 1;
    ease(glow.interior, lit * (0.25 + 1.4 * night), delta);
    ease(glow.lantern, lit * (light.lampsOn ? 2.2 : 0.2), delta);
    ease(glow.open, state === "open" ? 1.6 : 0, delta);
    ease([face], lit * (0.55 + 0.9 * night), delta);
    if (lamp.current) lamp.current.intensity = THREE.MathUtils.damp(lamp.current.intensity, state === "open" && light.lampsOn ? light.lamp * 1.1 : 0, 2, delta);
  });
  return <group>
    <primitive object={model} />
    <mesh position={SIGN.at} rotation={[0, Math.PI, 0]} material={face}><planeGeometry args={SIGN.size} /></mesh>
    {chalk && <mesh position={CHALKBOARD.at} rotation={[CHALKBOARD.lean, Math.PI, 0]}>
      <planeGeometry args={CHALKBOARD.size} />
      <meshStandardMaterial map={chalk} roughness={0.95} />
    </mesh>}
    {/* Only once it's open: a light added to the village recompiles its materials, so not one that sits dark for weeks. */}
    {state === "open" && <pointLight ref={lamp} position={[0, 1.6, -2.9]} color="#ffcf8a" intensity={0} distance={5} decay={2} />}
  </group>;
}
