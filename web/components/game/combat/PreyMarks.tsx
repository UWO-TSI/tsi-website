"use client";

/**
 * Marked enemies (a mark status: the Hunter's Mark Prey, design sheet "Hunter (LOCKED)": "the mark shows through
 * walls"): a red diamond over each, drawn over everything (no depth test), so a mark behind a pillar or a wall still
 * reads. One small canvas texture, a pool of sprites; nothing allocated per frame.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { combat } from "@/lib/game/combat/runtime";

function diamond(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.translate(32, 32);
  g.lineJoin = "round";
  for (const [w, col] of [[9, "#1d1a24"], [5, "#ff6a5a"]] as const) {
    g.beginPath(); g.moveTo(0, -24); g.lineTo(20, 0); g.lineTo(0, 24); g.lineTo(-20, 0); g.closePath();
    g.lineWidth = w; g.strokeStyle = col; g.stroke();
  }
  g.fillStyle = "#ff6a5a"; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function PreyMarks({ ground, max = 12 }: { ground: (x: number, z: number) => number; max?: number }) {
  const texture = useMemo(() => (typeof document === "undefined" ? null : diamond()), []);
  useEffect(() => () => texture?.dispose(), [texture]);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    let n = 0;
    for (const e of combat.rt.enemies) {
      if (n >= max) break;
      if (e.state === "dead" || e.status.mark <= 0) continue;
      const s = refs.current[n++];
      if (!s) continue;
      s.visible = true;
      s.position.set(e.x, ground(e.x, e.z) + 1.6 + e.type.hover + e.type.radius + Math.sin(clock.elapsedTime * 4 + n) * 0.06, e.z);
      s.material.opacity = Math.min(1, e.status.markFor);
    }
    for (let i = n; i < max; i++) { const s = refs.current[i]; if (s) s.visible = false; }
  });
  if (!texture) return null;
  return <>{Array.from({ length: max }, (_, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[0.55, 0.55, 1]} visible={false} renderOrder={6}>
    <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  </sprite>)}</>;
}
