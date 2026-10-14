import { describe, expect, it } from "vitest";
import { decodePng, encodeGray16, encodeIndexed, gray16Of, indicesOf } from "./png";

const ramp16 = (w: number, h: number) => {
  const v = new Uint16Array(w * h);
  for (let k = 0; k < h; k++) for (let i = 0; i < w; i++) v[k * w + i] = (i * 977 + k * 6151 + ((i * k) % 7) * 12345) & 0xffff;
  return v;
};

describe("PNG codec", () => {
  it("round-trips 16-bit grey exactly, including the extremes", () => {
    const w = 37, h = 23, v = ramp16(w, h);
    v[0] = 0; v[1] = 65535; v[w * h - 1] = 65535;
    const png = encodeGray16(v, w, h);
    const back = gray16Of(decodePng(png));
    expect(back.width).toBe(w);
    expect(back.height).toBe(h);
    expect(Array.from(back.data)).toEqual(Array.from(v));
  });

  it("round-trips 8-bit indexed with its palette", () => {
    const w = 19, h = 11, ids = new Uint8Array(w * h).map((_, i) => (i * 7) % 5);
    const palette: [number, number, number][] = [[143, 161, 108], [226, 203, 147], [186, 150, 100], [140, 133, 119], [176, 172, 166]];
    const png = encodeIndexed(ids, w, h, palette);
    const decoded = decodePng(png);
    expect(decoded.colorType).toBe(3);
    expect(decoded.palette?.slice(0, 15)).toEqual(palette.flat());
    expect(Array.from(indicesOf(decoded).data)).toEqual(Array.from(ids));
  });

  it("is deterministic: the same pixels encode to the same bytes", () => {
    const v = ramp16(64, 40);
    expect(Buffer.from(encodeGray16(v, 64, 40)).equals(Buffer.from(encodeGray16(v.slice(), 64, 40)))).toBe(true);
  });

  it("rejects a corrupted file instead of returning bad heights", () => {
    const png = encodeGray16(ramp16(8, 8), 8, 8);
    const bad = png.slice();
    bad[40] ^= 0xff; // inside IHDR or the first IDAT: its CRC no longer matches
    expect(() => decodePng(bad)).toThrow();
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow(/PNG/);
  });

  it("refuses the wrong kind of image for a channel", () => {
    const png = encodeIndexed(new Uint8Array(16), 4, 4, [[0, 0, 0]]);
    expect(() => gray16Of(decodePng(png))).toThrow(/16-bit/);
    expect(() => indicesOf(decodePng(encodeGray16(new Uint16Array(16), 4, 4)))).toThrow(/indexed/);
  });
});
