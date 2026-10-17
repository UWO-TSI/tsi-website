"use client";

/**
 * The shop's greybox (specs/interiors/shop.md, phase 1): the layout in matte, untextured blocks for David's review,
 * every number from lib/game/shopLayout.ts. Two floors: the ground floor always, the mezzanine over the back (on its
 * slab, open over the stair) while the walker says it shows: from the door, not once you're under it. Fixtures in their
 * material's flat tone (concrete, metal, pegboard, tile, timber), each displayed item as a block in its kind's colour,
 * the edge lights and the linear pendant as plain bright strips, and the walking path taped on the floor. Phase 2 puts
 * the models on the same numbers.
 */
import { useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import * as layout from "@/lib/game/shopLayout";
import {
  SHOP_DOOR, SHOP_FIXTURES, SHOP_FLOOR_HEIGHT, SHOP_MEZZ, SHOP_PATHS, SHOP_PENDANT, SHOP_ROOM, SHOP_SLAB, SHOP_SLOTS, SHOP_STAIR, SHOP_STRIPS, SHOP_WINDOWS,
  type Finish, type ItemKind, type Level, type ShopWalker,
} from "@/lib/game/shopLayout";

export const FINISH_TONE: Record<Finish, string> = {
  concrete: "#b9b5ae", metal: "#8e959c", pegboard: "#bcc0c3", tile: "#9dbcae", timber: "#b38a5d",
  fabric: "#f1eee7", crate: "#e8e8e4", plant: "#6e8e60", sign: "#3b4048", glass: "#cddfe5",
};
/** Each kind of displayed item's placeholder colour (the plan's legend): in-game kinds each their own, merch all cobalt. */
export const KIND_TONE: Record<ItemKind, string> = {
  seasonal: "#e2873a", clothes: "#2fa39e", accessories: "#86cfc8", tools: "#68a85a", dyes: "#d3639a", furniture: "#c99a4c", finishes: "#9b7fd0",
  "merch-wear": "#2f55d4", "merch-bags": "#2f55d4", "merch-small": "#2f55d4", "merch-prints": "#2f55d4", "merch-featured": "#2f55d4",
};
const FLOOR_TONE: Record<Level, string> = { 0: "#caa67c", 1: "#a7a6a2" };
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
/** The railings' and the mirror's glass: see-through, so the merch shows from below. */
const SEE_THROUGH = new THREE.MeshStandardMaterial({ color: "#cfe4ec", roughness: 0.2, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });

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

const { halfW: W, halfD: D, wall: T, lip } = SHOP_ROOM;
const F = SHOP_FLOOR_HEIGHT, S = SHOP_STAIR;

/** One storey of the shell: its walls (the +x wall round its window), and downstairs the cut-away near wall's lip either side of the door. */
function Walls({ level }: { level: Level }) {
  const wall = matte(WALL_TONE), w = SHOP_WINDOWS[level];
  const lips = level === 0 ? [[-W - T, SHOP_DOOR.x - SHOP_DOOR.half], [SHOP_DOOR.x + SHOP_DOOR.half, W + T]] : [];
  return <>
    <Block at={[0, 0, D + T / 2]} size={[2 * W + 2 * T, F, T]} material={wall} />
    <Block at={[-W - T / 2, 0, 0]} size={[T, F, 2 * D + 2 * T]} material={wall} />
    <Block at={[W + T / 2, 0, (-D - T + w.z0) / 2]} size={[T, F, w.z0 + D + T]} material={wall} />
    <Block at={[W + T / 2, 0, (w.z0 + w.z1) / 2]} size={[T, w.y0, w.z1 - w.z0]} material={wall} />
    <Block at={[W + T / 2, w.y1, (w.z0 + w.z1) / 2]} size={[T, F - w.y1, w.z1 - w.z0]} material={wall} />
    <Block at={[W + T / 2, 0, (w.z1 + D + T) / 2]} size={[T, F, D + T - w.z1]} material={wall} />
    <Block at={[W + T / 2, w.y0, (w.z0 + w.z1) / 2]} size={[0.04, w.y1 - w.y0, w.z1 - w.z0]} material={GLASS} />
    {lips.map(([x0, x1]) => <Block key={x0} at={[(x0 + x1) / 2, 0, -D - T / 2]} size={[x1 - x0, lip, T]} material={wall} />)}
  </>;
}

/** What stands on one floor: fixtures, displayed items, edge lights and the taped path (`except`: fixtures modelled already; `paths` off for the furnished room). */
export function Contents({ level, except = [], paths = true }: { level: Level; except?: readonly string[]; paths?: boolean }) {
  return <>
    {SHOP_FIXTURES.filter(f => f.level === level && !except.includes(f.id)).flatMap(f => f.blocks.map((b, i) => <Block key={`${f.id}-${i}`} at={b.at} size={b.size} material={b.finish === "glass" ? SEE_THROUGH : matte(FINISH_TONE[b.finish])} />))}
    {SHOP_SLOTS.filter(s => s.level === level).map(s => <Block key={s.id} at={s.at} size={s.size} material={matte(KIND_TONE[s.kind])} />)}
    {SHOP_STRIPS.filter(s => s.level === level && !except.includes(s.fixture)).map((s, i) => <Bar key={i} from={s.from} to={s.to} thick={[0.025, 0.04]} material={GLOW} />)}
    {paths && SHOP_PATHS.filter(p => p.level === level).flatMap(p => p.points.slice(1).map((q, k) =>
      <Bar key={`${p.id}-${k}`} from={[p.points[k][0], 0.004, p.points[k][1]]} to={[q[0], 0.004, q[1]]} thick={[0.004, 0.07]} material={TAPE} />))}
  </>;
}

export default function ShopGreybox({ walker }: { walker: ShopWalker }) {
  // The layout's numbers and the walker, for the evidence script's labels and routes (dev only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __shopLayout: layout, __shopWalker: walker });
    return () => { delete (window as { __shopLayout?: unknown }).__shopLayout; delete (window as { __shopWalker?: unknown }).__shopWalker; };
  }, [walker]);
  const upper = useRef<THREE.Group>(null);
  useFrame(() => { if (upper.current) upper.current.visible = walker.upperShown; });
  const concrete = matte(FLOOR_TONE[1]);
  // The handrail up the flight's open side, from the first step to the landing.
  const rail0: V3 = [S.x1 - 0.04, F / S.steps + 0.95, S.z0 + 0.15], rail1: V3 = [S.x1 - 0.04, F + 0.95, S.z1 - 0.15];
  const railLen = Math.hypot(rail1[1] - rail0[1], rail1[2] - rail0[2]);
  return <group>
    {/* ── Ground floor: herringbone oak (a flat tone); a click walks you there. ── */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={walk} material={matte(FLOOR_TONE[0])}><planeGeometry args={[2 * W, 2 * D]} /></mesh>
    <Walls level={0} />
    <Contents level={0} />
    <mesh geometry={BOX} material={matte(FINISH_TONE.metal)} position={[(rail0[0] + rail1[0]) / 2, (rail0[1] + rail1[1]) / 2, (rail0[2] + rail1[2]) / 2]}
      rotation={[-Math.atan2(rail1[1] - rail0[1], rail1[2] - rail0[2]), 0, 0]} scale={[0.05, 0.05, railLen]} />
    {/* The linear pendant over the counter, on its two wires. */}
    <Block at={[(SHOP_PENDANT.x0 + SHOP_PENDANT.x1) / 2, SHOP_PENDANT.y, SHOP_PENDANT.z]} size={[SHOP_PENDANT.x1 - SHOP_PENDANT.x0, 0.05, 0.09]} material={matte("#3d4249")} />
    <Bar from={[SHOP_PENDANT.x0 + 0.04, SHOP_PENDANT.y - 0.006, SHOP_PENDANT.z]} to={[SHOP_PENDANT.x1 - 0.04, SHOP_PENDANT.y - 0.006, SHOP_PENDANT.z]} thick={[0.012, 0.06]} material={GLOW} />
    {SHOP_PENDANT.wires.map(x => <Block key={x} at={[x, SHOP_PENDANT.y + 0.05, SHOP_PENDANT.z]} size={[0.012, F - SHOP_SLAB - SHOP_PENDANT.y - 0.05, 0.012]} material={matte("#2c3036")} />)}

    {/* ── The mezzanine over the back, open over the stair, polished concrete, and the upper storey of the walls; shown while the walker says so. ── */}
    <group ref={upper} position={[0, F, 0]}>
      {([[S.x1, W, SHOP_MEZZ.z0, D], [-W, S.x1, S.z1, D]] as const).map(([x0, x1, z0, z1]) =>
        <mesh key={`${x0},${z0}`} geometry={BOX} material={concrete} position={[(x0 + x1) / 2, -SHOP_SLAB / 2, (z0 + z1) / 2]} scale={[x1 - x0, SHOP_SLAB, z1 - z0]}
          receiveShadow castShadow onClick={walk} />)}
      <Walls level={1} />
      <Contents level={1} />
    </group>
  </group>;
}
