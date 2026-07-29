"use client";

/**
 * SeasonalProps (2026-07-13) — principle #8 made physical.
 *
 * The admin's seasonal palette already retints sky/fog/grass; now it
 * decorates the village too. The active palette's slug picks a garland
 * set from Events/ (christmas / harvest / carnival strings with their
 * end posts), strung at the plaza entrances. Default palette = no props.
 * A monthly content drop is now: admin activates a palette — done, no
 * code.
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useActivePalette } from "@/lib/content/loader";

const SETS: { match: RegExp; url: string; tint: string }[] = [
  { match: /winter|frost|christmas|holiday|snow/i, url: "/assets/acnh/seasonal/christmas-garland.glb", tint: "#2E6B3E" },
  { match: /autumn|harvest|fall|halloween/i, url: "/assets/acnh/seasonal/harvest-garland-n.glb", tint: "#C77B3A" },
  { match: /carnival|festival|spring|fair/i, url: "/assets/acnh/seasonal/carnival-garland.glb", tint: "#C94F8E" },
];

// Garland strings (posts included in the models) at the plaza entrances.
const SPOTS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [0, 0, -9.2], rotY: 0 },      // plaza north edge, across the spine
  { pos: [0, 0, -17], rotY: 0 },       // plaza south edge
];

function Garland({ url, tint, pos, rotY }: { url: string; tint: string; pos: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    // garland foliage/rope parts ship untextured (render near-black) —
    // tint them per set so the strings read festive, not charred.
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!mat.map) {
          const cl = mat.clone();
          cl.color = new THREE.Color(tint);
          m.material = cl;
        }
      }
    });
    c.scale.setScalar(0.1);
    c.position.set(pos[0], pos[1], pos[2]);
    c.rotation.y = rotY;
    return c;
  }, [scene, tint, pos, rotY]);
  return <primitive object={clone} />;
}

export default function SeasonalProps() {
  const { data: palette } = useActivePalette();
  const slug = palette?.slug ?? "";
  const set = SETS.find((s) => s.match.test(slug));
  if (!set) return null;
  return (
    <Suspense fallback={null}>
      {SPOTS.map((sp, i) => (
        <Garland key={i} url={set.url} tint={set.tint} pos={sp.pos} rotY={sp.rotY} />
      ))}
    </Suspense>
  );
}
