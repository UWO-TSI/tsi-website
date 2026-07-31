import { describe, it, expect } from "vitest";
import {
  TILE,
  LEVEL_STEP,
  CLIFF_LEVELS,
  CLIFF_HEIGHT,
  isWalkableDrop,
  halfCliffEdges,
  cellHeightRange,
  HALF_STEP_RISE,
  heightField,
  sampleHeightField,
  bankEdges,
  needsCliff,
  cliffPieceFor,
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
  resizeMap,
  legaliseTerraces,
  ORTHOGONAL,
  inBounds,
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
  runAlongWall,
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
    // ONE level is ONE cliff piece (David, 2026-07-29). The 2026-07-28 half
    // step is reverted: every level change is a hard cliff, and half steps are
    // stairs and ramps you place rather than ground you walk up. The product is
    // still the kit's measured 1.5u wall, which is the invariant that matters.
    // TWO cliff heights, neither a slope (David, 2026-07-30). A one-level drop
    // is a 0.75u half cliff built from geometry; two levels is the kit's
    // measured 1.5u wall. The product is still the piece.
    expect(LEVEL_STEP).toBe(0.75);
    expect(CLIFF_LEVELS).toBe(2);
    expect(CLIFF_HEIGHT).toBeCloseTo(1.5, 6);
    expect(HALF_STEP_RISE).toBeCloseTo(0.75, 6);
    expect(HALF_STEP_RISE * 2).toBeCloseTo(CLIFF_HEIGHT, 6);
    // A half step is BLENDED, so it is walkable; a full drop is a kit cliff.
    expect(isWalkableDrop(1)).toBe(true);
    expect(isWalkableDrop(CLIFF_LEVELS)).toBe(false);
    expect(WATER_DROP).toBeCloseTo(0.078, 5);
    expect(CHUNK).toBe(16);
    expect(MAX_LEVEL).toBe(6);
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
    expect(heightAt(map, 1, 1)).toBeCloseTo(2 * LEVEL_STEP, 6);
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

  it("carries a plot footprint through", () => {
    // The parser builds each prop field by field, so an added field is silently
    // dropped on the next save unless it is handled there too. This is the test
    // that fails when someone adds one and forgets.
    const map = createCenteredMap(8, 8);
    const props = [
      { kind: "building", id: "hq", cell: [2, 3] as [number, number], level: 1, size: [5, 4] as [number, number] },
      { kind: "tree", cell: [0, 0] as [number, number], level: 0 },
    ];
    const { props: back } = parseIslandMap(serialiseIslandMap(map, props));
    expect(back).toEqual(props);
    expect(back[1].size).toBeUndefined();
  });

  it("round-trips named annotations", () => {
    const map = createCenteredMap(8, 8);
    const annotations = [
      { name: "fence", color: "#c9a227", cells: [[1, 1], [2, 1], [3, 1]] as [number, number][] },
      { name: "paved later", color: "#8899aa", cells: [[5, 5]] as [number, number][] },
    ];
    const doc = serialiseIslandMap(map, [], annotations);
    expect(parseIslandMap(doc).annotations).toEqual(annotations);
  });

  it("omits the annotations key entirely when there are none", () => {
    // So the shipped map does not carry a dead key and a diff stays clean.
    const doc = serialiseIslandMap(createCenteredMap(4, 4), []);
    expect("annotations" in doc).toBe(false);
    expect(parseIslandMap(doc).annotations).toEqual([]);
  });

  it("defaults a missing annotation colour and drops malformed cells", () => {
    const doc = serialiseIslandMap(createCenteredMap(4, 4), []);
    doc.annotations = [{ name: "fence", cells: [[1, 1], [2], [], [3, 3]] }];
    const { annotations } = parseIslandMap(doc);
    expect(annotations[0].color).toBe("#ffffff");
    expect(annotations[0].cells).toEqual([[1, 1], [3, 3]]);
  });

  it("ignores a malformed footprint rather than half-reading it", () => {
    const map = createCenteredMap(4, 4);
    const doc = serialiseIslandMap(map, []);
    doc.props = [
      { kind: "building", cell: [1, 1], level: 0, size: [3] },
      { kind: "building", cell: [2, 2], level: 0, size: [] },
    ];
    const { props: back } = parseIslandMap(doc);
    expect(back[0].size).toBeUndefined();
    expect(back[1].size).toBeUndefined();
  });
});

describe("legaliseTerraces", () => {
  it("lowers a face the kit cannot draw, and keeps the peak a peak", () => {
    // David's temple mountain, in miniature: level 6 sitting straight on level
    // 3. The kit is CLIFF_LEVELS tall and does not stack, so 3 -> 6 renders as
    // a hole.
    //
    // The plain is wide on purpose. Out of bounds reads as level 0, so a
    // mountain touching the map edge is legitimately crushed by its own border
    // and the test would be measuring that instead.
    const N = 15;
    const map = createCenteredMap(N, N);
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) setCell(map, x, z, 3, Surface.Grass);
    for (let x = 6; x < 9; x++) for (let z = 6; z < 9; z++) setCell(map, x, z, 6, Surface.Grass);

    const moved = legaliseTerraces(map);
    expect(moved).toBeGreaterThan(0);
    // Still high ground, just reachable-looking high ground.
    expect(levelAt(map, 7, 7)).toBeGreaterThan(3);
    let worst = 0;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        for (const [dx, dz] of ORTHOGONAL) {
          if (!inBounds(map, x + dx, z + dz)) continue;
          worst = Math.max(worst, Math.abs(levelAt(map, x, z) - levelAt(map, x + dx, z + dz)));
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(CLIFF_LEVELS);
  });

  it("is a no-op on a map that is already legal", () => {
    const map = createCenteredMap(6, 6);
    for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) setCell(map, x, z, x < 3 ? 0 : 2, Surface.Grass);
    expect(legaliseTerraces(map)).toBe(0);
  });

  it("leaves a coastal cliff alone", () => {
    // Sea reads as level 0, so raised ground meeting water is legal and is the
    // rocks-at-the-waterline silhouette, not a defect.
    const map = createCenteredMap(4, 1);
    setCell(map, 0, 0, 0, Surface.Void);
    for (let x = 1; x < 4; x++) setCell(map, x, 0, 2, Surface.Grass);
    expect(legaliseTerraces(map)).toBe(0);
    expect(levelAt(map, 1, 0)).toBe(2);
  });

  it("terminates on a tall spike instead of spinning", () => {
    const map = createCenteredMap(5, 5);
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) setCell(map, x, z, 0, Surface.Grass);
    setCell(map, 2, 2, MAX_LEVEL, Surface.Grass);
    legaliseTerraces(map);
    expect(levelAt(map, 2, 2)).toBe(CLIFF_LEVELS);
  });
});

describe("serialisation scale", () => {
  it("stamps the engine's live scale into the document", () => {
    // A draft carried levelStep 1.5 forward while the engine had moved to 0.75,
    // so a mountain authored as 9u tall would have rendered at 4.5u silently.
    const doc = serialiseIslandMap(createCenteredMap(4, 4), []);
    expect(doc.levelStep).toBe(LEVEL_STEP);
    expect(doc.tile).toBe(TILE);
  });
});

describe("resizeMap", () => {
  it("keeps every surviving cell at the same world position", () => {
    // The invariant the whole feature rests on. If a resize moved cells in
    // world space it would slide the island out from under the props and the
    // hardcoded building coordinates.
    const map = createCenteredMap(8, 8);
    setCell(map, 2, 3, 2, Surface.Stone);
    setCell(map, 6, 6, 1, Surface.Sand);
    const beforeX = cellToWorldX(map, 2);
    const beforeZ = cellToWorldZ(map, 3);

    const { map: big } = resizeMap(map, [], 16);
    const ox = (16 - 8) / 2;
    expect(cellToWorldX(big, 2 + ox)).toBeCloseTo(beforeX, 9);
    expect(cellToWorldZ(big, 3 + ox)).toBeCloseTo(beforeZ, 9);
    expect(levelAt(big, 2 + ox, 3 + ox)).toBe(2);
    expect(surfaceAt(big, 2 + ox, 3 + ox)).toBe(Surface.Stone);
    expect(surfaceAt(big, 6 + ox, 6 + ox)).toBe(Surface.Sand);
  });

  it("fills the new margin with sea, not grass", () => {
    // Surface.Grass is 0, so the zeroed array behind a new map is a solid grass
    // square. Without an explicit fill, growing the grid silently turns open
    // water into walkable land -- measured at 9216 phantom cells going 128->160.
    const map = createCenteredMap(4, 4);
    for (let i = 0; i < map.surfaces.length; i++) map.surfaces[i] = Surface.Grass;
    const { map: big } = resizeMap(map, [], 12);
    expect(surfaceAt(big, 0, 0)).toBe(Surface.Void);
    expect(surfaceAt(big, 11, 11)).toBe(Surface.Void);
    let grass = 0;
    for (const s of big.surfaces) if (s === Surface.Grass) grass++;
    expect(grass).toBe(16); // exactly the original 4x4, nothing more
  });

  it("moves props with their cells and drops what a shrink cuts off", () => {
    const map = createCenteredMap(8, 8);
    const props = [
      { kind: "tree", cell: [4, 4] as [number, number], level: 0 },
      { kind: "rock", cell: [0, 0] as [number, number], level: 0 },
    ];
    // 8 -> 4 offsets by -2, so the centre prop survives at (2,2) and the
    // corner one lands at (-2,-2) and is cut.
    const { props: out } = resizeMap(map, props, 4);
    expect(out).toEqual([{ kind: "tree", cell: [2, 2], level: 0 }]);
  });

  it("shifts annotations with the grid and drops ones a shrink empties", () => {
    const map = createCenteredMap(8, 8);
    const annotations = [
      { name: "fence", color: "#c9a227", cells: [[4, 4], [5, 4]] as [number, number][] },
      { name: "edge note", color: "#fff", cells: [[0, 0]] as [number, number][] },
    ];
    // 8 -> 4 offsets by -2: the fence lands at (2,2),(3,2) and the corner note
    // falls off the map entirely.
    const out = resizeMap(map, [], 4, annotations);
    expect(out.annotations).toEqual([
      { name: "fence", color: "#c9a227", cells: [[2, 2], [3, 2]] },
    ]);
  });

  it("survives a grow-then-shrink round trip", () => {
    const map = createCenteredMap(8, 8);
    setCell(map, 3, 5, 2, Surface.Brick);
    const { map: big, props: bigProps } = resizeMap(map, [], 24);
    const { map: back } = resizeMap(big, bigProps, 8);
    expect(back.originX).toBe(map.originX);
    expect(levelAt(back, 3, 5)).toBe(2);
    expect(surfaceAt(back, 3, 5)).toBe(Surface.Brick);
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
      const f = pieceFileFor("cliff", c, mask);
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

  // The four variants are consecutive quarters of ONE rock strip (u-min steps
  // by 0.25 across every family), so consecutive cells ALONG a wall must get
  // consecutive quarters or the rock pattern jumps at every cell boundary.
  it("walks the texture strip in order along a wall", () => {
    const straight = { config: 8, rotation: 0, canonicalMask: 31, degree: 5 };
    const seq = [0, 1, 2, 3, 4].map((run) => pieceFileFor("cliff", straight, run));
    expect(seq).toEqual([
      "5-b-0.glb",
      "5-b-3.glb",
      "5-b-2.glb",
      "5-b-1.glb",
      "5-b-0.glb",
    ]);
  });

  it("runs along Z unrotated and along X at a quarter-turn", () => {
    // Which axis this is was MEASURED against the real map, not derived —
    // cz gives 97% continuous seams where cx gives 3%. See runAlongWall.
    expect(runAlongWall(0, 7, 3)).toBe(3);
    expect(runAlongWall(2, 7, 3)).toBe(3);
    expect(runAlongWall(1, 7, 3)).toBe(7);
    expect(runAlongWall(3, 7, 3)).toBe(7);
  });

  it("is stable for a cell and continuous between its neighbours", () => {
    const straight = { config: 8, rotation: 0, canonicalMask: 31, degree: 5 };
    const at = (cx: number, cz: number) =>
      pieceFileFor("cliff", straight, runAlongWall(straight.rotation, cx, cz));
    expect(at(4, 9)).toBe(at(4, 9));
    // Neighbours along the wall differ; neighbours across it do not.
    expect(at(4, 9)).not.toBe(at(4, 10));
    expect(at(4, 9)).toBe(at(5, 9));
  });
});

describe("leveling: flat, full cliffs, and rare blended half steps", () => {
  // David 2026-07-29, after looking at real ACNH terrain: "keep game mostly flat
  // and have cliffs if there's level change so that there's no more slope that
  // will affect building." This replaces the 2026-07-28 half-step rule. Half
  // steps are now stairs and ramps you PLACE, not ground you walk up.
  it("calls a blended half step walkable and a full drop not", () => {
    expect(isWalkableDrop(0)).toBe(false); // flat is not a step
    expect(isWalkableDrop(1)).toBe(true); // blended by heightField
    expect(isWalkableDrop(CLIFF_LEVELS)).toBe(false); // kit cliff
  });

  it("makes a one-level drop a blended step, with no kit piece", () => {
    const map = createMap(5, 5);
    for (let i = 0; i < 25; i++) map.levels[i] = 1;
    setCell(map, 2, 2, 2, Surface.Grass); // one level above its neighbours
    // Four orthogonal faces, all half height, and the kit is not involved --
    // it only ships the 1.5u wall.
    expect(halfCliffEdges(map, 2, 2)).toHaveLength(4);
    expect(needsCliff(map, 2, 2)).toBe(false);
    expect(cliffPieceFor(map, 2, 2)).toBeNull();
  });

  it("makes a two-level drop a FULL cliff, with a kit piece", () => {
    const map = createMap(5, 5);
    setCell(map, 2, 2, CLIFF_LEVELS, Surface.Grass);
    expect(needsCliff(map, 2, 2)).toBe(true);
    expect(cliffPieceFor(map, 2, 2)).not.toBeNull();
    // A full drop is NOT also reported as a half face, or it would be drawn twice.
    expect(halfCliffEdges(map, 2, 2)).toHaveLength(0);
  });

  it("lets one cell have both tiers on different sides", () => {
    const map = createMap(5, 5);
    for (let i = 0; i < 25; i++) map.levels[i] = 2;
    setCell(map, 1, 2, 1, Surface.Grass); // west is one level down
    setCell(map, 3, 2, 0, Surface.Grass); // east is two levels down
    expect(halfCliffEdges(map, 2, 2)).toEqual([[-1, 0]]);
    expect(needsCliff(map, 2, 2)).toBe(true);
  });

  it("keeps a cliff piece exactly one kit-height tall", () => {
    // The kit is 1.5u of wall and does not stack, so CLIFF_LEVELS levels of
    // LEVEL_STEP must equal it or every face is the wrong size. With both back
    // to one-to-one, a level and a piece are the same thing again.
    expect(CLIFF_LEVELS * LEVEL_STEP).toBeCloseTo(CLIFF_HEIGHT, 6);
    // A level is HALF a piece again, so the two tiers stack exactly.
    expect(LEVEL_STEP * 2).toBeCloseTo(CLIFF_HEIGHT, 6);
  });

  it("blends a half step but never a full cliff", () => {
    // The whole mechanism in one test: the blur crosses a one-level drop and
    // treats a full drop as a barrier, so half steps come out soft and cliff
    // tops stay flat right up to the lip where the kit piece sits.
    const half = createMap(13, 13);
    for (let z = 0; z < 13; z++) for (let x = 7; x < 13; x++) setCell(half, x, z, 1, Surface.Grass);
    const hf = heightField(half);
    // Three cells before the boundary the ground has already started to lift.
    const before = sampleHeightField(half, hf, cellToWorldX(half, 5), cellToWorldZ(half, 6));
    expect(before).toBeGreaterThan(0.01);
    expect(before).toBeLessThan(LEVEL_STEP);
    // Halfway across the boundary itself, which is what makes it a blend rather
    // than a step placed on one side.
    expect(sampleHeightField(half, hf, cellToWorldX(half, 7), cellToWorldZ(half, 6))).toBeCloseTo(
      LEVEL_STEP / 2,
      2
    );

    const full = createMap(13, 13);
    for (let z = 0; z < 13; z++) for (let x = 7; x < 13; x++) setCell(full, x, z, CLIFF_LEVELS, Surface.Grass);
    const ff = heightField(full);
    // Same place, across a FULL drop: dead flat, because the blur cannot cross.
    // Clamped to what the cell can reach: the raw field reads 0.75 here because
    // the shared corner is pinned to the cliff top, and cellHeightRange is what
    // stops the low ground riding halfway up the wall.
    const range = cellHeightRange(full, 6, 6);
    expect(range).not.toBeNull();
    const [lo, hi] = range!;
    expect(hi).toBeCloseTo(0, 6);
    const raw = sampleHeightField(full, ff, cellToWorldX(full, 6), cellToWorldZ(full, 6));
    expect(Math.min(hi, Math.max(lo, raw))).toBeCloseTo(0, 6);
    // A cell with NO cliff near it must not clamp at all, or two neighbours
    // clamped to different ranges leave a crack in the surface.
    expect(cellHeightRange(half, 3, 6)).toBeNull();
    // And the cliff top is exactly at its level for the piece to sit on.
    expect(sampleHeightField(full, ff, cellToWorldX(full, 10), cellToWorldZ(full, 6))).toBeCloseTo(
      CLIFF_LEVELS * LEVEL_STEP,
      6
    );
  });
});

describe("neighbourMask", () => {
  it("sets the north bit for a cell above in -Z", () => {
    const map = createMap(5, 5);
    // A CLIFF-sized difference, because a single level is a bank and the mask
    // deliberately reads a bank as the same tier.
    setCell(map, 2, 1, CLIFF_LEVELS, Surface.Grass); // north of (2,2)
    const mask = neighbourMask(map, 2, 2, sameLevelOrHigher(CLIFF_LEVELS));
    expect(mask & (1 << Dir.N)).toBeTruthy();
    expect(mask & (1 << Dir.S)).toBeFalsy();
  });

  it("treats out-of-bounds as level 0, so an edge cell above 0 reads as exposed", () => {
    const map = createMap(3, 3);
    for (let i = 0; i < 9; i++) map.levels[i] = CLIFF_LEVELS;
    const mask = neighbourMask(map, 0, 0, sameLevelOrHigher(CLIFF_LEVELS));
    expect(mask & (1 << Dir.W)).toBeFalsy();
    expect(mask & (1 << Dir.N)).toBeFalsy();
    expect(mask & (1 << Dir.E)).toBeTruthy();
    expect(mask & (1 << Dir.S)).toBeTruthy();
  });
});
