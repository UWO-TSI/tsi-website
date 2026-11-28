"use client";

/**
 * Oracle temple on the default island: the existing OracleInterior (dump pieces: altar, ruins pillars, magic-circle
 * rug, candles; the Oracle keeper). The quiz and its reveal ceremony went with row 345: the class comes from the vision.
 */
import * as THREE from "three";
import OracleInterior from "../OracleInterior";
import type { InteriorStation } from "../interiorShared";
import type { IslandLight } from "@/lib/game/islandLighting";

export default function OracleTemple({ frozen, light, player, onNear }: {
  frozen: boolean; player: React.RefObject<THREE.Vector3>; onNear: (near: "exit" | null) => void;
  /** The island's light now: the windows follow the time of day. */
  light?: IslandLight;
}) {
  return <OracleInterior frozen={frozen} light={light} playerPosRef={player as React.MutableRefObject<THREE.Vector3>}
    onNearestStation={(s: InteriorStation | null) => onNear(s && s.id !== "altar" ? "exit" : null)} />;
}
