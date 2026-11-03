/**
 * The warm glows' shared pieces (the lamps' LampGlow, AmbientProps.tsx; the held lantern, character/LanternGlow.tsx;
 * the interact ring, InteractRing.tsx): a soft round texture, a flame's breath, and how lit the night is.
 */
import * as THREE from "three";

/**
 * A flame's breath (David, 2026-10-26: "lights should breath like fire, glow should grow and shrink like real lamps"):
 * a slow swell, a quicker waver and a flutter, uneven, each lamp at its own phase. LampGlow's shaders run the same sum.
 */
export const breath = (t: number, phase: number) => 0.84 + 0.09 * Math.sin(t * 1.9 + phase) + 0.05 * Math.sin(t * 4.7 + phase * 1.3) + 0.02 * Math.sin(t * 11 + phase * 0.7);

const textures = new Map<string, THREE.Texture>();
/** A round glow, white, its alpha by radius (0 the middle, 1 the rim): the default soft halo, or `stops` of its own. */
export function glowTexture(stops: readonly (readonly [number, number])[] = [[0, 1], [0.35, 0.45], [1, 0]]): THREE.Texture {
  const key = stops.join(";");
  let t = textures.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  textures.set(key, (t = new THREE.CanvasTexture(c)));
  return t;
}

let lit = 0;
/** How lit the night is, 0 by day to 1 at night (islandLighting windowLit), written by the world as its light changes. */
export const nightLit = () => lit;
export const setNightLit = (v: number) => { lit = v; };
