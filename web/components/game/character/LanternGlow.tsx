/**
 * The Lighthouse rod held is a lantern (David, pol-lighthouse: "this rod when held also shines light and gives character
 * glow halo like holding a lantern"). Faked, no light: one additive sprite at the lamp's glass (a bright core in a wide
 * warm halo, slid along the view ray toward the camera so it washes over the holder instead of hiding behind them) and
 * one warm pool on the ground under it. Two draws per holder, no shader compiled into anything lit. Faint by day, full
 * at dusk and night (glow.ts nightLit), breathing like the lamps' flames.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { breath, glowTexture, nightLit } from "@/lib/game/glow";
import type { ClipName } from "@/lib/game/character/clips";

/** The rod with the lamp (art/props-enemies/build_tools.py ROD[4]). */
export const LANTERN_URL = "/assets/game/tools/rod-4.glb";
/** The glass's middle in the GLB (its Lamp part's bounds). */
const GLASS = new THREE.Vector3(0, 0.846, -0.039);
/** Clips off the ground: no pool under a jump. */
const AIRBORNE = new Set<ClipName>(["Jump", "Air", "Fall"]);
// The sprite's alpha: a tight core (the glass alight) in a wide faint halo.
const STOPS = [[0, 1], [0.05, 0.8], [0.13, 0.36], [0.45, 0.13], [1, 0]] as const;

const v = new THREE.Vector3(), cam = new THREE.Vector3(), s = new THREE.Vector3();

/** `rod` the held model, `root` the holder (their feet), `clip` what they play. */
export default function LanternGlow({ rod, root, clip }: { rod: THREE.Object3D; root: THREE.Object3D; clip: { readonly current: ClipName | null } }) {
  const scene = useThree(st => st.scene);
  const { halo, pool } = useMemo(() => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(STOPS), color: "#ffb35c", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.renderOrder = 2;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#ff9a3c", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
    pool.renderOrder = 1;
    return { halo, pool };
  }, []);
  useEffect(() => {
    rod.add(halo); scene.add(pool);
    return () => { halo.removeFromParent(); pool.removeFromParent(); };
  }, [rod, scene, halo, pool]);
  useEffect(() => () => { halo.material.dispose(); pool.geometry.dispose(); (pool.material as THREE.Material).dispose(); }, [halo, pool]);
  useFrame(({ camera, clock }) => glow(rod, root, halo, pool, camera, clock.elapsedTime, clip.current));
  return null;
}

/** Module scope (the react compiler forbids writing through hook values). */
function glow(rod: THREE.Object3D, root: THREE.Object3D, halo: THREE.Sprite, pool: THREE.Mesh, camera: THREE.Camera, t: number, clip: ClipName | null) {
  const night = nightLit(), b = breath(t, 0.6);
  rod.updateWorldMatrix(true, false);
  const lamp = rod.localToWorld(v.copy(GLASS));
  // Slid 0.5 toward the camera: the same spot on screen, in front of the holder.
  camera.getWorldPosition(cam);
  const at = cam.sub(lamp).normalize().multiplyScalar(0.5).add(lamp);
  const k = rod.getWorldScale(s).x || 1, size = (1.2 + 2 * night) * (0.92 + 0.16 * b);
  halo.position.copy(rod.worldToLocal(at.clone()));
  halo.scale.setScalar(size / k);
  halo.material.opacity = (0.3 + 0.65 * night) * b;
  // The pool (in the scene): under the lamp, at the feet.
  pool.position.set(lamp.x, root.getWorldPosition(s).y + 0.05, lamp.z);
  pool.scale.setScalar(1.6 + 0.3 * b);
  pool.visible = rod.visible && night > 0.02 && !(clip && AIRBORNE.has(clip));
  (pool.material as THREE.MeshBasicMaterial).opacity = 0.42 * night * b;
}
