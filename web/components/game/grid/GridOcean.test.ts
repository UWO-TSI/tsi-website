import { afterEach, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { FOLD_FADE, WATER_FOLD, bentFacing, chopSlope, facetGlint, facetTilt, foldFade, glareLobe, halfVector, type Vec3 } from "@/lib/game/waterShader";
import { WORLD_BEND, WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";
import { DEFAULT_PITCH, ORBIT_DISTANCE, PITCH_MIN, orbitOffset } from "@/lib/game/orbitCamera";
import { ISLAND_LIGHTING, withWeather } from "@/lib/game/islandLighting";
import { sunFromAngles } from "@/lib/game/lookPreset";
import { buildVillage, type VillageDoc } from "@/lib/game/villageMap";
import frozen from "@/lib/game/fixtures/village-2026-09-28.json";
import { WATER_DROP, createCenteredMap, isRiver, surfaceAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { GLINT_FOG, glintPoints, oceanGeometry } from "./GridOcean";
import { readFileSync } from "node:fs";

// Water optics on a frozen copy of the 2026-09-28 village (camera spots and the deck below are its geometry).
const { map } = buildVillage(frozen as VillageDoc);
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
/** A facet's own slope at world time t (its fixed tilt + the chop passing it), in units of roughness. */
const ownSlope = (i: number, t: number): [number, number] => {
  const [tx, tz] = facetTilt(POINTS[i * 3], POINTS[i * 3 + 2]), [cx, cz] = chopSlope(POINTS[i * 3], POINTS[i * 3 + 2], t);
  return [tx + cx, tz + cz];
};
/** Each point's facet on flat water (the drawn waves only add slow motion). */
const flatFacet = (i: number, roughness: number, t = 100): Vec3 => { const [sx, sz] = ownSlope(i, t); return [sx * roughness, 1, sz * roughness]; };
const lit = (sun: Vec3, eye: Vec3, ids: number[], p = WATER, t = 100) => ids.filter(i => facetGlint(sun, eye, at(i), flatFacet(i, p.roughness, t), p.sunSize) > 0);
/** Where flat water mirrors the sun into the eye. */
function mirrorPoint(sun: Vec3, eye: Vec3): [number, number] {
  const s = new Vector3(...sun).normalize(), t = (eye[1] + WATER_DROP) / s.y;
  return [eye[0] + t * s.x, eye[2] + t * s.z];
}

/**
 * The steepest the water gets: the swell's slope bound, the ripple texture's
 * (mSeaWater_Nrm's largest |rg| is 0.704, two layers at 1 + 0.5), and a facet's
 * own slope (fixed tilt + chop, at most 1.5 roughness).
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
    const first = [facetGlint(AFTERNOON, eye, p, n, 5), glareLobe(AFTERNOON, eye, p, n, 0.11), ...facetTilt(3, 30), ...chopSlope(3, 30, 51234.5)];
    vi.spyOn(Math, "random").mockReturnValue(0.123);
    vi.useFakeTimers().setSystemTime(new Date("2031-01-01T04:00:00Z"));
    expect([facetGlint(AFTERNOON, eye, p, n, 5), glareLobe(AFTERNOON, eye, p, n, 0.11), ...facetTilt(3, 30), ...chopSlope(3, 30, 51234.5)]).toEqual(first);
    expect(facetTilt(3, 30)).not.toEqual(facetTilt(3.5, 30));
  });

  it("keeps each facet's own slope within 1.5 roughness: a Beckmann tilt cut at 0.9 plus chop of at most 0.6", () => {
    const n = POINTS.length / 3, tilts = Array.from({ length: n }, (_, i) => Math.hypot(...facetTilt(POINTS[i * 3], POINTS[i * 3 + 2])));
    expect(Math.max(...tilts)).toBeLessThanOrEqual(0.9);
    const rms = Math.sqrt(tilts.reduce((a, t) => a + t * t, 0) / n);
    expect(rms).toBeGreaterThan(0.45);
    expect(rms).toBeLessThan(0.54);
    for (const t of [0, 0.37, 1234.5, 86399]) for (let i = 0; i < n; i += 7) expect(Math.hypot(...ownSlope(i, t))).toBeLessThanOrEqual(1.5);
  });

  it("flashes briefly at a fixed eye: the chop turns facets through alignment in well under half a second", () => {
    const { camera, eye } = followCamera([0, 17.2]), ids = onScreen(camera), dt = 1 / 60, start = new Map<number, number>(), flashes: number[] = [];
    let litFrames = 0;
    for (let f = 0; f <= 6 * 60; f++) {
      const on = new Set(lit(AFTERNOON, eye, ids, WATER, 40000 + f * dt));
      litFrames += on.size;
      for (const i of on) if (!start.has(i)) start.set(i, f);
      for (const [i, f0] of start) if (!on.has(i)) { flashes.push((f - f0) * dt); start.delete(i); }
    }
    flashes.sort((a, b) => a - b);
    const median = flashes[flashes.length >> 1];
    expect(litFrames / 361).toBeGreaterThan(5);
    expect(median).toBeLessThan(0.35);
    expect(median).toBeGreaterThan(0.05);
  });
});

// Playtest round 1 (David, 2026-10-14): "the sparkles in the distance sometimes gets folded in and you see 2x the
// sparkles". The world's bend (curvedWorld.ts) sinks everything by view distance squared, so far enough out the sea
// curves over and faces away: the water there is culled with its back face, but a sparkle is a point, and it drew
// again folded back under the horizon over the near ones. The sparkles fade out as the bent sea turns edge-on.
describe("sparkles under the world's bend", () => {
  const AFTERNOON_YAW = 0.62; // the sun at 16:30 on 2026-10-14 (?at=16:30): the camera looking into it
  /** The orbit camera as useFollowCamera places it: ORBIT_DISTANCE × zoom back from a point 0.7 up and 1.5 ahead of the player. */
  function orbitCam(player: [number, number], yaw: number, pitch: number, zoom: number, aspect = 16 / 9) {
    const camera = new PerspectiveCamera(48, aspect, 0.1, 200);
    const look = new Vector3(player[0] + Math.sin(yaw) * 1.5, 0.7, player[1] + Math.cos(yaw) * 1.5);
    const [ox, oy, oz] = orbitOffset(yaw, pitch, ORBIT_DISTANCE * zoom);
    camera.position.set(look.x + ox, look.y + oy, look.z + oz);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return camera;
  }
  /** A world point as the bent world draws it (project_vertex): its view position sunk by the bend, and where on screen. */
  function drawn(camera: PerspectiveCamera, p: Vec3) {
    const v = new Vector3(...p).applyMatrix4(camera.matrixWorldInverse);
    v.y -= v.z * v.z * WORLD_BEND + v.x * v.x * WORLD_BEND_SIDE;
    const mv: Vec3 = [v.x, v.y, v.z], ndc = v.clone().applyMatrix4(camera.projectionMatrix);
    return { mv, ndc, fade: foldFade(bentFacing(mv, upInView(camera), WORLD_BEND, WORLD_BEND_SIDE)) };
  }
  const upInView = (camera: PerspectiveCamera): Vec3 => { const u = new Vector3(0, 1, 0).transformDirection(camera.matrixWorldInverse); return [u.x, u.y, u.z]; };
  const CAMERAS: [string, PerspectiveCamera][] = [
    ["the lowest camera at the afternoon sun", orbitCam([12.5, 17.5], AFTERNOON_YAW, PITCH_MIN, 1.6)],
    ["the lowest camera, closer", orbitCam([12.5, 17.5], AFTERNOON_YAW, PITCH_MIN, 1)],
    ["the shipped camera", orbitCam([0, 14], 0, DEFAULT_PITCH, 1)],
    ["the lowest camera on a phone", orbitCam([12.5, 17.5], AFTERNOON_YAW, PITCH_MIN, 1.6, 9 / 16)],
  ];

  it("reads the bent surface's own facing (finite differences of the bend)", () => {
    const camera = CAMERAS[0][1], up = upInView(camera);
    for (const [x, z] of [[20, 30], [40, 60], [-10, 80], [60, 20], [30, 110]]) {
      const at = (dx: number, dz: number) => new Vector3(...drawn(camera, [x + dx, -WATER_DROP, z + dz]).mv);
      const p = at(0, 0), n = at(0, 0.01).sub(p).cross(at(0.01, 0).sub(p)).normalize();
      expect(bentFacing([p.x, p.y, p.z], up, WORLD_BEND, WORLD_BEND_SIDE)).toBeCloseTo(n.dot(p.clone().negate().normalize()), 3);
    }
  });

  for (const [label, camera] of CAMERAS) {
    it(`draws no sparkle twice: ${label}`, () => {
      // Lines of sight out across the water, every 3 degrees across the view: along each, the sea rises up the screen
      // to the bent horizon, then folds back down. Nothing past the fold is drawn, and what is drawn rises with distance.
      const eye = camera.position, fwd = new Vector3(); camera.getWorldDirection(fwd);
      const heading = Math.atan2(fwd.x, fwd.z);
      let folds = 0, kept = 0;
      for (let a = -36; a <= 36; a += 3) {
        const h = heading + (a * Math.PI) / 180, row: { r: number; y: number; fade: number; onScreen: boolean }[] = [];
        for (let r = 2; r <= 140; r += 0.5) {
          const d = drawn(camera, [eye.x + Math.sin(h) * r, -WATER_DROP, eye.z + Math.cos(h) * r]);
          row.push({ r, y: d.ndc.y, fade: d.fade, onScreen: Math.abs(d.ndc.x) <= 1 && Math.abs(d.ndc.y) <= 1 });
        }
        const top = row.reduce((m, s, i) => (s.y > row[m].y ? i : m), 0);
        if (top < row.length - 1 && row[top].r < 90 && row.slice(top).some(s => s.onScreen)) folds++;
        let highest = -Infinity;
        for (let i = 0; i < row.length; i++) {
          // Two units past the fold nothing is drawn; what is drawn never comes back down the screen (a second row).
          if (i > top + 4) expect(row[i].fade, `past the fold at ${row[i].r}`).toBe(0);
          if (row[i].fade <= 0) continue;
          expect(row[i].y, `drawn again lower at ${row[i].r}`).toBeGreaterThan(highest - 0.003);
          highest = Math.max(highest, row[i].y);
          if (row[i].onScreen) kept++;
        }
      }
      expect(kept).toBeGreaterThan(100);
      if (label.startsWith("the lowest")) expect(folds, "the fold is inside the sparkles' reach and on screen").toBeGreaterThan(5);
    });
  }

  it("leaves the sparkles round the player untouched", () => {
    for (const [label, camera] of CAMERAS) {
      const eye = camera.position, fwd = new Vector3(); camera.getWorldDirection(fwd);
      for (let r = 2; r <= 24; r += 1) {
        const d = drawn(camera, [eye.x + fwd.x / Math.hypot(fwd.x, fwd.z) * r, -WATER_DROP, eye.z + fwd.z / Math.hypot(fwd.x, fwd.z) * r]);
        expect(d.fade, `${label} at ${r}`).toBe(1);
      }
    }
  });

  it("fades a far sparkle into the fog instead of lighting it with the fog's colour", () => {
    // The sprites add their light (additive blending): three's fog mixes a fragment toward the fog's colour, which on
    // an additive sprite ADDS the pale fog colour, so every faintly lit sprite far out drew as a pale dot, packed into
    // the band the bend squeezes the far sea into (found on the playtest's afternoon shot: the dots under the horizon
    // were the sprites, whatever colour the sprite itself was). In fog a sprite's light fades to nothing instead.
    expect(GLINT_FOG).not.toContain("fogColor");
    expect(GLINT_FOG).toContain("gl_FragColor.rgb *= 1.0 - fogFactor;");
    expect(GLINT_FOG).toContain("smoothstep( fogNear, fogFar, vFogDepth )");
    const src = readFileSync(new URL("./GridOcean.tsx", import.meta.url), "utf8");
    expect(src).toContain(`.replace("#include <fog_fragment>", GLINT_FOG)`);
  });

  it("prints the same fade into the sprites' shader", () => {
    const glsl = WATER_FOLD(WORLD_BEND, WORLD_BEND_SIDE);
    expect(glsl).toContain(`smoothstep(0.0, ${FOLD_FADE.toFixed(3)}`);
    expect(glsl).toContain((2 * WORLD_BEND).toFixed(6));
    expect(glsl).toContain((2 * WORLD_BEND_SIDE).toFixed(6));
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

describe("the open sea meets the island's water without a seam (arrival-wharf.md: the boat sails past the map's edge)", () => {
  // The map's water is a quad per cell, so its edge has a vertex every unit (cell corners at half units); the swell is
  // evaluated per vertex, so the sea's edge must have the same vertices or the two surfaces part where the swell runs.
  const edgeVerts = (g: ReturnType<typeof oceanGeometry>, test: (x: number, z: number) => boolean) => {
    const p = g.getAttribute("position"), out: [number, number][] = [];
    for (let i = 0; i < p.count; i++) if (test(p.getX(i), p.getZ(i))) out.push([p.getX(i), p.getZ(i)]);
    return out;
  };
  for (const [label, m] of [["the village", map], ["a small islet", createCenteredMap(32, 32)]] as const) {
    it(`has a vertex at every cell corner along ${label}'s edge, and covers the sea out to the horizon`, () => {
      const g = oceanGeometry(m), minX = m.originX - 0.5, minZ = m.originZ - 0.5, maxX = minX + m.width, maxZ = minZ + m.depth;
      const on = (v: number, e: number) => Math.abs(v - e) < 1e-4;
      for (let x = minX; x <= maxX + 1e-6; x += 1) {
        for (const z of [minZ, maxZ]) expect(edgeVerts(g, (vx, vz) => on(vx, x) && on(vz, z)).length, `(${x}, ${z})`).toBeGreaterThan(0);
      }
      for (let z = minZ; z <= maxZ + 1e-6; z += 1) {
        for (const x of [minX, maxX]) expect(edgeVerts(g, (vx, vz) => on(vx, x) && on(vz, z)).length, `(${x}, ${z})`).toBeGreaterThan(0);
      }
      // Nothing inside the map (the map draws its own water) and out to 300 every way.
      expect(edgeVerts(g, (x, z) => x > minX + 1e-4 && x < maxX - 1e-4 && z > minZ + 1e-4 && z < maxZ - 1e-4)).toEqual([]);
      g.computeBoundingBox();
      expect([g.boundingBox!.min.x, g.boundingBox!.max.x, g.boundingBox!.min.z, g.boundingBox!.max.z]).toEqual([-300, 300, -300, 300]);
      // Faces up, and still a light mesh.
      const idx = g.getIndex()!, p = g.getAttribute("position");
      for (let t = 0; t < idx.count; t += 3) {
        const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
        const ux = p.getX(b) - p.getX(a), uz = p.getZ(b) - p.getZ(a), vx = p.getX(c) - p.getX(a), vz = p.getZ(c) - p.getZ(a);
        expect(uz * vx - ux * vz, `triangle ${t / 3}`).toBeGreaterThan(0); // the cross product's y
      }
      expect(idx.count / 3).toBeLessThan(10000);
    });
  }
});
