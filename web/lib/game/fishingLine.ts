/**
 * The fishing line (specs/polish/fishing.md deliverable 4): from the rod's tip to the bobber's eye, sagging when it
 * is slack, swaying with the world's wind, drawn tight and humming while a fish pulls, twanging slack when one gets
 * away. Pure; the rig on the angler's rod draws it as a thin ribbon that faces the camera
 * (components/game/character/FishingRig.tsx). Nothing here allocates.
 */
import type { CastPhase } from "./fishingRig";

/** Points along the line, tip to bobber. */
export const LINE_POINTS = 25;

/** How the line hangs: its sag (a share of its length), how far the wind sways it, a twang's wave and a pull's hum (units). */
export interface LineLook { sag: number; sway: number; wave: number; hum: number }

/**
 * The look a beat asks for (the rig eases to it): hanging slack and swaying while it floats, a little tighter as it
 * flies out, tugged straight for a moment by a nibble, tight and humming on the bite and through the reel (harder as
 * the tension builds), thrown slack with a twang when a hooked fish gets away, gathered in as it comes home.
 */
export function lineTarget(phase: CastPhase, tension: number, nibbling: boolean, snapped: boolean, out: LineLook): LineLook {
  out.wave = 0; out.hum = 0; out.sway = 0;
  switch (phase) {
    case "charging": case "swing": out.sag = 0.02; break;
    case "float": out.sag = nibbling ? 0.025 : 0.09; out.sway = nibbling ? 0.1 : 1; break;
    case "bite": out.sag = 0.012; out.hum = 0.012; break;
    case "reel": out.sag = 0.04 * (1 - tension) + 0.008; out.hum = 0.005 + 0.012 * tension; break;
    case "landed": out.sag = 0.01; break;
    case "escaped": out.sag = snapped ? 0.16 : 0.07; out.wave = snapped ? 0.22 : 0.05; out.sway = 0.6; break;
    case "reelin": out.sag = 0.03; break;
  }
  return out;
}

/**
 * The line's points into `out` (x, y, z each, LINE_POINTS of them) from the tip (a) to the bobber's eye (b), `t`
 * seconds into the cast: the straight chord, sagging down in a parabola by `sag` of its length, swayed across by the
 * wind (`windX, windZ`, the world's), a twang running along it (`wave`), a fast hum across it (`hum`), and never
 * under the water (`waterY`).
 */
export function lineCurve(ax: number, ay: number, az: number, bx: number, by: number, bz: number, look: LineLook,
  windX: number, windZ: number, t: number, waterY: number, out: Float32Array): Float32Array {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz) || 1;
  // Across the line, level: the wind's sway and the twang move it this way.
  const px = -dz / flat, pz = dx / flat;
  // The wind blows a slack line across by its strength across the line, a little more where it hangs longer; it breathes.
  const sag = look.sag * len, blow = (windX * px + windZ * pz) * 0.012 * len * look.sway * (0.75 + 0.25 * Math.sin(t * 1.3));
  for (let i = 0; i < LINE_POINTS; i++) {
    const u = i / (LINE_POINTS - 1), bow = 4 * u * (1 - u);
    const across = bow * blow
      + look.wave * Math.sin(Math.PI * u * 3 - t * 16) * bow
      + look.hum * Math.sin(t * 95 + u * 37) * Math.sin(Math.PI * u);
    const q = i * 3;
    out[q] = ax + dx * u + px * across;
    out[q + 1] = Math.max(waterY + 0.004, ay + dy * u - sag * bow);
    out[q + 2] = az + dz * u + pz * across;
  }
  // The ends are exact: the tip and the eye.
  out[0] = ax; out[1] = ay; out[2] = az;
  const e = (LINE_POINTS - 1) * 3;
  out[e] = bx; out[e + 1] = by; out[e + 2] = bz;
  return out;
}
