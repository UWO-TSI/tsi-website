"use client";

/**
 * The shop's greybox (specs/interiors/shop.md, phase 1): the layout in matte, untextured blocks for David's review,
 * every number from lib/game/shopLayout.ts. Fixtures in their material's flat tone (concrete, metal, pegboard, tile,
 * timber), each displayed item as a block in its kind's colour, the edge lights and the linear pendant as plain bright
 * strips, and the walking path taped on the floor. Phase 2 puts the models on the same numbers.
 */
import { useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import * as layout from "@/lib/game/shopLayout";
import {
  SHOP_DOOR, SHOP_FIXTURES, SHOP_FLOORS, SHOP_PATHS, SHOP_PENDANT, SHOP_ROOM, SHOP_SLOTS, SHOP_STRIPS, SHOP_WINDOW,
  type Finish, type ItemKind,
} from "@/lib/game/shopLayout";

export const FINISH_TONE: Record<Finish, string> = {
  concrete: "#b9b5ae", metal: "#8e959c", pegboard: "#c8cacb", tile: "#9dbcae", timber: "#b38a5d",
  fabric: "#f1eee7", crate: "#e8e8e4", plant: "#6e8e60", sign: "#3b4048",
};
/** Each kind of displayed item's placeholder colour (the plan's legend): in-game kinds each their own, merch all cobalt. */
export const KIND_TONE: Record<ItemKind, string> = {
  seasonal: "#e2873a", clothes: "#2fa39e", accessories: "#86cfc8", tools: "#68a85a", dyes: "#d3639a", furniture: "#c99a4c",
  "merch-wear": "#2f55d4", "merch-bags": "#2f55d4", "merch-small": "#2f55d4", "merch-prints": "#2f55d4", "merch-featured": "#2f55d4",
};
const FLOOR_TONE: Record<(typeof SHOP_FLOORS)[number]["id"], string> = { oak: "#caa67c", concrete: "#a7a6a2" };
const WALL_TONE = "#e3e0da";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const MATTE = new Map<string, THREE.MeshStandardMaterial>();
const matte = (hex: string) => {
  let m = MATTE.get(hex);
  if (!m) MATTE.set(hex, (m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1, metalness: 0 })));
  return m;
};
const GLOW = new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false });
const TAPE = new THREE.MeshBasicMaterial({ color: "#f2c94c" });
const GLASS = new THREE.MeshBasicMaterial({ color: "#d4e6ef" });

type V3 = [number, number, number];
/** A block standing on `at` (the centre of its base). */
function Block({ at, size, material }: { at: V3; size: V3; material: THREE.Material }) {
  return <mesh geometry={BOX} material={material} position={[at[0], at[1] + size[1] / 2, at[2]]} scale={size} castShadow receiveShadow />;
}

/** An axis-aligned bar from one point to another (a light strip, a path segment). */
function Bar({ from, to, thick, material }: { from: V3; to: V3; thick: [number, number]; material: THREE.Material }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const size: V3 = Math.abs(to[0] - from[0]) >= Math.abs(to[2] - from[2]) ? [len + thick[1], thick[0], thick[1]] : [thick[1], thick[0], len + thick[1]];
  return <mesh geometry={BOX} material={material} position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} scale={size} />;
}

const walk = (e: ThreeEvent<MouseEvent>) => {
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
  AudioManager.playSFX("click");
};

export default function ShopGreybox() {
  // The layout's numbers, for the evidence script's labels (dev only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __shopLayout: layout });
    return () => { delete (window as { __shopLayout?: unknown }).__shopLayout; };
  }, []);
  const { halfW: W, halfD: D, height: H, wall: T, lip } = SHOP_ROOM;
  const wall = matte(WALL_TONE);
  const w = SHOP_WINDOW;
  return <group>
    {/* Floors: herringbone oak and polished concrete (flat tones); a click walks you there. */}
    {SHOP_FLOORS.map(f => <mesh key={f.id} rotation={[-Math.PI / 2, 0, 0]} position={[(f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2]} receiveShadow onClick={walk}
      material={matte(FLOOR_TONE[f.id])}><planeGeometry args={[f.x1 - f.x0, f.z1 - f.z0]} /></mesh>)}

    {/* Walls: the back, the −x side, the +x side round its window, and the cut-away near wall's lip either side of the door. */}
    <Block at={[0, 0, D + T / 2]} size={[2 * W + 2 * T, H, T]} material={wall} />
    <Block at={[-W - T / 2, 0, 0]} size={[T, H, 2 * D + 2 * T]} material={wall} />
    <Block at={[W + T / 2, 0, (-D - T + w.z0) / 2]} size={[T, H, w.z0 + D + T]} material={wall} />
    <Block at={[W + T / 2, 0, (w.z0 + w.z1) / 2]} size={[T, w.y0, w.z1 - w.z0]} material={wall} />
    <Block at={[W + T / 2, w.y1, (w.z0 + w.z1) / 2]} size={[T, H - w.y1, w.z1 - w.z0]} material={wall} />
    <Block at={[W + T / 2, 0, (w.z1 + D + T) / 2]} size={[T, H, D + T - w.z1]} material={wall} />
    <Block at={[W + T / 2, w.y0, (w.z0 + w.z1) / 2]} size={[0.04, w.y1 - w.y0, w.z1 - w.z0]} material={GLASS} />
    {[[-W - T, SHOP_DOOR.x - SHOP_DOOR.half], [SHOP_DOOR.x + SHOP_DOOR.half, W + T]].map(([x0, x1]) =>
      <Block key={x0} at={[(x0 + x1) / 2, 0, -D - T / 2]} size={[x1 - x0, lip, T]} material={wall} />)}

    {/* Fixtures, in their finishes' flat tones. */}
    {SHOP_FIXTURES.flatMap(f => f.blocks.map((b, i) => <Block key={`${f.id}-${i}`} at={b.at} size={b.size} material={matte(FINISH_TONE[b.finish])} />))}

    {/* What's displayed: one block per item, in its kind's colour. */}
    {SHOP_SLOTS.map(s => <Block key={s.id} at={s.at} size={s.size} material={matte(KIND_TONE[s.kind])} />)}

    {/* The edge lights, and the linear pendant over the counter on its two wires. */}
    {SHOP_STRIPS.map((s, i) => <Bar key={i} from={s.from} to={s.to} thick={[0.025, 0.04]} material={GLOW} />)}
    <Block at={[(SHOP_PENDANT.x0 + SHOP_PENDANT.x1) / 2, SHOP_PENDANT.y, SHOP_PENDANT.z]} size={[SHOP_PENDANT.x1 - SHOP_PENDANT.x0, 0.05, 0.09]} material={matte("#3d4249")} />
    <Bar from={[SHOP_PENDANT.x0 + 0.04, SHOP_PENDANT.y - 0.006, SHOP_PENDANT.z]} to={[SHOP_PENDANT.x1 - 0.04, SHOP_PENDANT.y - 0.006, SHOP_PENDANT.z]} thick={[0.012, 0.06]} material={GLOW} />
    {SHOP_PENDANT.wires.map(x => <Block key={x} at={[x, SHOP_PENDANT.y + 0.05, SHOP_PENDANT.z]} size={[0.012, H - SHOP_PENDANT.y - 0.05, 0.012]} material={matte("#2c3036")} />)}

    {/* The walking path, taped on the floor. */}
    {SHOP_PATHS.flatMap(p => p.points.slice(1).map((q, k) => <Bar key={`${p.id}-${k}`} from={[p.points[k][0], 0.004, p.points[k][1]]} to={[q[0], 0.004, q[1]]} thick={[0.004, 0.07]} material={TAPE} />))}
  </group>;
}
