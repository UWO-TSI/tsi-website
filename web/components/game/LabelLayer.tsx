"use client";

/**
 * Runs the world's label layout (lib/game/labelLayout.ts) after each frame is drawn, the camera final: the other
 * players' and the residents' name tags (lib/game/nameTags.ts), the landmark tags, speech bubbles and whatever else
 * registered with `worldLabels`. Your own name is hidden (v1 name tags), so nothing stands in for it here.
 */
import { useEffect, type RefObject } from "react";
import { addAfterEffect, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { worldLabels } from "@/lib/game/labelLayout";

export default function LabelLayer({ focus }: { focus: RefObject<THREE.Vector3> }) {
  const get = useThree(s => s.get);
  useEffect(() => {
    let last = -1;
    const off = addAfterEffect(t => {
      const { camera, size } = get();
      const dt = last < 0 ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      worldLabels.solve(camera, size.width, size.height, focus.current, dt);
    });
    return () => off();
  }, [get, focus]);
  return null;
}
