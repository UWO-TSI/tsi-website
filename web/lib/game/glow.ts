/**
 * The warm glows' shared pieces (the lamps' LampGlow, AmbientProps.tsx; the fireflies, AmbientLife.tsx; the held
 * lantern, character/LanternGlow.tsx; the interact ring, InteractRing.tsx): a soft round glow, a flame's breath, and
 * how lit the night is.
 */
import * as THREE from "three";

/**
 * A flame's breath (David, 2026-10-26: "lights should breath like fire, glow should grow and shrink like real lamps"):
 * a slow swell, a quicker waver and a flutter, uneven, each lamp at its own phase. LampGlow's shaders run the same sum.
 */
export const breath = (t: number, phase: number) => 0.84 + 0.09 * Math.sin(t * 1.9 + phase) + 0.05 * Math.sin(t * 4.7 + phase * 1.3) + 0.02 * Math.sin(t * 11 + phase * 0.7);

/**
 * A light's glow in the air (sky-ambient round 2; David, the title's round 4: "the glow fades very softly so it doesnt
 * look like yellow circles"): a hot core and a long soft tail that comes down to nothing at the rim with no slope left,
 * so no edge or ring ever shows. 0 the middle, 1 the rim.
 */
export const softGlow = (r: number) => (r >= 1 ? 0 : (1 - r * r) ** 2.5 * (0.22 + 0.78 * Math.exp(-(r * r) / 0.045)));

const SIZE = 128;
const textures = new Map<string, THREE.Texture>();
/**
 * A round glow, white, its alpha by radius: the soft glow above, or `stops` of its own (eased between, not kinked).
 * 128 px and dithered, so it neither bands nor shows its texels however large it is drawn.
 */
export function glowTexture(stops?: readonly (readonly [number, number])[]): THREE.Texture {
  const key = stops ? stops.join(";") : "soft";
  let t = textures.get(key);
  if (t) return t;
  const alpha = (r: number) => {
    if (!stops) return softGlow(r);
    let i = 0;
    while (i < stops.length - 2 && r > stops[i + 1][0]) i++;
    const [r0, a0] = stops[i], [r1, a1] = stops[i + 1], k = Math.min(1, Math.max(0, (r - r0) / (r1 - r0)));
    return a0 + (a1 - a0) * k * k * (3 - 2 * k);
  };
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!, img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const r = Math.hypot(x + 0.5 - SIZE / 2, y + 0.5 - SIZE / 2) / (SIZE / 2), i = (y * SIZE + x) * 4;
    // Dithered by half a step, so an 8-bit alpha never shows rings.
    const dither = ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 256) / 256 - 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.max(0, Math.min(255, Math.round(Math.max(0, alpha(Math.min(r, 1))) * 255 + (r < 1 ? dither : 0))));
  }
  g.putImageData(img, 0, 0);
  textures.set(key, (t = new THREE.CanvasTexture(c)));
  return t;
}

let lit = 0;
/** How lit the night is, 0 by day to 1 at night (islandLighting windowLit), written by the world as its light changes. */
export const nightLit = () => lit;
export const setNightLit = (v: number) => { lit = v; };
