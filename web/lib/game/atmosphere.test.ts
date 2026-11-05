import { describe, expect, it } from "vitest";
import { Color } from "three";
import { compassDir, moonPosition, skyColours, skyRadiance, starFrame, transmittance, type Vec3 } from "./atmosphere";
import { solarPosition } from "./sunPath";
import { LONDON_ON } from "./islandWeather";

const angle = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
const srgb = (c: Vec3) => new Color().setRGB(...c);

describe("atmosphere", () => {
  it("lands noon on the look's picked sky", () => {
    // 2026-09-27 11:45 Toronto, the day David picked the look (row 236).
    const s = solarPosition(new Date("2026-09-27T15:45:00Z")), { top, horizon } = skyColours(compassDir(s.elevation, s.azimuth));
    // Compared as displayed (sRGB, 0..1).
    const near = (c: Vec3, hex: string) => { const a = parseInt(srgb(c).getHexString(), 16), b = parseInt(hex.slice(1), 16); return Math.hypot(...[16, 8, 0].map(k => (((a >> k) & 255) - ((b >> k) & 255)) / 255)); };
    expect(near(top, "#4a9de0")).toBeLessThan(0.08);
    expect(near(horizon, "#bfe0f2")).toBeLessThan(0.08);
  });

  it("makes a blue noon, a warm low sun and a dark night", () => {
    const noon = compassDir(55, 180), low = compassDir(2, 270), night = compassDir(-20, 270);
    const zenith = skyRadiance([0, 1, 0], noon);
    expect(zenith[2]).toBeGreaterThan(zenith[0] * 2);
    const towardSun = skyRadiance(compassDir(2, 270), low);
    expect(towardSun[0]).toBeGreaterThan(towardSun[2] * 2);
    expect(Math.max(...skyRadiance([0, 1, 0], night))).toBeLessThan(1e-6);
    // The sun itself whitens overhead and reddens at the skyline.
    const t0 = transmittance(noon), t1 = transmittance(compassDir(1, 270));
    expect(t0[2] / t0[0]).toBeGreaterThan(0.7);
    expect(t1[2] / t1[0]).toBeLessThan(0.05);
  });

  it("raises the Earth's shadow, with the belt of Venus over it, opposite a set sun", () => {
    const sun = compassDir(-2, 270);
    const shadow = skyRadiance(compassDir(1, 90), sun), belt = skyRadiance(compassDir(14, 90), sun);
    // Blue under, rose over.
    expect(shadow[2]).toBeGreaterThan(shadow[0]);
    expect(belt[0] / belt[2]).toBeGreaterThan(shadow[0] / shadow[2]);
  });

  it("puts the moon where it was: on the sun at the April 2024 eclipse, full opposite it in September", () => {
    const at = Date.parse("2024-04-08T19:12:00Z"), m = moonPosition(at, LONDON_ON), s = solarPosition(new Date(at));
    expect(angle(compassDir(m.elevation, m.azimuth), compassDir(s.elevation, s.azimuth))).toBeLessThan(1);
    expect(m.illumination).toBeLessThan(0.01);
    const full = moonPosition(Date.parse("2024-09-18T02:34:00Z"), LONDON_ON);
    expect(full.illumination).toBeGreaterThan(0.99);
    expect(Math.abs(full.age - 0.5)).toBeLessThan(0.02);
    // A week on, a waning half.
    const half = moonPosition(Date.parse("2024-09-24T18:50:00Z"), LONDON_ON);
    expect(Math.abs(half.illumination - 0.5)).toBeLessThan(0.08);
    expect(half.age).toBeGreaterThan(0.5);
  });

  it("turns the stars round the pole star, which stays due north at the latitude's height", () => {
    const polaris = (() => { const ra = 37.95 * Math.PI / 180, dec = 89.26 * Math.PI / 180; return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]; })();
    for (const iso of ["2026-01-10T03:00:00Z", "2026-07-29T05:00:00Z", "2026-07-29T11:00:00Z"]) {
      const m = starFrame(Date.parse(iso), LONDON_ON);
      // World = the matrix's transpose times the equatorial vector (columns of the column-major array are its rows).
      const w: Vec3 = [0, 1, 2].map(r => m[r * 3] * polaris[0] + m[r * 3 + 1] * polaris[1] + m[r * 3 + 2] * polaris[2]) as Vec3;
      expect(angle(w, compassDir(LONDON_ON.latitude, 0))).toBeLessThan(1.2);
    }
  });
});
