/**
 * The arrival (routes/new.ts, lib/game/boatTrip.ts): the crossing's boat keeps to the water from far out to
 * its berth, and Bram's walk-along goes from stop to stop on ground the walker stands on. The places are the wharf's
 * dock frame and landmarks by id, so the route follows whatever world is committed; the exact path is tuned once the
 * new world's terrain is rebuilt.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as T from "@/lib/game/boatTrip";
import * as I from "@/lib/game/defaultIsland";
import * as N from "@/lib/game/residentRoutine";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";
import * as R from "../route";
import { NEW_ROUTE } from "./new";
import * as arrival from "@/components/game/arrival/ArrivalWorld";

const v = villageOfWorld(loadWorldFromDisk(fileURLToPath(new URL("../../../../data/world/", import.meta.url))));

describe("the arrival on the new world", () => {
  it("crosses on water from far out to its berth: bow, middle and stern", () => {
    const walker = I.islandOf(v), w = I.landmark("wharf", v)!, yaw = w.yaw ?? 0;
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

  it("walks Bram stop to stop on ground the walker stands on", () => {
    const walker = I.islandOf(v), w = I.landmark("wharf", v)!;
    const dock = { x: w.x, z: w.z, yaw: w.yaw ?? 0 }, route = NEW_ROUTE;
    const stops = R.resolveRoute(route, arrival.placeWorld(dock, v), { x: dock.x, z: dock.z }), nav = N.navGrid(walker, v);
    expect(stops.map(s => s.id)).toEqual(route.stops.map(s => s.id));
    for (const s of stops) expect(walker.standable(s.stand.x, s.stand.z), `${s.id} at (${s.stand.x.toFixed(1)}, ${s.stand.z.toFixed(1)})`).toBe(true);
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1].stand, b = stops[i].stand;
      expect(nav.path(a.x, a.z, b.x, b.z), `${stops[i - 1].id} to ${stops[i].id}`).not.toBeNull();
    }
  }, 60_000);
});
