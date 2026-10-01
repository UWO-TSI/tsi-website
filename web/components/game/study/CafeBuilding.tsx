"use client";

/**
 * The café in the village (cafe-polish §8, art/cafe/build_building.py): warm
 * wood and glass under a green awning, the lightbox sign on the gable front.
 * Boarded up until the chapter 2 club goal opens it: planks over the windows
 * and door, a CLOSED board, the sign and windows dark. Open: the planks are
 * gone, the A-frame menu is out, the OPEN sign and the sign glow, and at night
 * the windows glow amber and the porch lanterns light the step.
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

/** Module scope (the react compiler forbids writing through hook values): states and glow on the prepared model. */
function setState(model: THREE.Object3D, open: boolean) {
  model.traverse(o => {
    if (o.name.startsWith("cafe_planks")) o.visible = !open;
    if (o.name.startsWith("cafe_open")) o.visible = open;
  });
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

export default function CafeBuilding({ open, light }: { open: boolean; light: IslandLight }) {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => prepareModel(scene, URL), [scene]);
  useContactShadow(model, useMemo(() => modelContact(model, URL, "solid"), [model]));
  useEffect(() => () => disposeModelMaterials(model), [model]);
  useEffect(() => setState(model, open), [model, open]);
  const glow = useMemo(() => glowOf(model), [model]);
  const [texture, mask] = useMemo(() => signTextures(), []);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, emissiveMap: mask, emissive: new THREE.Color("#fff3dc"), roughness: 0.9 }), [texture, mask]);
  useEffect(() => () => { texture.dispose(); mask.dispose(); face.dispose(); }, [texture, mask, face]);
  const lamp = useRef<THREE.PointLight>(null);
  // Night is light.windowGlow (as the clubhouse's windows); the café only lights up once it's open.
  useFrame((_, raw) => {
    const delta = Math.min(raw, 0.1), night = light.windowGlow, lit = open ? 1 : 0;
    ease(glow.interior, lit * (0.25 + 1.4 * night), delta);
    ease(glow.lantern, lit * (light.lampsOn ? 2.2 : 0.2), delta);
    ease(glow.open, lit * 1.6, delta);
    ease([face], lit * (0.55 + 0.9 * night), delta);
    if (lamp.current) lamp.current.intensity = THREE.MathUtils.damp(lamp.current.intensity, open && light.lampsOn ? light.lamp * 1.1 : 0, 2, delta);
  });
  return <group>
    <primitive object={model} />
    <mesh position={SIGN.at} rotation={[0, Math.PI, 0]} material={face}><planeGeometry args={SIGN.size} /></mesh>
    {/* Only once it's open: a light added to the village recompiles its materials, so not one that sits dark for weeks. */}
    {open && <pointLight ref={lamp} position={[0, 1.6, -2.9]} color="#ffcf8a" intensity={0} distance={5} decay={2} />}
  </group>;
}
