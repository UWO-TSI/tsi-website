import { afterEach, describe, expect, it, vi } from "vitest";
import { FISH, fishWeight, fishingPool, rollFish } from "./fishing";
import { weatherMods } from "./weatherPerks";

afterEach(() => vi.restoreAllMocks());

describe("shared fishing odds and rolls", () => {
  it.each(["sunny", "cloudy", "rain"])("preserves the authored roll distribution in %s", (weather) => {
    const random = vi.spyOn(Math, "random");
    for (const zone of ["river", "sea"] as const) {
      for (const hour of [0, 4, 9, 12, 16, 20, 23]) {
        for (const luck of [0, 0.5, 1.3]) {
          const context = { hour, weather };
          const originalPool = FISH.filter((fish) => (fish.zone ?? "river") === zone && (!fish.when || fish.when(hour, weather)));
          const originalWeights = originalPool.map((fish) => {
            let weight = fishWeight(fish, weather);
            const boost = luck + weatherMods(weather).rareLuckBonus;
            if (boost > 0 && fish.rarity !== "common" && fish.rarity !== "uncommon") weight *= 1 + boost;
            return weight;
          });
          const total = originalWeights.reduce((sum, weight) => sum + weight, 0);
          expect(fishingPool(luck, zone, context).reduce((sum, row) => sum + row.weight, 0)).toBe(total);
          for (const value of [0, 0.1, 0.5, 0.9, 1 - Number.EPSILON]) {
            let remaining = value * total;
            const expected = originalPool.find((_, i) => { remaining -= originalWeights[i]; return remaining <= 0; }) ?? originalPool.at(-1);
            random.mockReturnValue(value);
            expect(rollFish(luck, zone, context)).toBe(expected);
          }
        }
      }
    }
  });

  it("always provides a finite nonempty habitat pool, with time-gated species excluded", () => {
    for (const weather of ["sunny", "cloudy", "rain"]) {
      for (const zone of ["river", "sea"] as const) {
        for (let hour = 0; hour < 24; hour += 0.5) {
          const pool = fishingPool(0, zone, { hour, weather });
          expect(pool.length).toBeGreaterThan(0);
          for (const { fish, weight } of pool) {
            expect(fish.zone ?? "river").toBe(zone);
            expect(!fish.when || fish.when(hour, weather)).toBe(true);
            expect(Number.isFinite(weight) && weight > 0).toBe(true);
          }
          const total = pool.reduce((sum, row) => sum + row.weight, 0);
          expect(pool.reduce((sum, row) => sum + row.weight / total, 0)).toBeCloseTo(1, 12);
        }
      }
    }
  });
});
