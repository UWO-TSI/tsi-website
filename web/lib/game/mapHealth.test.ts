import { describe, expect, it } from "vitest";
import { terrainHealth, terrainProblems, villageHealth } from "./mapHealth";
import { CLIFF_LEVELS, cellToWorldX, cellToWorldZ, createCenteredMap, setCell, Surface } from "./grid";
import { villageOf, type MapObject } from "./villageMap";

/** A 40×40 village: land with a pond inside a ring of cliffs no ramp climbs, joined to the sea by a channel. */
function pondBehindCliffs() {
  const map = createCenteredMap(40, 40);
  for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) {
    const land = x >= 5 && x <= 34 && z >= 5 && z <= 34, ring = x >= 12 && x <= 27 && z >= 12 && z <= 27;
    const pond = x >= 17 && x <= 22 && z >= 17 && z <= 22, channel = (x === 19 || x === 20) && z >= 17;
    setCell(map, x, z, ring && !pond && !channel ? CLIFF_LEVELS : 0, land && !pond && !channel ? Surface.Grass : Surface.River);
  }
  const at = (id: string, kind: MapObject["kind"], cx: number, cz: number): MapObject => ({ id, kind, x: cellToWorldX(map, cx), z: cellToWorldZ(map, cz) });
  return { map, objects: [at("default", "spawn", 8, 8), at("pond", "landmark", 19.5, 19.5)] };
}

describe("village health", () => {
  it("checks the pond the game fishes (its marker), even where it opens onto a river", () => {
    const { map, objects } = pondBehindCliffs();
    expect(villageHealth(villageOf(map, objects)).problems.fishing).toContain("pond not fishable");
  });
  it("names overlaps by kind and id, so a landmark and an anchor sharing an id are told apart", () => {
    const { map, objects } = pondBehindCliffs();
    const tree = (id: string): MapObject => ({ id, kind: "tree", x: cellToWorldX(map, 8), z: cellToWorldZ(map, 30), seed: 1 });
    const { warnings } = villageHealth(villageOf(map, [...objects, tree("a"), tree("b")]));
    expect(warnings).toContain("tree:a overlaps tree:b");
  });
  it("lets hills and mountains of one-level slopes stand, any height, asking only for flat ground", () => {
    const map = createCenteredMap(48, 48);
    const hill = (x: number, z: number) => Math.max(0, 6 - Math.floor(Math.hypot(x - 18, z - 18) / 2));
    for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) setCell(map, x, z, hill(x, z), Surface.Grass);
    const t = terrainHealth(map);
    expect(t.slopeCells).toBeGreaterThan(100);
    expect(t.stranded).toBe(0);
    expect(terrainProblems(t)).toEqual({});
    // A whole island of slope is not mostly flat.
    for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) setCell(map, x, z, Math.max(0, 6 - Math.floor(Math.hypot(x - 24, z - 24) / 4)), Surface.Grass);
    expect(Object.keys(terrainProblems(terrainHealth(map)))).toEqual(["flat ground under 60%"]);
  });
});
