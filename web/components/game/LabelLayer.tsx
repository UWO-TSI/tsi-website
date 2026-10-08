"use client";

/**
 * Runs the world's label layout (lib/game/labelLayout.ts) after each frame is drawn, the camera final: the other
 * players' plates, the landmark tags and whatever else registered with `worldLabels`. It also stands in for your own
 * nameplate (PlayerAvatar draws it with drei), so the others' plates stack clear of it rather than over it.
 */
import { useEffect, type RefObject } from "react";
import { addAfterEffect, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { CHARACTER_HEIGHT } from "./character/Character";
import { LABEL_PRIORITY, worldLabels } from "@/lib/game/labelLayout";

/** Your nameplate's box (the paper tag with "You" and the level tab), CSS px. */
const SELF_PLATE = { w: 104, h: 26 };

export default function LabelLayer({ focus }: { focus: RefObject<THREE.Vector3> }) {
  const get = useThree(s => s.get);
  useEffect(() => {
    // Over your head as PlayerAvatar puts the plate: the character's height and 0.28.
    const self = worldLabels.add({
      priority: LABEL_PRIORITY.self, size: SELF_PLATE, occlude: false,
      anchor: out => { out.copy(focus.current); out.y += CHARACTER_HEIGHT + 0.28; return true; },
      place: () => {},
    });
    let last = -1;
    const off = addAfterEffect(t => {
      const { camera, size } = get();
      const dt = last < 0 ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      worldLabels.solve(camera, size.width, size.height, focus.current, dt);
    });
    return () => { off(); self(); };
  }, [get, focus]);
  return null;
}
