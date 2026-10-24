/**
 * The new world's border (lib/game/barriers.ts "border"): walking up to its invisible wall says the area beyond is
 * releasing soon, once per approach (it waits until you've stepped away). Nothing on a map without one.
 */
import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { BORDER_NOTE, barrierBoxes, barrierPlacements, inBarrier } from "@/lib/game/barriers";
import type { Village } from "@/lib/game/villageMap";

/** Said within NEAR of the wall; said again only after going AWAY from it. */
const NEAR = 1.2, AWAY = 6;

export default function BorderNotice({ village, player }: { village: Village; player: RefObject<THREE.Vector3> }) {
  const boxes = useMemo(() => barrierBoxes(barrierPlacements(village).filter(b => b.model === "border")), [village]);
  const said = useRef(false);
  useFrame(() => {
    const p = player.current;
    if (!boxes.length || !p) return;
    if (said.current) { if (!inBarrier(boxes, p.x, p.z, AWAY)) said.current = false; return; }
    if (!inBarrier(boxes, p.x, p.z, NEAR)) return;
    said.current = true;
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: BORDER_NOTE } })), 0);
  });
  return null;
}
