/**
 * The grass field's blade cards (specs/v1-drop.md §8b, `grass-shader-ref.png` "texture sampling"): four clump shapes
 * side by side in one RGBA texture, drawn here so nothing is downloaded or copied. Each clump is a fan of tapered,
 * slightly curved blades. Alpha is a signed distance to the blade edges (0.5 on the edge), so mipmapped cards keep
 * their blade shapes at distance instead of dissolving; RGB is a grey shade the shader multiplies by its colour
 * (a lighter vein down each blade, each blade its own tone so neighbours separate).
 */

export const BLADE_VARIANTS = 4;
export const BLADE_SIZE = 64;

/** Deterministic 0..1 sequence (xorshift), so every load draws the same clumps. */
function rng(seed: number) {
  let s = seed | 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

interface Blade { x: number; lean: number; curl: number; height: number; width: number; tone: number }

/** The four clumps: tall and fine, broad and leafy, a short dense tuft, a loose fan with a long blade through it. */
function clump(variant: number): Blade[] {
  const r = rng(9173 + variant * 7919);
  const shapes = [
    { count: 6, height: [0.72, 1], width: [0.09, 0.12], spread: 0.3, lean: 0.1 },
    { count: 4, height: [0.62, 0.92], width: [0.15, 0.19], spread: 0.26, lean: 0.14 },
    { count: 7, height: [0.42, 0.66], width: [0.1, 0.13], spread: 0.32, lean: 0.16 },
    { count: 5, height: [0.5, 0.95], width: [0.1, 0.13], spread: 0.3, lean: 0.18 },
  ][variant];
  const out: Blade[] = [];
  for (let i = 0; i < shapes.count; i++) {
    const t = shapes.count > 1 ? i / (shapes.count - 1) : 0.5;
    const x = 0.5 + (t - 0.5) * shapes.spread * 2 + (r() - 0.5) * 0.06;
    out.push({
      x,
      // Blades fan out from the middle of the clump.
      lean: (x - 0.5) * 0.55 + (r() - 0.5) * shapes.lean,
      curl: (r() - 0.5) * 0.18,
      height: shapes.height[0] + r() * (shapes.height[1] - shapes.height[0]),
      width: shapes.width[0] + r() * (shapes.width[1] - shapes.width[0]),
      tone: 0.82 + r() * 0.22,
    });
  }
  // The long blade through the loose fan.
  if (variant === 3) out.push({ x: 0.52, lean: 0.06, curl: 0.08, height: 1, width: 0.11, tone: 1.02 });
  return out;
}

/**
 * RGBA bytes, BLADE_VARIANTS × BLADE_SIZE wide and BLADE_SIZE tall, row 0 at the blades' roots (v = 0 in the shader).
 */
export function bladeTexture(): Uint8Array {
  const W = BLADE_SIZE * BLADE_VARIANTS, H = BLADE_SIZE, out = new Uint8Array(W * H * 4);
  /** Signed distance band (in texels) the alpha ramps over. */
  const EDGE = 3;
  const STEPS = 24;
  for (let v = 0; v < BLADE_VARIANTS; v++) {
    const blades = clump(v);
    // Each blade's spine, sampled: (x, y) in 0..1 of the cell, and the half width there.
    const spines = blades.map(b => Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      return { x: b.x + b.lean * t * t + b.curl * Math.sin(t * Math.PI), y: b.height * t, half: (b.width / 2) * Math.pow(1 - t, 0.75) + 0.002 };
    }));
    for (let py = 0; py < H; py++) for (let px = 0; px < BLADE_SIZE; px++) {
      const x = (px + 0.5) / BLADE_SIZE, y = (py + 0.5) / BLADE_SIZE;
      let best = -Infinity, shade = 0;
      spines.forEach((spine, bi) => {
        for (let i = 0; i < STEPS; i++) {
          const a = spine[i], b = spine[i + 1], ex = b.x - a.x, ey = b.y - a.y, len2 = ex * ex + ey * ey || 1e-9;
          const u = Math.min(1, Math.max(0, ((x - a.x) * ex + (y - a.y) * ey) / len2));
          const d = Math.hypot(x - (a.x + ex * u), y - (a.y + ey * u)), half = a.half + (b.half - a.half) * u;
          const signed = (half - d) * BLADE_SIZE;
          if (signed > best) {
            best = signed;
            // Lighter down the vein, darker to the edges; the blade's own tone; a little darker toward the root.
            const across = half > 0 ? Math.min(1, d / half) : 1;
            shade = blades[bi].tone * (1 - 0.22 * across * across) * (0.9 + 0.1 * ((i + u) / STEPS));
          }
        }
      });
      const o = (py * W + v * BLADE_SIZE + px) * 4;
      const g = Math.round(Math.min(1, shade) * 255);
      out[o] = g; out[o + 1] = g; out[o + 2] = g;
      out[o + 3] = Math.round(Math.min(1, Math.max(0, 0.5 + best / (2 * EDGE))) * 255);
    }
  }
  return out;
}
