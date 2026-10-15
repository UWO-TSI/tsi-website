import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { SWELL_TUNING, seaOf, waterMaterial } from "@/lib/game/waterShader";
import { TUNING_DEFAULTS } from "@/lib/game/tuning";
import { createMap } from "@/lib/game/grid";
import { glintShader, stripOceanGeometry } from "./GridOcean";
import { advanceWater, waterSurfaceUniforms } from "./terrainMaterials";

const web = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(join(web, path), "utf8");
/** Every `<Tag …/>` element in a source file, as written. */
const tags = (path: string, tag: string) => [...read(path).matchAll(new RegExp(`<${tag}\\b[^>]*/>`, "g"))].map(m => m[0]);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const injected = (run: (sh: { uniforms: Record<string, never>; vertexShader: string; fragmentShader: string }) => void, vertex: string, fragment: string) => {
  const sh = { uniforms: {}, vertexShader: vertex, fragmentShader: fragment };
  run(sh);
  return sha(`${sh.vertexShader}\n//--\n${sh.fragmentShader}`);
};

/**
 * Main's sea (5b054a23, before game/waves), hashed from main's own modules: the water's, the sparkles' and the move
 * particles' shader inserts, and the open sea's strips round a 24 x 18 map. The applicant island draws exactly these.
 */
const MAIN = {
  water: "a4b3c9e3d91020845f9a8899286c50d7c5d83713ef895cc64f307c2fc7df5a2a",
  glints: "f6fd9783ad939c324605a876762715f50d63c645def4f47a88631634f28f49f6",
  particles: "c98dae5444408b8d3770b18bd27bd77eeb6646eb851c4da0adf9afbf8dcc4abf",
  strips: "a67840c8e6ce08d11ee0fd06b32780606bb5778af2fbde213d18839eaf64b5bd",
};

describe("the sea gate (v1-integrate): the waves only where the world opts in", () => {
  it("draws the waves with `waves` and main's swell without", () => {
    expect(seaOf(true)).toBe("waves");
    expect(seaOf(undefined)).toBe("swell");
    expect(seaOf(false)).toBe("swell");
  });

  it("keeps the applicant island (live for recruits), the ruins and the movement lab on main's water", () => {
    for (const path of ["components/recruit/ApplicantWorld.tsx", "components/game/combat/RuinsScene.tsx", "components/game/movement/MoveLab.tsx"]) {
      const worlds = [...tags(path, "GridWorld"), ...tags(path, "GridOcean")];
      expect(worlds.length, path).toBeGreaterThan(0);
      for (const tag of worlds) expect(tag, path).not.toMatch(/\bwaves\b/);
    }
  });

  it("gives the village (and the v2 world it walks), the title, the home island and the editor the waves", () => {
    for (const path of ["components/game/DefaultIslandWorld.tsx", "components/title/TitleScene.tsx", "components/game/home/HomeIslandScene.tsx"]) {
      const worlds = [...tags(path, "GridWorld"), ...tags(path, "GridOcean")];
      expect(worlds.length, path).toBe(2);
      for (const tag of worlds) expect(tag, path).toMatch(/\bwaves\b/);
    }
    expect(tags("components/game/world/editor/EditorScene.tsx", "GridOcean")[0]).toMatch(/\bwaves\b/);
    expect(read("components/game/world/editor/EditorScene.tsx")).toContain('useWaterFrame(LIGHT, false, "waves")');
  });

  it("floats boats only on a sea with waves (the wharf rides liveWaves, which only the waves advance)", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(join(web, dir))) {
        const rel = `${dir}/${f}`;
        if (statSync(join(web, rel)).isDirectory()) walk(rel);
        else if (rel.endsWith(".tsx") && /<Wharf\b/.test(read(rel))) files.push(rel);
      }
    };
    walk("components");
    walk("app");
    // Each file that floats a wharf, and the world that draws its sea.
    const WORLD: Record<string, string> = {
      "components/game/DefaultIslandWorld.tsx": "components/game/DefaultIslandWorld.tsx",
      "components/game/home/HomeIslandScene.tsx": "components/game/home/HomeIslandScene.tsx",
      "components/title/TitleVillage.tsx": "components/title/TitleScene.tsx",
      "components/game/world/editor/EditorObjects.tsx": "components/game/world/editor/EditorScene.tsx",
    };
    expect(files.sort()).toEqual(Object.keys(WORLD).sort());
    for (const world of Object.values(WORLD)) for (const tag of tags(world, "GridOcean")) expect(tag, world).toMatch(/\bwaves\b/);
  });
});

describe("main's sea, exactly, where the world doesn't opt in", () => {
  it("the water's shader is main's", () => {
    const water = injected(sh => waterMaterial({}, "swell").onBeforeCompile(sh as never, undefined as never), "#include <common>\n#include <begin_vertex>", "#include <common>\n#include <color_fragment>");
    expect(water).toBe(MAIN.water);
    expect(waterMaterial({}, "swell").customProgramCacheKey()).toBe("water");
    const waves = injected(sh => waterMaterial({}, "waves").onBeforeCompile(sh as never, undefined as never), "#include <common>\n#include <begin_vertex>", "#include <common>\n#include <color_fragment>");
    expect(waves).not.toBe(MAIN.water);
  });

  it("the sparkles and the move particles ride main's swell", async () => {
    expect(injected(sh => glintShader("swell", sh), "#include <begin_vertex>\n#include <logdepthbuf_vertex>", "#include <map_particle_fragment>\n#include <fog_fragment>")).toBe(MAIN.glints);
    // The particles' material loads its sprite pack (a TextureLoader wants a document).
    vi.stubGlobal("document", { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) });
    try {
      const { moveParticleMaterial } = await import("../movement/moveFx");
      const particles = injected(sh => moveParticleMaterial("swell").onBeforeCompile(sh as never, undefined as never), "#include <uv_vertex>\n#include <beginnormal_vertex>\n#include <begin_vertex>", "#include <color_fragment>");
      expect(particles).toBe(MAIN.particles);
      expect(moveParticleMaterial("swell").customProgramCacheKey()).toBe("move-particles-v2");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the open sea is main's graded strips", () => {
    const g = stripOceanGeometry(createMap(24, 18, -12, -9));
    const position = g.getAttribute("position").array as Float32Array;
    expect(sha(`${Buffer.from(position.buffer, position.byteOffset, position.byteLength).toString("hex")}|${Array.from(g.getIndex()!.array).join(",")}`)).toBe(MAIN.strips);
  });

  it("runs on main's tuning, not the waves' retune", () => {
    expect(SWELL_TUNING).toEqual({ waveHeight: 0.035, waveScale: 7, waveSpeed: 0.7, swellHeight: 0.06, swellLength: 26, swellSpeed: 0.42 });
    const u = waterSurfaceUniforms();
    advanceWater(10, TUNING_DEFAULTS.water, undefined, undefined, undefined, false, "swell");
    expect([u.uWaveHeight.value, u.uWaveScale.value, u.uWaveSpeed.value, u.uSwellHeight.value, u.uSwellSpeed.value, u.uWaveCount.value]).toEqual([0.035, 7, 0.7, 0.06, 0.42, 0]);
    advanceWater(10, TUNING_DEFAULTS.water, undefined, undefined, undefined, false, "waves");
    expect(u.uWaveHeight.value).toBe(TUNING_DEFAULTS.water.waveHeight);
    expect(u.uWaveCount.value).toBeGreaterThan(0);
  });
});
