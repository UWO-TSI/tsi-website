"use client";

/**
 * Multiplayer inside the island's Canvas (specs/multiplayer.md §5): the other players, drawn from the page's source
 * (lib/net/netStore: the island room, or the `?bots=N` loopback in development), your avatar sent to the room
 * (lib/net/sender), and what the HUD, the seats, the café and the residents read about who's around (active.ts).
 * Without a source it mounts nothing and costs nothing: the applicant island and solo play never see it.
 */
import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useNetSource } from "@/lib/net/netStore";
import { createSender, type Sender } from "@/lib/net/sender";
import type { Area } from "@/lib/net/protocol";
import type { NetSource } from "@/lib/net/types";
import { setActiveNet } from "./active";
import RemoteAvatars from "./RemoteAvatars";

/**
 * Your avatar to the room: the sender (it finds your motion through PlayerAvatar's and InteriorPlayer's tap), ticked at
 * the default priority after PlayerAvatar (-4) has moved you, while the world is shown (not loading, no door fade).
 */
function SenderTick({ source, player, ready }: { source: NetSource; player: RefObject<THREE.Vector3>; ready: boolean }) {
  const sender = useRef<Sender | null>(null);
  useEffect(() => {
    const s = createSender(source);
    sender.current = s;
    return () => { s.dispose(); if (sender.current === s) sender.current = null; };
  }, [source]);
  useFrame((_, delta) => { if (ready) sender.current?.tick(player.current, delta * 1000); });
  return null;
}

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
  return source ? <>
    <RemoteAvatars source={source} area={area} player={player} />
    <SenderTick source={source} player={player} ready={ready} />
  </> : null;
}
