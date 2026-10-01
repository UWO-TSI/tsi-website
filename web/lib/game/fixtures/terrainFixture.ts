/**
 * A synthetic test island for natural terrain (specs/terrain-blending.md
 * evidence): never shipped as the island. A cliff ring with a ramp, a gentle
 * hill and a steep mountain built of one-level slopes, a sand beach on the north
 * coast, a soil path and a stone plaza, a bay and a point. `/lab/island?fixture=terrain`
 * walks it; the painter can import it. World x runs south (screen left), z west (up-screen).
 */
import { Surface, createCenteredMap, setCell, type IslandMap } from "../grid";
import { serialiseVillage, type MapObject, type VillageDoc } from "../villageMap";

/** Level of a slope cone: `top` at the centre, one level down every `run` cells. */
const cone = (d: number, top: number, run: number) => Math.max(0, top - Math.floor(d / run));

export function terrainFixtureMap(): IslandMap {
  const map = createCenteredMap(64, 64);
  for (let cz = 0; cz < 64; cz++) {
    for (let cx = 0; cx < 64; cx++) {
      const x = cx - 32, z = cz - 32;
      const bay = x >= 16 && z >= 8 && z <= 14;
      const point = x >= -30 && x <= -22 && z >= -3 && z <= 1;
      const land = ((x / 24) ** 2 + (z / 20) ** 2 < 1 && !bay) || point;
      if (!land) { setCell(map, cx, cz, 0, Surface.River); continue; }
      let surface: number = Surface.Grass;
      // The north beach: the outer three cells of coast with z past 12.
      if (z > 12 && (x / 24) ** 2 + ((z + 3) / 20) ** 2 >= 1) surface = Surface.Sand;
      // A stone plaza and a stone path off it; a winding soil path across the island.
      if (Math.abs(x) <= 3 && z >= -5 && z <= 1) surface = Surface.Stone;
      if (x >= 4 && x <= 10 && z === -2) surface = Surface.Stone;
      if (Math.abs(x - 3 * Math.sin(z / 4)) <= 1 && z > 1 && z <= 17) surface = Surface.Soil;
      if (Math.abs(z - 10 - 2 * Math.sin(x / 5)) <= 0.6 && x > -18 && x < 14) surface = Surface.Soil;
      // A plateau one cliff up (the ring of kit pieces), a steep mountain and a gentle hill of slopes.
      const plateau = Math.hypot(x - 12, z + 8) < 5 ? 2 : 0;
      const mountain = cone(Math.hypot(x + 12, z + 6), 5, 1.5);
      const hill = cone(Math.hypot(x + 4, z - 4), 2, 2.2);
      setCell(map, cx, cz, Math.max(plateau, mountain, hill), surface);
    }
  }
  // A two-tile ramp up the plateau's south-west side.
  setCell(map, 44, 18, 0, Surface.Ramp);
  setCell(map, 44, 19, 0, Surface.Ramp);
  return map;
}

export function terrainFixtureDoc(): VillageDoc {
  const objects: MapObject[] = [{ id: "default", kind: "spawn", x: 0, z: -2 }];
  return serialiseVillage(terrainFixtureMap(), objects);
}
