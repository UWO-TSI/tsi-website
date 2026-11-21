/** The photobooth's pure parts (specs/genesis-pass.md): photo ids and the black-and-white receipt print. */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A 10-character photo id, made on the booth laptop so the receipt prints before the upload lands. */
export function newPhotoId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 252 is the largest multiple of 36 under 256: bytes above it are redrawn so every character is equally likely.
  let id = "";
  while (id.length < 10) for (const b of random(16)) if (b < 252 && id.length < 10) id += ALPHABET[b % 36];
  return id;
}

/**
 * Floyd-Steinberg dithering of RGBA pixels to pure black and white, in place, for the thermal printer. A little contrast
 * and brightness first, since thermal paper prints dark mid-tones.
 */
export function dither(px: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const y = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    g[i] = (y - 128) * 1.15 + 128 + 18;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, old = g[i], v = old < 128 ? 0 : 255, e = old - v;
      g[i] = v;
      if (x + 1 < w) g[i + 1] += (e * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += (e * 3) / 16;
        g[i + w] += (e * 5) / 16;
        if (x + 1 < w) g[i + w + 1] += e / 16;
      }
    }
  }
  for (let i = 0; i < w * h; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g[i]; px[i * 4 + 3] = 255; }
  return px;
}
