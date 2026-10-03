"use client";

/**
 * The other players in view (specs/multiplayer.md §5.4): one RemoteAvatar each, driven by one frame loop at priority
 * -3 from the source's interpolated samples, as NPC.tsx drives the residents. React hears only about players coming,
 * going or changing card or slow state (the registry's add, remove and change), never about motion.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { villageIsland } from "@/lib/game/defaultIsland";
import { village } from "@/lib/game/villageMap";
import type { Area } from "@/lib/net/protocol";
import type { NetSource } from "@/lib/net/types";
import { FLAT_GROUND, driveRig, type GroundWorld } from "./drive";
import { RemoteAvatar } from "./RemoteAvatar";
import { RigStore } from "./rigs";

/** Indoors (interiorShared's walker, PLAYER_SPEED) people walk at 4.6: the Walk clip keeps their pace there. */
const INDOOR_WALK = 4.6, WALK = 7.4;
const INDOORS: ReadonlySet<Area> = new Set<Area>(["hq", "museum", "oracle", "house"]);

/** What remotes stand on in an area: the village's walk world; the rooms are flat. */
export const groundOf = (area: Area): GroundWorld => (area === "village" ? villageIsland(village()) : FLAT_GROUND);

/** The frame (module scope: the react compiler forbids writing through hook values). */
function driveAll(store: RigStore, source: NetSource, world: GroundWorld) {
  const reg = source.remotes, now = source.now();
  for (let i = 0; i < reg.size; i++) {
    const e = reg.at(i), r = store.map.get(e.sid);
    if (!r) continue;
    r.entry = e;
    driveRig(r, now, world, null);
    const a = r.anchor.current;
    if (a && !a.visible) a.visible = true;
  }
}

export default function RemoteAvatars({ source, area }: { source: NetSource; area: Area }) {
  const store = useMemo(() => new RigStore(source.remotes), [source]);
  useEffect(() => store.attach(), [store]);
  const rigs = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const world = useMemo(() => groundOf(area), [area]);
  useFrame(() => driveAll(store, source, world), -3);
  const walk = INDOORS.has(area) ? INDOOR_WALK : WALK;
  return <>{rigs.map(r => <RemoteAvatar key={r.sid} rig={r} player={r.entry.player} walkSpeed={walk} />)}</>;
}
