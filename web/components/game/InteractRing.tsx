/**
 * What E would act on, confirmed (David, f4-board-world: "a very faint glow and circle around when close enough to
 * interact with a interactable object like the sell stand"): a soft circle on the ground round the current target and
 * a very faint glow over it. One of each for the whole world (two draws), moved to whichever target holds the prompt
 * (DefaultIslandWorld's `near`), eased in and out. The colours are the kit's: the circle --ui-highlight, the glow --ui-select.
 */
import { useEffect, useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glowTexture } from "@/lib/game/glow";

/** The target: where it stands (`y` its floor), the circle's radius, and the glow's height above the floor. */
export type RingSpot = { x: number; y: number; z: number; r: number; h: number };

// A thin soft band at the disc's rim, nothing inside it.
const BAND = [[0, 0], [0.74, 0], [0.88, 1], [0.96, 0.3], [1, 0]] as const;
const RING_ALPHA = 0.35, GLOW_ALPHA = 0.14, RATE = 10;

const at = new THREE.Vector3(), cam = new THREE.Vector3();

export default function InteractRing({ spot, on }: { spot: RefObject<RingSpot | null>; on: boolean }) {
  const { ring, glow } = useMemo(() => {
    // The HUD's tokens (the cream base on <html>, the E prompt's), not the menus' theme on <body>.
    const token = (name: string, or: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || or);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(BAND), color: token("--ui-highlight", "#ffcc00"), transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
    ring.renderOrder = 1;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: token("--ui-select", "#ffeea0"), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, fog: false }));
    glow.renderOrder = 2;
    ring.visible = glow.visible = false;
    return { ring, glow };
  }, []);
  useEffect(() => () => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); glow.material.dispose(); }, [ring, glow]);
  useFrame(({ camera }, raw) => place(ring, glow, on ? spot.current : null, camera, Math.min(raw, 0.1)));
  return <><primitive object={ring} /><primitive object={glow} /></>;
}

/** Module scope (the react compiler forbids writing through hook values): follow the target, fade in on a new one. */
function place(ring: THREE.Mesh, glow: THREE.Sprite, target: RingSpot | null, camera: THREE.Camera, dt: number) {
  const ringMat = ring.material as THREE.MeshBasicMaterial, last = ring.userData.spot as RingSpot | undefined;
  if (target && (target.x !== last?.x || target.z !== last?.z)) {
    // A new target: start from nothing there (never slide from the last one).
    ringMat.opacity = glow.material.opacity = 0;
    ring.position.set(target.x, target.y + 0.1, target.z);
    ring.scale.setScalar(target.r);
    glow.scale.setScalar(target.r * 2.6);
    ring.userData.spot = target;
  }
  const s = ring.userData.spot as RingSpot | undefined;
  if (s) {
    // The glow over its middle, slid toward the camera by its radius so it lies over the object, not behind it.
    at.set(s.x, ring.position.y + s.h, s.z);
    glow.position.copy(camera.getWorldPosition(cam).sub(at).normalize().multiplyScalar(s.r).add(at));
  }
  const k = 1 - Math.exp(-RATE * dt);
  ringMat.opacity += ((target ? RING_ALPHA : 0) - ringMat.opacity) * k;
  glow.material.opacity += ((target ? GLOW_ALPHA : 0) - glow.material.opacity) * k;
  ring.visible = glow.visible = ringMat.opacity > 0.005;
}
