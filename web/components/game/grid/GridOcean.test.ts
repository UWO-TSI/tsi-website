import { afterEach, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { facetGlint, facetTilt, glareLobe, halfVector, type Vec3 } from "@/lib/game/waterShader";
import { ISLAND_LIGHTING, withWeather } from "@/lib/game/islandLighting";
import { sunFromAngles } from "@/lib/game/lookPreset";
import { createDefaultIsland } from "@/lib/game/defaultIsland";
import { WATER_DROP, isRiver, surfaceAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { glintPoints } from "./GridOcean";

const { map } = createDefaultIsland();
const POINTS = glintPoints(map);
const at = (i: number): Vec3 => [POINTS[i * 3], POINTS[i * 3 + 1], POINTS[i * 3 + 2]];
const WATER = ISLAND_LIGHTING.day.water, WIND = withWeather(ISLAND_LIGHTING.day, "wind").water;

/** The shipped follow camera (IslandAtmosphere useFollowCamera): focus + (0, 7.4, -10.8), FOV 48. */
function followCamera(player: [number, number], aspect = 16 / 9) {
  const camera = new PerspectiveCamera(48, aspect, 0.1, 200);
  camera.position.set(player[0], 0.7 + 7.4, player[1] + 1.5 - 10.8);
  camera.lookAt(player[0], 0.7, player[1] + 1.5);
  camera.updateMatrixWorld();
  return { camera, eye: camera.position.toArray() as Vec3 };
}
/** Water points in frame and inside the fog (fogFar 96). */
function onScreen(camera: PerspectiveCamera): number[] {
  const v = new Vector3(), out: number[] = [];
  for (let i = 0; i < POINTS.length / 3; i++) {
    v.set(...at(i));
    if (v.distanceTo(camera.position) > 96) continue;
    v.project(camera);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1) out.push(i);
  }
  return out;
}
/** Each point's facet on flat water: only its own fixed tilt. */
const flatFacet = (i: number, roughness: number): Vec3 => { const [tx, tz] = facetTilt(POINTS[i * 3], POINTS[i * 3 + 2]); return [tx * roughness, 1, tz * roughness]; };
const lit = (sun: Vec3, eye: Vec3, ids: number[], p = WATER) => ids.filter(i => facetGlint(sun, eye, at(i), flatFacet(i, p.roughness), p.sunSize) > 0);
/** Where flat water mirrors the sun into the eye. */
function mirrorPoint(sun: Vec3, eye: Vec3): [number, number] {
  const s = new Vector3(...sun).normalize(), t = (eye[1] + WATER_DROP) / s.y;
  return [eye[0] + t * s.x, eye[2] + t * s.z];
}

/**
 * The steepest the water gets: the swell's slope bound, the ripple texture's
 * (mSeaWater_Nrm's largest |rg| is 0.704, two layers at 1 + 0.5), and a facet's
 * own tilt (cut at 1.5 RMS).
 */
const steepest = (p = WATER) => 2 * Math.PI / p.waveScale * p.waveHeight * (0.62 + 0.38 * 1.63) + 0.705 * 1.5 * (p.rippleStrength ?? 0) + 1.5 * p.roughness;
/** The facet, tilted as far as the water allows toward mirroring the sun: the best any point can do. */
function bestFacet(sun: Vec3, eye: Vec3, point: Vec3, slope: number): Vec3 {
  const h = halfVector(sun, eye, point), side = Math.hypot(h[0], h[2]) || 1, need = side / h[1];
  return need <= slope ? h : [h[0] / side * slope, 1, h[2] / side * slope];
}

describe("sun on the water is optics (row 238, look spec §7.4)", () => {
  const SHIPPED: Vec3 = ISLAND_LIGHTING.day.sunPosition;
  const AFTERNOON = sunFromAngles(23, 64), MORNING = sunFromAngles(36, -44);
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("lights nothing with the sun behind the shipped camera, calm or windy, on any screen shape", () => {
    const behind: [string, Vec3][] = [["day", SHIPPED], ["11:00", MORNING], ["dawn", ISLAND_LIGHTING.dawn.sunPosition], ["moon", ISLAND_LIGHTING.night.sunPosition]];
    for (const [label, sun] of behind) {
      for (const aspect of [16 / 9, 9 / 16]) {
        for (const player of [[0, -10], [0, 14], [-12, 10]] as [number, number][]) {
          const { camera, eye } = followCamera(player, aspect), ids = onScreen(camera);
          expect(ids.length, label).toBeGreaterThan(100);
          for (const p of [WATER, WIND]) {
            for (const i of ids) {
              expect(facetGlint(sun, eye, at(i), bestFacet(sun, eye, at(i), steepest(p)), p.sunSize), `${label} point ${i}`).toBe(0);
              expect(glareLobe(sun, eye, at(i), bestFacet(sun, eye, at(i), steepest(p) - 1.5 * p.roughness), p.roughness) * p.glare, label).toBeLessThan(1 / 255);
            }
          }
        }
      }
    }
    const { camera, eye } = followCamera([0, 14]);
    expect(onScreen(camera).some(i => facetGlint(AFTERNOON, eye, at(i), bestFacet(AFTERNOON, eye, at(i), steepest()), WATER.sunSize) > 0)).toBe(true);
  });

  it("with the sun ahead, lights a few points around the mirror point and dims away from it", () => {
    const { camera, eye } = followCamera([0, 14]), ids = onScreen(camera), on = lit(AFTERNOON, eye, ids);
    const [mx, mz] = mirrorPoint(AFTERNOON, eye);
    expect(on.length).toBeGreaterThan(5);
    expect(on.length / ids.length).toBeLessThan(0.05);
    for (const i of on) {
      const h = halfVector(AFTERNOON, eye, at(i));
      expect(Math.hypot(h[0], h[2]) / h[1]).toBeLessThan(1.5 * WATER.roughness + WATER.sunSize * Math.PI / 360 + 1e-3);
    }
    const cx = on.reduce((a, i) => a + POINTS[i * 3], 0) / on.length, cz = on.reduce((a, i) => a + POINTS[i * 3 + 2], 0) / on.length;
    expect(Math.hypot(cx - mx, cz - mz)).toBeLessThan(6);
    expect(glareLobe(AFTERNOON, eye, [mx, -WATER_DROP, mz], [0, 1, 0], WATER.roughness)).toBeCloseTo(1);
  });

  it("slides with the viewer: the lit points change and follow the mirror point", () => {
    const a = followCamera([0, 14]), b = followCamera([4, 14]), ids = [...new Set([...onScreen(a.camera), ...onScreen(b.camera)])];
    const litA = lit(AFTERNOON, a.eye, ids), litB = lit(AFTERNOON, b.eye, ids);
    expect(litB).not.toEqual(litA);
    const meanX = (s: number[]) => s.reduce((sum, i) => sum + POINTS[i * 3], 0) / s.length;
    expect(meanX(litB) - meanX(litA)).toBeGreaterThan(2);
    expect(mirrorPoint(AFTERNOON, b.eye)[0] - mirrorPoint(AFTERNOON, a.eye)[0]).toBeCloseTo(4);
  });

  it("depends only on its inputs: same inputs, same light, whatever the clock or Math.random say", () => {
    const { eye } = followCamera([0, 14]), p: Vec3 = [3, -WATER_DROP, 30], n: Vec3 = [0.02, 1, -0.3];
    const first = [facetGlint(AFTERNOON, eye, p, n, 5), glareLobe(AFTERNOON, eye, p, n, 0.11), ...facetTilt(3, 30)];
    vi.spyOn(Math, "random").mockReturnValue(0.123);
    vi.useFakeTimers().setSystemTime(new Date("2031-01-01T04:00:00Z"));
    expect([facetGlint(AFTERNOON, eye, p, n, 5), glareLobe(AFTERNOON, eye, p, n, 0.11), ...facetTilt(3, 30)]).toEqual(first);
    expect(facetTilt(3, 30)).not.toEqual(facetTilt(3.5, 30));
  });

  it("spreads each facet's own tilt like the sheet, cut at 1.5 RMS", () => {
    const tilts = Array.from({ length: POINTS.length / 3 }, (_, i) => Math.hypot(...facetTilt(POINTS[i * 3], POINTS[i * 3 + 2])));
    expect(Math.max(...tilts)).toBeLessThanOrEqual(1.5);
    const rms = Math.sqrt(tilts.reduce((a, t) => a + t * t, 0) / tilts.length);
    expect(rms).toBeGreaterThan(0.75);
    expect(rms).toBeLessThan(0.9);
  });
});

describe("glint sprites (row 237)", () => {
  const pts = POINTS, n = pts.length / 3;
  const onWater = (i: number) => {
    const x = pts[i * 3], z = pts[i * 3 + 2], cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
    const inside = cx >= 0 && cz >= 0 && cx < map.width && cz < map.depth;
    return inside ? isRiver(surfaceAt(map, cx, cz)) : pts[i * 3 + 1] === Math.fround(-WATER_DROP);
  };
  it("sit only on water, seeded", () => {
    expect(n).toBeGreaterThan(5000);
    for (let i = 0; i < n; i++) expect(onWater(i), `point ${i}`).toBe(true);
    expect(glintPoints(map)).toEqual(pts);
  });
  it("leave the water under a deck clear", () => {
    const deck = (x: number, z: number) => x > 7 && x < 9 && z > -23 && z < -17;
    const kept = glintPoints(map, deck);
    expect(kept.length).toBeLessThan(pts.length);
    for (let i = 0; i < kept.length; i += 3) expect(deck(kept[i], kept[i + 2])).toBe(false);
  });
  it("spread evenly through any prefix, so the Light tier's half covers the river and the sea", () => {
    let near = 0;
    for (let i = 0; i < n / 2; i++) if (Math.abs(pts[i * 3]) < 32 && Math.abs(pts[i * 3 + 2]) < 32) near++;
    expect(near / (n / 2)).toBeGreaterThan(0.15);
    expect(near / (n / 2)).toBeLessThan(0.6);
  });
});
