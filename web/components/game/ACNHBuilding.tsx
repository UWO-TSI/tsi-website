"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, lightHQWindows, prepareModel } from "@/lib/game/modelMaterials";
import { modelContact, useContactShadow } from "./ContactShadows";

// ─── ACNH textured building models (2026-07 revamp) ─────────────
// Source pack is authored at ~10 units per meter; ACNH_SCALE brings them
// into world units. Models keep their own textures/materials (unlike
// GLBBuilding, which flat-color-overrides). Grounding: ACNH buildings put
// their walk-in floor at y=0 in model space and extend foundation BELOW
// (for slope placement), so we scale about the origin and do NOT re-ground
// by bbox min — that would hoist the foundation into view.
export const ACNH_SCALE = 0.1;

// M1 (2026-07-26): buildings are composed from PARTS, not one merged file.
//
// ACNH authors a building as separate wall / roof / door assets in a SHARED
// coordinate space — the roof already sits at its correct height in its own
// file, so the parts need no transform, only mounting in one group. The
// previous single-file exports were merged by the lost ad-hoc pipeline, which
// dropped meshes doing it: the chalet shipped with 7 of its 15 meshes, missing
// mWindowGlass, mSideWindow, mCurtain and mLamp. The houses had no windows.
//
// Composing at load time instead of merging offline keeps the extractor honest
// (one .dae in, one .glb out, mesh-count gated) and costs a few extra draw
// calls, which the grid renderer's batching pass addresses globally.
const B = "/assets/acnh/buildings";

/** Chalet variants are a wall + roof pairing over the shared standard door. */
function chaletParts(wall: string, roof: string): string[] {
  return [`${B}/chalet-wall-${wall}.glb`, `${B}/chalet-roof-${roof}.glb`, `${B}/chalet-door.glb`];
}

/** Chalet colourways: the café, museum, home and the movement lab's house. */
export const CHALET_VARIANTS = {
  brown: chaletParts("a", "b"),
  red: chaletParts("c", "g"),
  yellow: chaletParts("e", "e"),
} as const;

const ACNH_GLB: Record<string, string[]> = {
  hq: [`${B}/hq-office.glb`, `${B}/hq-office-door.glb`],
  shop: [`${B}/shop-market.glb`, `${B}/shop-market-door.glb`],
  oracle: [`${B}/oracle-museum.glb`],
};

/** Shared material pass: ACNH albedo carries the look, so kill PBR shine. */
function matteACNH(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.metalness = 0;
        std.roughness = Math.max(std.roughness, 0.85);
      }
    }
  });
}

/**
 * The chalet's back wall is ACNH's interior panel (plaster, dark beams in the gable), drawn for a camera that never
 * goes round; the orbit camera does (specs/camera-orbit.md), so it wears the house's own outside wall instead.
 */
function dressBack(root: THREE.Object3D) {
  let outside: THREE.Material | undefined;
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !Array.isArray(m.material) && m.material.name === "mWallA") outside ??= m.material; });
  if (outside) root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name.startsWith("BrickBack")) (o as THREE.Mesh).material = outside!; });
}

/** Warm window light at night (living-village §5): a lit room seen through the glass. */
const WINDOW_LIGHT = "#ffcf7a";
/** The chalet's porch lanterns: their emissive map is the lit lantern, so by day it is off (world audit item 22). */
const LAMP = /^mLamp$/;
/** Plain glass panes (no emissive map of their own) that glow from inside once it's dark. */
const GLASS = /^m(?:WindowGlass|SideWindow)$/;
/** Module scope: give the panes a warm emission shaped by their own texture, off until `lit` turns it up. */
function lightPanes(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial) || m.emissiveMap || !GLASS.test(m.name)) continue;
      m.emissive.set(WINDOW_LIGHT);
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0;
      m.userData.pane = true;
      m.needsUpdate = true;
    }
  });
}

/**
 * Mounts a part list as one group, turned to face the camera (ACNH). Parts share the source coordinate space.
 *
 * The extractor strips skinning, so node clones are sufficient; materials
 * are cloned separately before applying the instance's finish and textures.
 */
export function ACNHParts({
  parts,
  windowGlow,
  windowColor,
  lit,
}: {
  parts: readonly string[];
  windowGlow?: number;
  windowColor?: string;
  /** Night (0 day → 1 night, islandLighting windowLit): the panes glow and the model's own lamps and lit rooms brighten, easing over a few seconds. */
  lit?: number;
}) {
  const gltfs = useGLTF(parts as string[]);
  const lights = lit !== undefined;
  const group = useMemo(() => {
    const g = new THREE.Group();
    gltfs.forEach(({ scene }, index) => g.add(prepareModel(scene, parts[index])));
    dressBack(g);
    g.scale.setScalar(ACNH_SCALE);
    g.rotation.y = Math.PI;
    matteACNH(g);
    if (windowColor) lightHQWindows(g, windowColor);
    else if (lights) lightPanes(g);
    return g;
  }, [gltfs, parts, windowColor, lights]);
  useContactShadow(group, useMemo(() => modelContact(group, parts[0], "solid"), [group, parts]));

  const emitters = useRef<{ material: THREE.MeshStandardMaterial; gain: number; pane: boolean; lamp: boolean }[]>([]);
  useEffect(() => {
    const materials = new Set<THREE.MeshStandardMaterial>();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material instanceof THREE.MeshStandardMaterial && (material.emissiveMap || material.userData.pane || windowColor && /^m(?:Window[LR]|SideWindow)$/.test(material.name))) materials.add(material);
      }
    });
    const isHQ = parts.some((part) => part.endsWith("/hq-office.glb"));
    emitters.current = [...materials].map((material) => ({
      material,
      // The HQ window lightmaps are much dimmer than its clock/lamp map.
      gain: isHQ && !windowColor && /^mWindow[LR]$/.test(material.name) ? 4 : 1,
      pane: !!material.userData.pane,
      lamp: LAMP.test(material.name),
    }));
    return () => { emitters.current = []; };
  }, [group, parts, windowColor]);
  useFrame((_, delta) => {
    if (windowGlow === undefined && lit === undefined) return;
    for (const { material, gain, pane, lamp } of emitters.current) {
      // Lit: panes from dark to a warm glow, the porch lanterns off by day and on at night, the model's own lit rooms
      // from their day level up a little.
      const target = windowGlow !== undefined ? windowGlow * gain : pane ? 1.3 * lit! : lamp ? 1.7 * lit! : 1 + 0.7 * lit!;
      // These are instance-owned Three materials, animated outside React rendering.
      // eslint-disable-next-line react-hooks/immutability
      material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, target, 1.2, Math.min(delta, 0.1));
    }
  });

  useEffect(() => {
    group.children.forEach((part, index) => applyModelTextures(part, parts[index]));
    return () => disposeModelMaterials(group);
  }, [group, parts]);

  return <primitive object={group} />;
}

/** ACNH building: fixed scale, origin-grounded, original materials kept. */
export function ACNHBuilding({ id, windowGlow, windowColor, lit }: { id: string; windowGlow?: number; windowColor?: string; lit?: number }) {
  return <ACNHParts parts={ACNH_GLB[id]} windowGlow={windowGlow} windowColor={windowColor} lit={lit} />;
}
