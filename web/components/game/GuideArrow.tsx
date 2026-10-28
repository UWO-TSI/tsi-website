"use client";

/**
 * The guide arrow (lib/game/guideArrow.ts): a faint chevron on the ground a step ahead of you, pointing to the guide on
 * top (Bram when he's far, a quest you picked). It drifts forward and back like a breath and fades out as you get near.
 * One mesh, one draw; nothing drawn while no guide is set.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clearGuide, guideNow, guideView, showGuide } from "@/lib/game/guideArrow";

/** How far ahead of you it sits (m), how far it drifts, how faint it is at full. */
/** David, v2 review: "make arrow smaller slightly closer to you". */
const AHEAD = 1.15, DRIFT = 0.12, OPACITY = 0.5, LIFT = 0.06, SIZE = 0.85;

function chevron() {
  const s = new THREE.Shape();
  // Pointing +z (toward the target), flat on the ground once turned.
  s.moveTo(0, 0.42); s.lineTo(0.42, -0.06); s.lineTo(0.27, -0.2); s.lineTo(0, 0.1); s.lineTo(-0.27, -0.2); s.lineTo(-0.42, -0.06); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.scale(SIZE, SIZE, 1).rotateX(-Math.PI / 2).rotateY(Math.PI);
  return g;
}

const fade = { alpha: 0 };
function step(mesh: THREE.Mesh, mat: THREE.MeshBasicMaterial, p: THREE.Vector3, ground: (x: number, z: number) => number, dt: number, t: number) {
  const g = guideNow(), view = g ? guideView(p, g.at, g.near) : null;
  // Ease in and out rather than pop.
  fade.alpha += ((view?.alpha ?? 0) - fade.alpha) * Math.min(1, dt * 6);
  mesh.visible = fade.alpha > 0.01;
  if (!mesh.visible || !view) return;
  const d = AHEAD + Math.sin(t * 2.4) * DRIFT, x = p.x + Math.sin(view.yaw) * d, z = p.z + Math.cos(view.yaw) * d;
  // The ground ahead (a deck included), kept near your feet so a drop or a wall never throws it.
  mesh.position.set(x, Math.min(p.y + 0.5, Math.max(p.y - 0.5, ground(x, z))) + LIFT, z);
  mesh.rotation.y = view.yaw;
  mat.opacity = OPACITY * fade.alpha;
}

export default function GuideArrow({ player, ground }: { player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number }) {
  const mesh = useRef<THREE.Mesh>(null), mat = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(() => chevron(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  // Dev (evidence scripts): point it somewhere, see where it points.
  useEffect(() => { if (process.env.NODE_ENV !== "production") Object.assign(window, { __guide: { show: showGuide, clear: clearGuide, now: guideNow } }); }, []);
  useFrame((st, dt) => { if (mesh.current && mat.current) step(mesh.current, mat.current, player.current, ground, Math.min(dt, 0.1), st.clock.elapsedTime); });
  return <mesh ref={mesh} geometry={geo} visible={false} renderOrder={2} frustumCulled={false}>
    <meshBasicMaterial ref={mat} color="#fff4d6" transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} fog={false} />
  </mesh>;
}
