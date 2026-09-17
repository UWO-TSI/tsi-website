"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, lightHQWindows, prepareModel } from "@/lib/game/modelMaterials";

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

/** Ambient chalet colourways (scenery only — see GameWorld's south green). */
export const CHALET_VARIANTS = {
  brown: chaletParts("a", "b"),
  red: chaletParts("c", "g"),
  yellow: chaletParts("e", "e"),
} as const;

export const ACNH_GLB: Record<string, { parts: string[]; scale?: number; yOffset?: number; rotationY?: number }> = {
  hq: { parts: [`${B}/hq-office-village.glb`, `${B}/hq-office-door.glb`], rotationY: Math.PI },
  shop: { parts: [`${B}/shop-market.glb`, `${B}/shop-market-door.glb`], rotationY: Math.PI },
  oracle: { parts: [`${B}/oracle-museum.glb`], rotationY: Math.PI },
  house: { parts: CHALET_VARIANTS.brown, rotationY: Math.PI },
};

/** Shared material pass: ACNH albedo carries the look, so kill PBR shine. */
function matteACNH(root: THREE.Object3D, castShadow: boolean) {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
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
 * Mounts a part list as one group. Parts share the source coordinate space.
 *
 * The extractor strips skinning, so node clones are sufficient; materials
 * are cloned separately before applying the instance's finish and textures.
 */
export function ACNHParts({
  parts,
  scale = 1,
  yOffset = 0,
  rotationY = 0,
  castShadow = true,
  windowGlow,
  windowColor,
}: {
  parts: readonly string[];
  scale?: number;
  yOffset?: number;
  rotationY?: number;
  castShadow?: boolean;
  windowGlow?: number;
  windowColor?: string;
}) {
  const gltfs = useGLTF(parts as string[]);
  const group = useMemo(() => {
    const g = new THREE.Group();
    gltfs.forEach(({ scene }, index) => g.add(prepareModel(scene, parts[index], castShadow)));
    g.scale.setScalar(scale * ACNH_SCALE);
    g.position.y = yOffset;
    g.rotation.y = rotationY;
    matteACNH(g, castShadow);
    if (windowColor) lightHQWindows(g, windowColor);
    return g;
  }, [gltfs, parts, scale, yOffset, rotationY, castShadow, windowColor]);

  const emitters = useRef<{ material: THREE.MeshStandardMaterial; gain: number }[]>([]);
  useEffect(() => {
    const materials = new Set<THREE.MeshStandardMaterial>();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material instanceof THREE.MeshStandardMaterial && (material.emissiveMap || windowColor && /^m(?:Window[LR]|SideWindow)$/.test(material.name))) materials.add(material);
      }
    });
    const isHQ = parts.some((part) => part.endsWith("/hq-office-village.glb"));
    emitters.current = [...materials].map((material) => ({
      material,
      // The HQ window lightmaps are much dimmer than its clock/lamp map.
      gain: isHQ && !windowColor && /^mWindow[LR]$/.test(material.name) ? 4 : 1,
    }));
    return () => { emitters.current = []; };
  }, [group, parts, windowColor]);
  useFrame((_, delta) => {
    if (windowGlow === undefined) return;
    for (const { material, gain } of emitters.current) {
      // These are instance-owned Three materials, animated outside React rendering.
      // eslint-disable-next-line react-hooks/immutability
      material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, windowGlow * gain, 1.5, Math.min(delta, 0.1));
    }
  });

  useEffect(() => {
    group.children.forEach((part, index) => applyModelTextures(part, parts[index]));
    return () => disposeModelMaterials(group);
  }, [group, parts]);

  return <primitive object={group} />;
}

/** ACNH building: fixed scale, origin-grounded, original materials kept. */
export function ACNHBuilding({ id, windowGlow, windowColor }: { id: string; windowGlow?: number; windowColor?: string }) {
  const cfg = ACNH_GLB[id];
  return (
    <ACNHParts
      parts={cfg.parts}
      scale={cfg.scale ?? 1}
      yOffset={cfg.yOffset ?? 0}
      rotationY={cfg.rotationY ?? 0}
      windowGlow={windowGlow}
      windowColor={windowColor}
    />
  );
}
