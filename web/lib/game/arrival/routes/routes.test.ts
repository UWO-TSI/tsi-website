/**
 * The arrival on each world (routes/, lib/game/boatTrip.ts): the crossing's boat keeps to the water from far out to
 * its berth, and Bram's walk-along goes from stop to stop on ground the walker stands on. The places are the wharf's
 * dock frame and landmarks by id, so the route follows whatever world is committed; the exact path is tuned once the
 * new world's terrain is rebuilt.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/** The modules as the build for `world` loads them (NEXT_PUBLIC_GAME_WORLD is read once, at import). */
async function arrivalOn(world: "village" | "new") {
  vi.stubEnv("NEXT_PUBLIC_GAME_WORLD", world);
  vi.resetModules();
  try {
    const [trip, island, nav, map, disk, village, route, routes, arrival] = await Promise.all([
      import("@/lib/game/boatTrip"), import("@/lib/game/defaultIsland"), import("@/lib/game/residentRoutine"), import("@/lib/game/villageMap"),
      import("@/lib/game/world/disk"), import("@/lib/game/world/village"), import("../route"), import("."), import("@/components/game/arrival/ArrivalWorld"),
    ]);
    const v = world === "new" ? village.villageOfWorld(disk.loadWorldFromDisk(fileURLToPath(new URL("../../../../data/world/", import.meta.url)))) : map.village();
    return { trip, island, nav, route, routes, arrival, v };
  } finally { vi.unstubAllEnvs(); }
}

describe.each(["village", "new"] as const)("the arrival on the %s world", (world) => {
  it("crosses on water from far out to its berth: bow, middle and stern", async () => {
    const { trip: T, island: I, v } = await arrivalOn(world), walker = I.islandOf(v), w = I.landmark("wharf", v)!, yaw = w.yaw ?? 0;
    const toWorld = (x: number, z: number) => [w.x + x * Math.cos(yaw) + z * Math.sin(yaw), w.z - x * Math.sin(yaw) + z * Math.cos(yaw)] as const;
    const trip = { ...T.arrivalTrip("me", "village", 0, true, true), crossing: true }, pose = T.newBoatPose(), dry: string[] = [];
    for (const phase of ["cross", "dock"] as const) {
      const t = { ...trip, phase, at: 0 }, length = T.phaseLength(t);
      for (let k = 0; k <= 1; k += 1 / 300) {
        T.boatPose(t, length * 1000 * k, pose);
        for (const along of [-1.2, 0, 1.2]) {
          const [x, z] = toWorld(pose.x + Math.sin(pose.yaw) * along, pose.z + Math.cos(pose.yaw) * along);
          if (!walker.wet(x, z)) dry.push(`${phase} ${k.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        }
      }
    }
    expect(dry.slice(0, 5)).toEqual([]);
  });

  it("walks Bram stop to stop on ground the walker stands on", async () => {
    const { island: I, nav: N, route: R, routes, arrival, v } = await arrivalOn(world), walker = I.islandOf(v), w = I.landmark("wharf", v)!;
    const dock = { x: w.x, z: w.z, yaw: w.yaw ?? 0 }, route = routes.routeFor(world);
    expect(route.world).toBe(world);
    const stops = R.resolveRoute(route, arrival.placeWorld(dock, v), { x: dock.x, z: dock.z }), nav = N.navGrid(walker, v);
    expect(stops.map(s => s.id)).toEqual(route.stops.map(s => s.id));
    for (const s of stops) expect(walker.standable(s.stand.x, s.stand.z), `${s.id} at (${s.stand.x.toFixed(1)}, ${s.stand.z.toFixed(1)})`).toBe(true);
    // His way: each stop's waypoints then its stand, on ground he can walk.
    for (let i = 1; i < stops.length; i++) {
      const way = [stops[i - 1].stand, ...stops[i].via.filter(w => !w.hop), stops[i].stand];
      for (const w of way) expect(walker.standable(w.x, w.z), `${stops[i].id} way at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`).toBe(true);
      for (let k = 1; k < way.length; k++) expect(nav.path(way[k - 1].x, way[k - 1].z, way[k].x, way[k].z), `${stops[i - 1].id} to ${stops[i].id}, leg ${k}`).not.toBeNull();
    }
    // Every place the route names is in this world (none fell back to the place before it).
    // The new world: the first catch's stand has water in a cast's reach and is out of the sell barrel's reach, whose E is Sell.
    const spots = await import("@/lib/game/fishingSpots");
    for (const st of world === "new" ? stops.filter(x => x.task?.kind === "catch") : []) {
      expect(spots.fishingSpot(walker.map, () => "sea", st.stand.x, st.stand.z), `${st.id}: water in reach`).not.toBeNull();
      const barrel = arrival.placeWorld(dock, v).prop?.("sell-barrel");
      if (barrel) expect(Math.hypot(barrel.x - st.stand.x, barrel.z - st.stand.z), `${st.id}: clear of the barrel`).toBeGreaterThan(2.6);
    }
    if (world === "new") {
      const pw = arrival.placeWorld(dock, v);
      for (const st of route.stops) for (const p of [st.stand, ...(st.via ?? []), ...(st.shots ?? []).filter(x => x !== null && x !== "bram")]) expect(R.resolvePlace(p, pw), JSON.stringify(p)).not.toBeNull();
    }
  }, 60_000);
});
