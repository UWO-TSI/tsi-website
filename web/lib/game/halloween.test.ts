import { describe, expect, it } from "vitest";
import { FOG_NIGHT, KNOCK_SIDE, doorPoint, fogNightLight, homeOf, knockDoors, nextAnswer, pumpkinSpots } from "./halloween";
import { islandOf, landmarks } from "./defaultIsland";
import { buildVillage, objectsOf, village, type VillageDoc } from "./villageMap";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import { islandLight } from "./islandLighting";
import { CURRENT } from "./lookPreset";
import worldDoc from "@/data/world-map.json";

describe("Halloween on the island (lib/game/halloween.ts)", () => {
  const v = village(), island = islandOf(v);

  it("sets pumpkins by every lamp post, each lived-in door and the anchors, on open ground and apart, the same every load", () => {
    const spots = pumpkinSpots(v, island.standable);
    const lamps = objectsOf("lamp", v).length;
    expect(spots.filter(s => s.by.startsWith("lamp:")).length).toBe(lamps);
    expect(spots.filter(s => s.by.startsWith("door:")).length).toBeGreaterThanOrEqual(4);
    expect(spots.filter(s => s.by.startsWith("anchor:")).length).toBeGreaterThan(8);
    for (const s of spots) expect(island.standable(s.x, s.z), s.by).toBe(true);
    for (const a of spots) for (const b of spots) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(0.6);
    expect(pumpkinSpots(v, island.standable)).toEqual(spots);
    // An overlay: the map gains nothing.
    expect(v.objects.some(o => o.id.includes("pumpkin"))).toBe(false);
  });

  it("places them on the v2 world too, from its own lamps and doors", () => {
    const w = buildVillage(worldDoc as unknown as VillageDoc);
    const spots = pumpkinSpots(w, islandOf(w).standable);
    expect(spots.filter(s => s.by.startsWith("lamp:")).length).toBeGreaterThan(5);
    expect(spots.filter(s => s.by.startsWith("door:")).length).toBeGreaterThanOrEqual(4);
  });

  it("knocks where someone's home at night: Odile at the museum, Sable at the temple, not Bram (he's on the wharf)", () => {
    const doors = knockDoors(v, PROPOSED_RESIDENTS);
    const who = Object.fromEntries(doors.map(d => [d.home, d.residents.map(r => r.slug)]));
    expect(who.museum).toContain("curator");
    expect(who.oracle).toContain("oracle-keeper");
    expect(Object.values(who).flat()).not.toContain("wharf-keeper");
    expect(homeOf({ post: "museum_curator", schedule: {} })).toBe("museum");
    expect(homeOf({ post: "villager", schedule: { home: "shop" } })).toBe("shop");
    // The knock spot is beside the door, where its pumpkin stands.
    const spots = pumpkinSpots(v, island.standable);
    for (const d of doors) {
      const l = landmarks(v).find(m => m.id === d.home)!, [dx, dz] = doorPoint(l);
      expect(Math.hypot(d.x - dx, d.z - dz)).toBeCloseTo(Math.hypot(KNOCK_SIDE, 0.35) * (l.scale ?? 1), 1);
      if (island.standable(d.x, d.z)) expect(spots.some(s => Math.hypot(s.x - d.x, s.z - d.z) < 0.01), d.home).toBe(true);
    }
  });

  it("answers in turn: the next resident behind the door who hasn't given you anything tonight", () => {
    const door = { home: "hq" as const, x: 0, z: 0, residents: [{ slug: "a", name: "A" }, { slug: "b", name: "B" }] };
    expect(nextAnswer(door, new Set())?.slug).toBe("a");
    expect(nextAnswer(door, new Set(["a"]))?.slug).toBe("b");
    expect(nextAnswer(door, new Set(["a", "b"]))).toBeNull();
  });

  it("a fog night cools and closes the fog and colds the moon, eased by k, adding nothing at 0", () => {
    const night = islandLight(CURRENT, "night");
    expect(fogNightLight(night, 0)).toBe(night);
    const full = fogNightLight(night, 1), half = fogNightLight(night, 0.5);
    expect(full.fogFar).toBeCloseTo(night.fogFar * FOG_NIGHT.far);
    expect(full.fogNear).toBeLessThan(night.fogNear);
    expect(half.fogFar).toBeGreaterThan(full.fogFar);
    expect(half.fogFar).toBeLessThan(night.fogFar);
    expect(full.sunIntensity).toBeLessThan(night.sunIntensity);
    expect(full.sun).not.toBe(night.sun);
  });
});
