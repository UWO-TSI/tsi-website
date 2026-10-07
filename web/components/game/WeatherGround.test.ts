import { describe, expect, it } from "vitest";
import { Surface } from "@/lib/game/grid";
import { groundRenderOrder } from "./grid/GridTerrain";
import { PRINT_ORDER } from "./WeatherGround";

describe("snow prints", () => {
  // Audit 2026-10 world item 15: the beach and the paths are see-through overlays that do not write depth, and the
  // prints drew before the paths (and in an arbitrary order with the sand), so they were painted over.
  it("draw after every ground layer", () => {
    for (let layer = 0; layer <= 12; layer++) expect(groundRenderOrder(layer), `layer ${layer}`).toBeLessThan(PRINT_ORDER);
    expect(groundRenderOrder(Surface.Soil)).toBeLessThan(PRINT_ORDER);
    expect(groundRenderOrder(Surface.Sand)).toBeLessThan(PRINT_ORDER);
  });
});
