/**
 * The Lighthouse rod held is a lantern (David, pol-lighthouse: "this rod when held also shines light and gives character
 * glow halo like holding a lantern"). Faked, no light: one small additive sprite at the lamp's glass (a clear core in a
 * tight halo, no haze over the holder: pol2-lantern "just a clear light with smaller visual") and one faint warm pool on
 * the ground under it. Two draws per holder, no shader compiled into anything lit. A little stronger at dusk and night
 * (glow.ts nightLit) but never blinding (pol2-lantern-walk: "subtle glow like the day"), breathing like the lamps' flames.
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
// The sprite's alpha: a clear core (the glass alight) in a short soft falloff.
const STOPS = [[0, 1], [0.12, 0.8], [0.28, 0.3], [0.6, 0.05], [1, 0]] as const;

const v = new THREE.Vector3(), cam = new THREE.Vector3(), s = new THREE.Vector3();

/** `rod` the held model, `root` the holder (their feet), `clip` what they play. */
export default function LanternGlow({ rod, root, clip }: { rod: THREE.Object3D; root: THREE.Object3D; clip: { readonly current: ClipName | null } }) {
  const scene = useThree(st => st.scene);
  const { halo, pool } = useMemo(() => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(STOPS), color: "#ffcf8a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
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
  // Slid 0.15 toward the camera: just out of the glass, so the lamp's own housing never hides it.
  camera.getWorldPosition(cam);
  const at = cam.sub(lamp).normalize().multiplyScalar(0.15).add(lamp);
  const k = rod.getWorldScale(s).x || 1, size = (0.55 + 0.25 * night) * (0.95 + 0.1 * b);
  halo.position.copy(rod.worldToLocal(at.clone()));
  halo.scale.setScalar(size / k);
  halo.material.opacity = (0.5 + 0.4 * night) * b;
  // The pool (in the scene): under the lamp, at the feet.
  pool.position.set(lamp.x, root.getWorldPosition(s).y + 0.05, lamp.z);
  pool.scale.setScalar(0.9 + 0.15 * b);
  pool.visible = rod.visible && night > 0.02 && !(clip && AIRBORNE.has(clip));
  (pool.material as THREE.MeshBasicMaterial).opacity = 0.22 * night * b;
}
