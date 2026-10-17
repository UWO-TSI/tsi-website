import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodePng } from "@/lib/game/world/png";
import { GROUND_FILES, KEPT_DUMP, groundOf, type GroundTexture } from "@/lib/game/groundTextures";

const web = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(join(web, path), "utf8");
/** Every `<Tag …/>` element in a source file, as written. */
const tags = (path: string, tag: string) => [...read(path).matchAll(new RegExp(`<${tag}\\b[^>]*/>`, "g"))].map(m => m[0]);
/** Width and height from a PNG's or a WebP's header. */
function size(url: string): [number, number] {
  const b = readFileSync(join(web, "public", url));
  if (b.toString("ascii", 1, 4) === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString("ascii", 12, 16) === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (b.toString("ascii", 12, 16) === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  throw new Error(`${url}: not a PNG or a lossy/lossless WebP`);
}
const KEYS = Object.keys(GROUND_FILES.dump) as GroundTexture[];

describe("the ground gate (remodel-ground): our own textures only where the world opts in", () => {
  it("draws our set with `ownGround` and the dump's without", () => {
    expect(groundOf(true)).toBe("own");
    expect(groundOf(undefined)).toBe("dump");
    expect(groundOf(false)).toBe("dump");
  });

  it("resolves the dump set to the files the ground drew on main, exactly", () => {
    expect(GROUND_FILES.dump).toEqual({
      grassAlbedo: null,
      grassNormal: "/assets/acnh/terrain/mGrass_Nrm.png",
      sand: "/assets/acnh/terrain/mSand_Alb.png",
      snowGrain: "/assets/acnh/terrain/mSandSnow_Alb.png",
      cliff: "/assets/acnh/terrain/mCliff_Alb.png",
      fringeCliff: "/assets/acnh/terrain/mGrassCliffXlu.png",
      fringeRiver: "/assets/acnh/terrain/mGrassRiverXlu.png",
      soil: "/assets/acnh/road/mRoadSoil_Alb.png",
      soilNormal: "/assets/acnh/road/mRoadSoil_Nrm.png",
      stone: "/assets/acnh/road/mRoadStone_Alb.png",
      stoneNormal: "/assets/acnh/road/mRoadStone_Nrm.png",
      wood: "/assets/acnh/road/mRoadWood_Alb.png",
      woodNormal: "/assets/acnh/road/mRoadWood_Nrm.png",
      brick: "/assets/acnh/road/mRoadBrick_Alb.png",
      brickNormal: "/assets/acnh/road/mRoadBrick_Nrm.png",
      riverBed: "/assets/game/water/seabed-sand.webp",
      seaRipple: "/assets/acnh/terrain/mSeaWater_Nrm.png",
      seaGlint: "/assets/acnh/textures/sea-glint.png",
    });
  });

  it("keeps the dump's stone, cliff, planks and snow in our set (David, row 314), and nothing else of the dump", () => {
    expect([...KEPT_DUMP].sort()).toEqual(["cliff", "snowGrain", "stone", "stoneNormal", "wood", "woodNormal"]);
    for (const key of KEYS) {
      if (KEPT_DUMP.includes(key)) expect(GROUND_FILES.own[key], key).toBe(GROUND_FILES.dump[key]);
      else expect(GROUND_FILES.own[key], key).not.toMatch(/\/acnh\//);
    }
  });

  it("ships every file of our set, each no bigger than the file it replaces", () => {
    expect(Object.keys(GROUND_FILES.own).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      const own = GROUND_FILES.own[key], dump = GROUND_FILES.dump[key];
      expect(own, key).not.toBeNull();
      expect(existsSync(join(web, "public", own!)), own!).toBe(true);
      // The quilt it stands in for is a 256 px DataTexture.
      const [w0, h0] = dump ? size(dump) : [256, 256];
      const [w, h] = size(own!);
      expect(w * h, key).toBeLessThanOrEqual(w0 * h0);
    }
  });

  it("keeps the ripple within the slope GridOcean.test.ts bounds the water by (|rg| at most 0.704)", () => {
    const { pixels, width, height, colorType, bitDepth } = decodePng(new Uint8Array(readFileSync(join(web, "public", GROUND_FILES.own.seaRipple!))));
    expect([colorType, bitDepth]).toEqual([2, 8]);
    let most = 0;
    for (let i = 0; i < width * height; i++) {
      const r = pixels[i * 3] / 255 * 2 - 1, g = pixels[i * 3 + 1] / 255 * 2 - 1;
      most = Math.max(most, Math.abs(r), Math.abs(g));
    }
    expect(most).toBeLessThanOrEqual(0.704);
  });

  it("keeps the applicant island (live for recruits) on the dump's textures", () => {
    const worlds = [...tags("components/recruit/ApplicantWorld.tsx", "GridWorld"), ...tags("components/recruit/ApplicantWorld.tsx", "GridOcean")];
    expect(worlds.length).toBe(2);
    for (const tag of worlds) expect(tag).not.toMatch(/\bownGround\b/);
  });

  it("gives every other world our textures", () => {
    for (const path of ["components/game/DefaultIslandWorld.tsx", "components/title/TitleScene.tsx", "components/game/home/HomeIslandScene.tsx",
      "components/game/combat/RuinsScene.tsx", "components/game/movement/MoveLab.tsx"]) {
      const worlds = [...tags(path, "GridWorld"), ...tags(path, "GridOcean")];
      expect(worlds.length, path).toBeGreaterThan(0);
      for (const tag of worlds) expect(tag, path).toMatch(/\bownGround\b/);
    }
    expect(tags("components/game/world/editor/EditorScene.tsx", "GridOcean")[0]).toMatch(/\bownGround\b/);
    expect(read("components/game/world/editor/EditorScene.tsx")).toContain('useWaterFrame(LIGHT, false, "waves", "own")');
  });
});
