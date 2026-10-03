import { afterEach, describe, expect, it } from "vitest";
import { AREAS, type RosterEntry } from "@/lib/net/protocol";
import type { NetSource, NetStatus, RemoteChange, RemoteEntry, RemotePlayer } from "@/lib/net/types";
import { activeNet, areaCount, liveRemotes, othersIn, remoteNear, remoteSeatTaken, remoteUids, setActiveNet } from "./active";

/** A test double for a NetSource: a roster, a status and remotes in view, changed by hand. */
function source(roster: RosterEntry[], players: Partial<RemotePlayer>[] = [], status: NetStatus = { kind: "joined", shard: 1 }) {
  const entries: RemoteEntry[] = players.map((p, i) => ({ sid: i + 1, player: p as RemotePlayer, sample: (_n, o) => o }));
  const listeners = new Set<() => void>(), remoteListeners = new Set<(c: RemoteChange, e: RemoteEntry) => void>();
  let st = status, ro = roster;
  const src: NetSource & { set(s: NetStatus, r?: RosterEntry[]): void; listeners: Set<() => void> } = {
    remotes: {
      get size() { return entries.length; }, at: i => entries[i], get: sid => entries.find(e => e.sid === sid),
      subscribe: l => { remoteListeners.add(l); return () => { remoteListeners.delete(l); }; },
    },
    status: () => st, roster: () => ro, now: () => 0, sendPose: () => {}, sendSlow: () => {}, leave: () => {},
    subscribe: l => { listeners.add(l); return () => { listeners.delete(l); }; },
    set(s, r) { st = s; if (r) ro = r; for (const l of listeners) l(); },
    listeners,
  };
  return src;
}
const at = (area: (typeof AREAS)[number], uid: string = area): RosterEntry => ({ uid, name: uid, badge: 0, area: AREAS.indexOf(area), flags: 0 });

afterEach(() => setActiveNet(null, null));

describe("who else is here (spec §5.8: the headcount is room state, every client agrees)", () => {
  it("counts an area's players, and the others without you once you're joined there", () => {
    const roster = [at("village", "me"), at("village", "a"), at("cafe", "b"), at("ruins", "c")];
    expect(areaCount(roster, "village")).toBe(2);
    expect(othersIn(roster, "village", true, "village")).toBe(1);
    expect(othersIn(roster, "village", false, "village")).toBe(2); // not joined: not in it yet
    expect(othersIn(roster, "cafe", true, "village")).toBe(1);
    expect(othersIn([at("village", "me")], "village", true, "village")).toBe(0); // alone: everyone shows
  });

  it("follows the source NetWorld sets, and lets go of it", () => {
    const src = source([]);
    setActiveNet(src, "village");
    expect(activeNet()).toBe(src);
    expect(src.listeners.size).toBe(1);
    setActiveNet(null, null);
    expect(activeNet()).toBeNull();
    expect(src.listeners.size).toBe(0);
  });

  it("keeps the in-view uid set until who's in view changes", () => {
    const src = source([], [{ uid: "a" }, { uid: "b" }]);
    setActiveNet(src, "village");
    const first = remoteUids();
    expect([...first]).toEqual(["a", "b"]);
    expect(remoteUids()).toBe(first);
    setActiveNet(null, null);
    expect(remoteUids().size).toBe(0);
  });

  it("knows a seat another player in view holds, and none when off", () => {
    setActiveNet(source([], [{ uid: "a", seat: "bench:bench-1#0" }, { uid: "b", seat: "" }]), "village");
    expect(remoteSeatTaken("bench:bench-1#0")).toBe(true);
    expect(remoteSeatTaken("bench:bench-1#1")).toBe(false);
    setActiveNet(null, null);
    expect(remoteSeatTaken("bench:bench-1#0")).toBe(false);
  });

  it("forgets the frame's remote positions when multiplayer goes off", () => {
    liveRemotes.x[0] = 1; liveRemotes.z[0] = 2; liveRemotes.n = 1;
    expect(remoteNear(1.5, 2, 1)).toBe(true);
    expect(remoteNear(4, 2, 1)).toBe(false);
    setActiveNet(source([]), "cafe");
    expect(liveRemotes.n).toBe(0);
  });
});
