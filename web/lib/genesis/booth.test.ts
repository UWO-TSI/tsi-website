import { describe, expect, it } from "vitest";
import { dither, newPhotoId } from "./booth";
import { PHOTO_ID } from "./pass";

describe("the photobooth", () => {
  it("makes ids the photo QR accepts", () => {
    for (let i = 0; i < 50; i++) expect(newPhotoId()).toMatch(PHOTO_ID);
    expect(new Set(Array.from({ length: 200 }, () => newPhotoId())).size).toBe(200);
  });
  it("dithers to pure black and white, keeping overall tone", () => {
    const w = 40, h = 40, px = new Uint8ClampedArray(w * h * 4).fill(100);
    dither(px, w, h);
    const vals = new Set<number>(); let white = 0;
    for (let i = 0; i < w * h; i++) { vals.add(px[i * 4]); if (px[i * 4] === 255) white++; }
    expect([...vals].every((v) => v === 0 || v === 255)).toBe(true);
    expect(white / (w * h)).toBeGreaterThan(0.25);
    expect(white / (w * h)).toBeLessThan(0.6);
  });
});
