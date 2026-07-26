import { describe, it, expect } from "vitest";
import {
  TILE,
  LEVEL_STEP,
  WATER_DROP,
  CHUNK,
  MAX_LEVEL,
  Surface,
  createMap,
  createCenteredMap,
  setCell,
  levelAt,
  surfaceAt,
  heightAt,
  waterHeightAt,
  heightAtWorld,
  cellToWorldX,
  cellToWorldZ,
  worldToCellX,
  worldToCellZ,
  listChunks,
  parseIslandMap,
  serialiseIslandMap,
  isVoid,
  isRiver,
  rotateMask,
  canonicaliseDiagonals,
  normaliseMask,
  autotile,
  listConfigs,
  popcount8,
  cellSeed,
  pieceFileFor,
  CONFIG_TO_PIECE,
  neighbourMask,
  sameLevelOrHigher,
  Dir,
} from "./grid";

describe("constants", () => {
  // These are measured off the kit meshes, not chosen. If one of these ever
  // changes, the art stops fitting the world — see specs/acnh-system-reference.
  it("match the measured ACNH kit", () => {
    expect(TILE).toBe(1.0);
    expect(LEVEL_STEP).toBe(1.5);
    expect(WATER_DROP).toBeCloseTo(0.078, 5);
    expect(CHUNK).toBe(16);
    expect(MAX_LEVEL).toBe(3);
  });
});

describe("map access", () => {
  it("reads and writes cells", () => {
    const map = createMap(8, 8);
    setCell(map, 3, 4, 2, Surface.Stone);
    expect(levelAt(map, 3, 4)).toBe(2);
    expect(surfaceAt(map, 3, 4)).toBe(Surface.Stone);
  });

  it("clamps level to the walkable range", () => {
    const map = createMap(4, 4);
    setCell(map, 0, 0, 99, Surface.Grass);
    expect(levelAt(map, 0, 0)).toBe(MAX_LEVEL);
    setCell(map, 1, 0, -5, Surface.Grass);
    expect(levelAt(map, 1, 0)).toBe(0);
  });

  it("reads out of bounds as sea-level grass rather than throwing", () => {
    const map = createMap(4, 4);
    expect(levelAt(map, -1, 0)).toBe(0);
    expect(levelAt(map, 99, 99)).toBe(0);
    expect(surfaceAt(map, -1, -1)).toBe(Surface.Grass);
  });

  it("height is level times the step, with no interpolation", () => {
    const map = createMap(4, 4);
    setCell(map, 1, 1, 2, Surface.Grass);
    expect(heightAt(map, 1, 1)).toBeCloseTo(3.0, 6);
    expect(heightAt(map, 0, 0)).toBe(0);
  });

  it("water sits WATER_DROP below its own ground level", () => {
    const map = createMap(4, 4);
    setCell(map, 2, 2, 1, Surface.River);
    expect(waterHeightAt(map, 2, 2)).toBeCloseTo(LEVEL_STEP - WATER_DROP, 6);
  });
});

describe("cell <-> world", () => {
  it("round-trips every cell of a centred map", () => {
    const map = createCenteredMap(11, 7);
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        expect(worldToCellX(map, cellToWorldX(map, cx))).toBe(cx);
        expect(worldToCellZ(map, cellToWorldZ(map, cz))).toBe(cz);
      }
    }
  });

  it("snaps anywhere inside a cell to that cell", () => {
    const map = createCenteredMap(9, 9);
    const x = cellToWorldX(map, 4);
    expect(worldToCellX(map, x - TILE * 0.49)).toBe(4);
    expect(worldToCellX(map, x + TILE * 0.49)).toBe(4);
  });

  it("centres an odd map on the world origin", () => {
    const map = createCenteredMap(9, 9);
    expect(cellToWorldX(map, 4)).toBeCloseTo(0, 6);
    expect(cellToWorldZ(map, 4)).toBeCloseTo(0, 6);
  });

  // The naive `-(n-1)/2` centring puts every cell centre of an EVEN map on a
  // half-integer. The existing world places essentially everything on
  // integers, so that offset made all 68 snapped props miss by sqrt(2)/2.
  it("puts cell centres on integers for an even map too", () => {
    const map = createCenteredMap(128, 128);
    expect(cellToWorldX(map, 64)).toBe(0);
    expect(cellToWorldX(map, 0)).toBe(-64);
    for (let cx = 0; cx < 8; cx++) expect(Number.isInteger(cellToWorldX(map, cx))).toBe(true);
  });

  it("looks height up from a world position", () => {
    const map = createCenteredMap(9, 9);
    setCell(map, 4, 4, 3, Surface.Grass);
    expect(heightAtWorld(map, 0, 0)).toBeCloseTo(3 * LEVEL_STEP, 6);
  });
});

describe("serialisation", () => {
  it("round-trips a map through the row-string form", () => {
    const map = createCenteredMap(6, 4);
    setCell(map, 1, 1, 2, Surface.Stone);
    setCell(map, 5, 3, 3, Surface.Void);
    setCell(map, 0, 0, 1, Surface.River);

    const { map: back } = parseIslandMap(serialiseIslandMap(map));
    expect(back.width).toBe(map.width);
    expect(back.originX).toBe(map.originX);
    expect(Array.from(back.levels)).toEqual(Array.from(map.levels));
    expect(Array.from(back.surfaces)).toEqual(Array.from(map.surfaces));
  });

  it("carries props through unchanged", () => {
    const map = createCenteredMap(4, 4);
    const props = [{ kind: "tree", cell: [1, 2] as [number, number], level: 0 }];
    const { props: back } = parseIslandMap(serialiseIslandMap(map, props));
    expect(back).toEqual(props);
  });
});

describe("void", () => {
  it("marks cells with no ground", () => {
    const map = createCenteredMap(4, 4);
    setCell(map, 0, 0, 0, Surface.Void);
    expect(isVoid(surfaceAt(map, 0, 0))).toBe(true);
    expect(isVoid(surfaceAt(map, 1, 1))).toBe(false);
  });

  it("is distinct from river", () => {
    expect(isVoid(Surface.River)).toBe(false);
    expect(isRiver(Surface.Void)).toBe(false);
  });

});

describe("chunks", () => {
  it("cover every cell exactly once", () => {
    const map = createMap(40, 33);
    const seen = new Uint8Array(map.width * map.depth);
    for (const c of listChunks(map)) {
      for (let cz = c.minCellZ; cz <= c.maxCellZ; cz++) {
        for (let cx = c.minCellX; cx <= c.maxCellX; cx++) seen[cz * map.width + cx]++;
      }
    }
    expect(Array.from(seen).every((n) => n === 1)).toBe(true);
  });

  it("uses one acre per chunk", () => {
    const map = createMap(32, 32);
    expect(listChunks(map)).toHaveLength(4);
  });
});

describe("mask rotation", () => {
  it("returns to identity after four quarter-turns", () => {
    for (let mask = 0; mask < 256; mask++) expect(rotateMask(mask, 4)).toBe(mask);
  });

  it("maps north to east on one clockwise turn", () => {
    expect(rotateMask(1 << Dir.N, 1)).toBe(1 << Dir.E);
    expect(rotateMask(1 << Dir.E, 1)).toBe(1 << Dir.S);
    expect(rotateMask(1 << Dir.S, 1)).toBe(1 << Dir.W);
    expect(rotateMask(1 << Dir.W, 1)).toBe(1 << Dir.N);
  });

  it("handles negative and oversized turn counts", () => {
    expect(rotateMask(1 << Dir.N, -1)).toBe(1 << Dir.W);
    expect(rotateMask(1 << Dir.N, 5)).toBe(1 << Dir.E);
  });
});

describe("blob rule", () => {
  it("drops a diagonal that is not flanked by both orthogonals", () => {
    expect(canonicaliseDiagonals(1 << Dir.NE)).toBe(0);
    expect(canonicaliseDiagonals((1 << Dir.NE) | (1 << Dir.N))).toBe(1 << Dir.N);
  });

  it("keeps a diagonal flanked on both sides", () => {
    const m = (1 << Dir.N) | (1 << Dir.NE) | (1 << Dir.E);
    expect(canonicaliseDiagonals(m)).toBe(m);
  });

  it("is idempotent", () => {
    for (let mask = 0; mask < 256; mask++) {
      const once = canonicaliseDiagonals(mask);
      expect(canonicaliseDiagonals(once)).toBe(once);
    }
  });
});

describe("normalisation", () => {
  it("gives every rotation of a mask the same canonical form", () => {
    for (let mask = 0; mask < 256; mask++) {
      const base = normaliseMask(mask).canonical;
      for (let q = 1; q < 4; q++) {
        expect(normaliseMask(rotateMask(mask, q)).canonical).toBe(base);
      }
    }
  });

  it("reports a rotation that reproduces the input", () => {
    for (let mask = 0; mask < 256; mask++) {
      const { canonical, rotation } = normaliseMask(mask);
      expect(rotateMask(canonical, rotation)).toBe(canonicaliseDiagonals(mask));
    }
  });
});

describe("autotile", () => {
  it("resolves all 256 masks", () => {
    for (let mask = 0; mask < 256; mask++) {
      const c = autotile(mask);
      expect(c.config).toBeGreaterThanOrEqual(0);
      expect(c.config).toBeLessThan(15);
      expect(c.rotation).toBeGreaterThanOrEqual(0);
      expect(c.rotation).toBeLessThanOrEqual(3);
    }
  });

  // 256 raw masks -> 15 rotation-classes -> 47 oriented tiles, which is the
  // textbook blob set. The kit ships 16 base shapes and 44 pieces, so we are
  // close on both counts but exact on neither; that gap is what M6 resolves.
  // If either number moves, canonicaliseDiagonals has drifted.
  it("collapses 256 masks into 15 rotation-classes", () => {
    expect(listConfigs()).toHaveLength(15);
    const configs = new Set<number>();
    for (let mask = 0; mask < 256; mask++) configs.add(autotile(mask).config);
    expect(configs.size).toBe(15);
  });

  it("expands those into the 47 oriented tiles of the blob set", () => {
    const oriented = new Set<string>();
    for (let mask = 0; mask < 256; mask++) {
      const c = autotile(mask);
      oriented.add(`${c.config}-${c.rotation}`);
    }
    expect(oriented.size).toBe(47);
  });

  it("puts an isolated cell at degree 0 and an enclosed one at degree 8", () => {
    expect(autotile(0).degree).toBe(0);
    expect(autotile(0xff).degree).toBe(8);
  });

  it("keeps the config stable under rotation, changing only the rotation", () => {
    for (let mask = 0; mask < 256; mask++) {
      const base = autotile(mask);
      for (let q = 1; q < 4; q++) {
        const rot = autotile(rotateMask(mask, q));
        expect(rot.config).toBe(base.config);
        expect(rot.degree).toBe(base.degree);
      }
    }
  });

  it("reports degree as the post-blob neighbour count", () => {
    for (let mask = 0; mask < 256; mask++) {
      expect(autotile(mask).degree).toBe(popcount8(canonicaliseDiagonals(mask)));
    }
  });

  // The cliff mapping is derived by measuring where each piece carries wall
  // geometry — see scripts/derive-kit-mapping.mjs. 14 of 15 configs are
  // answered; the 15th is the fully-enclosed cell, which needs no piece.
  it("answers every config the cliff kit covers", () => {
    let answered = 0;
    for (let i = 0; i < listConfigs().length; i++) {
      if (CONFIG_TO_PIECE.cliff[i]) answered++;
    }
    expect(answered).toBe(14);
  });

  it("emits no piece for the fully enclosed cell", () => {
    const enclosed = autotile(0xff);
    expect(pieceFileFor("cliff", enclosed)).toBeNull();
  });

  it("names a real file for every mapped config", () => {
    for (let mask = 0; mask < 256; mask++) {
      const c = autotile(mask);
      const f = pieceFileFor("cliff", c, cellSeed(mask, 3));
      if (f === null) continue;
      expect(f).toMatch(/^\d-[a-c]-\d\.glb$/);
    }
  });

  // The trailing number is a VISUAL VARIANT, not a rotation — measured: all
  // four files in a family share a wall centroid, which a rotation would move.
  // So the variant must never exceed what the kit ships.
  it("keeps the variant index inside what the kit ships", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let cfg = 0; cfg < listConfigs().length; cfg++) {
        const piece = CONFIG_TO_PIECE.cliff[cfg];
        if (!piece) continue;
        const f = pieceFileFor("cliff", { config: cfg, rotation: 0, canonicalMask: 0, degree: 0 }, seed);
        expect(f).not.toBeNull();
        const idx = Number(/-(\d)\.glb$/.exec(f as string)![1]);
        expect(idx).toBeLessThan(piece.variants);
      }
    }
  });

  it("picks a stable variant per cell", () => {
    expect(cellSeed(4, 9)).toBe(cellSeed(4, 9));
    expect(cellSeed(4, 9)).not.toBe(cellSeed(9, 4));
  });
});

describe("neighbourMask", () => {
  it("sets the north bit for a cell above in -Z", () => {
    const map = createMap(5, 5);
    setCell(map, 2, 1, 1, Surface.Grass); // north of (2,2)
    const mask = neighbourMask(map, 2, 2, sameLevelOrHigher(1));
    expect(mask & (1 << Dir.N)).toBeTruthy();
    expect(mask & (1 << Dir.S)).toBeFalsy();
  });

  it("treats out-of-bounds as level 0, so an edge cell above 0 reads as exposed", () => {
    const map = createMap(3, 3);
    for (let i = 0; i < 9; i++) map.levels[i] = 1;
    const mask = neighbourMask(map, 0, 0, sameLevelOrHigher(1));
    expect(mask & (1 << Dir.W)).toBeFalsy();
    expect(mask & (1 << Dir.N)).toBeFalsy();
    expect(mask & (1 << Dir.E)).toBeTruthy();
    expect(mask & (1 << Dir.S)).toBeTruthy();
  });
});
