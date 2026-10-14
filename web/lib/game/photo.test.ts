import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  PHOTO_CAMERA, PHOTO_FILTERS, PHOTO_FRAMES, applyMatrix, clampOrbit, composeMatrix, cssFilter, firstHit, frameLayout, orbitPose, photoFileName, photoScale, selfiePose,
} from "./photo";

const px = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);

describe("photo filters (v1 photo mode)", () => {
  it("six filters and the natural look, each named, ids unique", () => {
    expect(PHOTO_FILTERS.map(f => f.id)).toEqual(["none", "soft", "golden", "mono", "pastel", "night", "polaroid"]);
    expect(PHOTO_FILTERS.find(f => f.id === "none")!.fns).toEqual([]);
    for (const f of PHOTO_FILTERS) expect(f.name.length).toBeGreaterThan(2);
  });

  it("say the same thing to CSS (the live view) and to the snap (one colour matrix, per the Filter Effects spec)", () => {
    expect(cssFilter([])).toBe("none");
    expect(cssFilter([["grayscale", 1], ["contrast", 1.1]])).toBe("grayscale(1) contrast(1.1)");
    expect(cssFilter([["hue-rotate", 12]])).toBe("hue-rotate(12deg)");
    // grayscale(1): the spec's luminance weights.
    const gray = px(255, 0, 0);
    applyMatrix(gray, composeMatrix([["grayscale", 1]]));
    expect([...gray.slice(0, 3)]).toEqual([54, 54, 54]);
    // brightness and contrast are linear: contrast(c) = c·x + (0.5 − 0.5c).
    const mid = px(100, 128, 200);
    applyMatrix(mid, composeMatrix([["brightness", 1.5]]));
    expect([...mid.slice(0, 3)]).toEqual([150, 192, 255]);
    const c = px(0, 128, 255);
    applyMatrix(c, composeMatrix([["contrast", 0.5]]));
    expect([...c.slice(0, 3)]).toEqual([64, 128, 191]);
    // In order: sepia then saturate(0) is the sepia's grey, not saturate(0) then sepia.
    const a = px(200, 50, 50), b = px(200, 50, 50);
    applyMatrix(a, composeMatrix([["sepia", 1], ["saturate", 0]]));
    applyMatrix(b, composeMatrix([["saturate", 0], ["sepia", 1]]));
    expect(a[0]).toBe(a[1]);
    expect(b[0]).not.toBe(b[2]);
    // The identity leaves pixels alone, alpha untouched.
    const keep = new Uint8ClampedArray([12, 34, 56, 78]);
    applyMatrix(keep, composeMatrix([]));
    expect([...keep]).toEqual([12, 34, 56, 78]);
  });

  it("every filter keeps colours in range and changes the picture (but none)", () => {
    for (const f of PHOTO_FILTERS) {
      const p = new Uint8ClampedArray([30, 120, 220, 255, 250, 240, 10, 255]);
      applyMatrix(p, composeMatrix(f.fns));
      if (f.id === "none") expect([...p]).toEqual([30, 120, 220, 255, 250, 240, 10, 255]);
      else expect([...p]).not.toEqual([30, 120, 220, 255, 250, 240, 10, 255]);
      expect(p.every(v => v >= 0 && v <= 255)).toBe(true);
    }
  });
});

describe("photo frames", () => {
  it("plain, polaroid, postcard and TSI, each around the whole photo", () => {
    expect(PHOTO_FRAMES.map(f => f.id)).toEqual(["plain", "polaroid", "postcard", "tsi"]);
    for (const f of PHOTO_FRAMES) {
      const l = frameLayout(f.id, 1280, 800);
      expect(l.photo.w).toBe(1280);
      expect(l.photo.h).toBe(800);
      expect(l.photo.x).toBeGreaterThan(0);
      expect(l.photo.y).toBeGreaterThan(0);
      expect(l.width).toBeGreaterThanOrEqual(l.photo.x + l.photo.w + l.photo.x * 0.99);
      expect(l.height).toBeGreaterThan(l.photo.y + l.photo.h);
      expect(Number.isInteger(l.width) && Number.isInteger(l.height)).toBe(true);
    }
    // A polaroid's bottom is the deep one, with room for its caption.
    const p = frameLayout("polaroid", 1000, 1000);
    expect(p.height - (p.photo.y + p.photo.h)).toBeGreaterThan(3 * p.photo.y);
    expect(p.caption).toBeDefined();
    expect(p.caption!.y).toBeGreaterThan(p.photo.y + p.photo.h);
  });
});

describe("the photo camera", () => {
  it("orbits round what it looks at, never under the ground or too close or far", () => {
    const at = new THREE.Vector3(2, 1, 3), out = new THREE.Vector3();
    orbitPose(at, 0, 0.4, 5, out);
    expect(out.distanceTo(at)).toBeCloseTo(5);
    expect(out.y).toBeGreaterThan(at.y);
    const o = clampOrbit({ yaw: 10, pitch: 5, dist: 100 });
    expect(o.pitch).toBe(PHOTO_CAMERA.pitchMax);
    expect(o.dist).toBe(PHOTO_CAMERA.distMax);
    expect(o.yaw).toBeCloseTo(10 - 2 * Math.PI * Math.round(10 / (2 * Math.PI)));
    expect(clampOrbit({ yaw: 0, pitch: -5, dist: 0 })).toMatchObject({ pitch: PHOTO_CAMERA.pitchMin, dist: PHOTO_CAMERA.distMin });
  });

  it("stops short of a building between you and it (a spring arm), never inside one; a tree's crown doesn't count", () => {
    const at = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(0, 1, -10);
    const house = { x: 0, z: -6, hx: 2, hz: 1, y0: 0, y1: 4 };
    expect(firstHit(at, pos, [house])).toBeCloseTo(0.5);
    expect(firstHit(at, pos, [])).toBe(1);
    expect(firstHit(at, pos, [{ ...house, x: 10 }])).toBe(1);
    expect(firstHit(at, pos, [{ ...house, canopy: true }])).toBe(1);
    expect(firstHit(at, pos, [{ ...house, z: -3 }, house])).toBeCloseTo(0.2);
  });

  it("a selfie: in front of you at arm's length, at your eyes, looking back at your face", () => {
    const head = new THREE.Vector3(0, 1.4, 0), pos = new THREE.Vector3(), look = new THREE.Vector3();
    selfiePose(head, 0, 0, pos, look); // facing +z (yaw 0)
    expect(pos.z).toBeGreaterThan(1);
    expect(Math.abs(pos.x)).toBeLessThan(1e-9);
    expect(pos.distanceTo(head)).toBeLessThan(2.4);
    expect(look.distanceTo(head)).toBeLessThan(0.3);
    selfiePose(head, Math.PI / 2, 0.3, pos, look); // facing +x, the arm swung a little
    expect(pos.x).toBeGreaterThan(1);
  });
});

describe("the snap", () => {
  it("is saved at about your screen's size (pixels kept crisp), never smaller than the canvas, at most 2560 wide", () => {
    expect(photoScale(640, 1280, 2)).toBe(4);
    expect(photoScale(1280, 1280, 1)).toBe(1);
    expect(photoScale(1920, 1280, 2)).toBe(1);
    expect(photoScale(640, 2560, 2)).toBe(4);
    expect(photoScale(320, 1600, 3)).toBe(8);
  });
  it("is named for the island and the moment", () => {
    expect(photoFileName(new Date(2026, 9, 31, 18, 5, 9))).toBe("tethos-island-2026-10-31-180509.png");
  });
});
