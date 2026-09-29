import { afterEach, describe, expect, it, vi } from "vitest";
import { FISH, fishWeight, fishingPool, rollFish, setEventCatches } from "./fishing";
import { weatherMods } from "./weatherPerks";
import { SEASONAL_GOALS } from "@/lib/progression/defaults";

/** Limited-time catches stay out of the pool until their event runs (lib/game/seasonalEvents.ts). */
const LIMITED = new Set(SEASONAL_GOALS.flatMap((g) => g.event.catches));

afterEach(() => vi.restoreAllMocks());

describe("shared fishing odds and rolls", () => {
  it.each(["sunny", "cloudy", "rain"])("preserves the authored roll distribution in %s", (weather) => {
    const random = vi.spyOn(Math, "random");
    for (const zone of ["river", "sea"] as const) {
      for (const hour of [0, 4, 9, 12, 16, 20, 23]) {
        for (const luck of [0, 0.5, 1.3]) {
          const context = { hour, weather };
          const originalPool = FISH.filter((fish) => (fish.zone ?? "river") === zone && (!fish.when || fish.when(hour, weather)) && !LIMITED.has(fish.key));
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

  it("offers limited-time catches only while their event runs", () => {
    const keys = (zone: "river" | "sea") => fishingPool(0, zone, { hour: 12, weather: "sunny" }).map((r) => r.fish.key);
    expect([...keys("river"), ...keys("sea")].filter((k) => LIMITED.has(k))).toEqual([]);
    setEventCatches({ limited: LIMITED, open: new Set(["fish_sturgeon", "fish_giant_trevally"]) });
    expect(keys("river")).toContain("fish_sturgeon");
    expect(keys("river")).not.toContain("fish_yellow_perch");
    expect(keys("sea")).toContain("fish_giant_trevally");
    setEventCatches({ limited: LIMITED, open: new Set() });
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
