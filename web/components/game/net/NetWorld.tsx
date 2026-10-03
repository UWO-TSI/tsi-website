"use client";

/**
 * Multiplayer inside the island's Canvas (specs/multiplayer.md §5): the other players, drawn from the page's source
 * (lib/net/netStore: the island room, or the `?bots=N` loopback in development), and what the HUD, the seats, the
 * café and the residents read about who's around (active.ts). Without a source it mounts nothing and costs nothing:
 * the applicant island and solo play never see it.
 */
import { useEffect, type RefObject } from "react";
import type * as THREE from "three";
import { useNetSource } from "@/lib/net/netStore";
import type { Area } from "@/lib/net/protocol";
import { setActiveNet } from "./active";
import RemoteAvatars from "./RemoteAvatars";

export default function NetWorld({ area, player, ready }: {
  /** The scene you're in (the store sends it). */
  area: Area;
  /** Where you stand: the tiers' distances, and what the sender sends. */
  player: RefObject<THREE.Vector3>;
  /** The world is shown and settled (no loading, no door fade): connect, and send. */
  ready: boolean;
}) {
  const source = useNetSource({ area, ready });
  useEffect(() => { setActiveNet(source, source && area); }, [source, area]);
  useEffect(() => () => setActiveNet(null, null), []);
  return source ? <RemoteAvatars source={source} area={area} player={player} /> : null;
}
