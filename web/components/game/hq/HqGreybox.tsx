"use client";

/**
 * HQ's greybox (specs/interiors/hq.md, phase 1): an option's layout in matte, untextured blocks for David's review,
 * every number from lib/game/hqLayout.ts. The ground floor always; the upper floor (each part on its slab, open over
 * the stair) while the walker says that part shows: from the hall, not once you're under it. Fixtures in their
 * material's flat tone (walnut, velvet, leather, green marble, concrete), the aquarium as a two-storey block of its
 * water's blue, the yearly banners blank, the lamps and the oval ceiling's light as plain bright shapes, the walking
 * path taped on the floor. Phase 2 puts the models on the same numbers.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import * as layout from "@/lib/game/hqLayout";
import { HQ_DOOR, HQ_FLOOR_HEIGHT, HQ_ROOM, HQ_SLAB, type Finish, type HqOption, type HqWalker, type Level, type Rect } from "@/lib/game/hqLayout";

export const FINISH_TONE: Record<Finish, string> = {
  walnut: "#7a4f31", concrete: "#a9a59f", leather: "#2b2724", velvet: "#7b5236", marble: "#2f6e57", carpet: "#264a86", shag: "#eee6d6",
  books: "#c7a77a", stone: "#d9d0bf", metal: "#9aa0a6", plant: "#4e7a46", glass: "#cfe4ec", banner: "#f1ead9", door: "#3a2a20",
  plaque: "#e8dcc0", lamp: "#fff1cf", water: "#2fb3d6", cork: "#b98d5c", screen: "#1b1e22", person: "#6b5aa8", beanbag: "#b07a52",
};
const FLOOR_TONE: Record<Level, string> = { 0: "#8d847a", 1: "#8a6b4f" };
const WALL_TONE = "#d8d2c8";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const MATTE = new Map<string, THREE.Material>();
const matte = (hex: string) => {
  let m = MATTE.get(hex);
  if (!m) MATTE.set(hex, (m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1, metalness: 0 })));
  return m;
};
const GLOW = new THREE.MeshBasicMaterial({ color: "#fff1cf", toneMapped: false });
const WATER = new THREE.MeshBasicMaterial({ color: "#36b8dc", toneMapped: false });
const TAPE = new THREE.MeshBasicMaterial({ color: "#f2c94c" });
const SEE_THROUGH = new THREE.MeshStandardMaterial({ color: "#cfe4ec", roughness: 0.2, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });
/** Seen from below only: the oval ceiling (from the walking camera above it, it's not there). */
const CEILING = new THREE.MeshStandardMaterial({ color: FINISH_TONE.walnut, roughness: 1, side: THREE.FrontSide });
const OVAL = new THREE.MeshBasicMaterial({ color: "#fff3d8", toneMapped: false, side: THREE.FrontSide });
const finishMaterial = (f: Finish) => f === "glass" ? SEE_THROUGH : f === "lamp" ? GLOW : f === "water" ? WATER : matte(FINISH_TONE[f]);

type V3 = [number, number, number];
function Block({ at, size, material, onClick }: { at: V3; size: V3; material: THREE.Material; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  return <mesh geometry={BOX} material={material} position={[at[0], at[1] + size[1] / 2, at[2]]} scale={size} castShadow receiveShadow onClick={onClick} />;
}
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

const { halfW: W, halfD: D, wall: T, lip } = HQ_ROOM;
const F = HQ_FLOOR_HEIGHT;

/** A rect less another (the stairwell out of the slab): up to four rects. */
function minus(r: Rect, h: Rect): Rect[] {
  if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) return [r];
  const out: Rect[] = [];
  if (h.z0 > r.z0) out.push({ ...r, z1: h.z0 });
  if (h.z1 < r.z1) out.push({ ...r, z0: h.z1 });
  const z0 = Math.max(r.z0, h.z0), z1 = Math.min(r.z1, h.z1);
  if (h.x0 > r.x0) out.push({ x0: r.x0, x1: h.x0, z0, z1 });
  if (h.x1 < r.x1) out.push({ x0: h.x1, x1: r.x1, z0, z1 });
  return out;
}
/** The upper part a level-1 fixture belongs to: its own, or the one under its first block. */
function partOf(o: HqOption, f: layout.Fixture): number {
  if (f.part !== undefined) return f.part;
  const [x, , z] = f.blocks[0].at;
  const i = o.upper.findIndex(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  return i < 0 ? 0 : i;
}

/** The room's walls, two storeys high: the back and the sides whole, the front a lip either side of the door (cut away for the camera). */
function Walls() {
  const wall = matte(WALL_TONE);
  return <>
    <Block at={[0, 0, D + T / 2]} size={[2 * W + 2 * T, 2 * F, T]} material={wall} />
    <Block at={[-W - T / 2, 0, 0]} size={[T, 2 * F, 2 * D + 2 * T]} material={wall} />
    <Block at={[W + T / 2, 0, 0]} size={[T, 2 * F, 2 * D + 2 * T]} material={wall} />
    {[[-W - T, HQ_DOOR.x - HQ_DOOR.half], [HQ_DOOR.x + HQ_DOOR.half, W + T]].map(([x0, x1]) =>
      <Block key={x0} at={[(x0 + x1) / 2, 0, -D - T / 2]} size={[x1 - x0, lip, T]} material={wall} />)}
  </>;
}

/** One floor's fixtures (and upstairs, one part's), and its taped path. */
function Fixtures({ o, level, part }: { o: HqOption; level: Level; part?: number }) {
  const list = o.fixtures.filter(f => f.level === level && (part === undefined || partOf(o, f) === part));
  return <>{list.flatMap(f => f.blocks.map((b, i) => <Block key={`${f.id}-${i}`} at={b.at} size={b.size} material={finishMaterial(b.finish)} />))}</>;
}
function Paths({ o, level, part }: { o: HqOption; level: Level; part?: number }) {
  const inPart = (q: [number, number]) => part === undefined || (() => { const r = o.upper[part]; return q[0] >= r.x0 && q[0] <= r.x1 && q[1] >= r.z0 && q[1] <= r.z1; })();
  return <>{o.paths.filter(p => p.level === level).flatMap(p => p.points.slice(1).map((q, k) => {
    const a = p.points[k];
    if (part !== undefined && !(inPart(a) && inPart(q))) return null;
    return <Bar key={`${p.id}-${k}`} from={[a[0], 0.006, a[1]]} to={[q[0], 0.006, q[1]]} thick={[0.004, 0.07]} material={TAPE} />;
  }))}</>;
}

/** The flight: its steps (solid to the floor) along the lane, and a handrail up its open side. */
function Stair({ o }: { o: HqOption }) {
  const s = o.stair, n = s.steps, run = (s.head - s.foot) / n, rise = F / n, x = (s.x0 + s.x1) / 2, w = s.x1 - s.x0;
  const metal = matte(FINISH_TONE.metal), concrete = matte(FINISH_TONE.concrete);
  const r0: V3 = [s.x1 - 0.04, rise + 0.95, s.foot + run * 0.5], r1: V3 = [s.x1 - 0.04, F + 0.95, s.head - run * 0.5];
  const len = Math.hypot(r1[1] - r0[1], r1[2] - r0[2]);
  return <>
    {Array.from({ length: n }, (_, i) => <Block key={i} at={[x, 0, s.foot + run * (i + 0.5)]} size={[w, rise * (i + 1), Math.abs(run)]} material={concrete} />)}
    <mesh geometry={BOX} material={metal} position={[(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2, (r0[2] + r1[2]) / 2]}
      rotation={[-Math.atan2(r1[1] - r0[1], r1[2] - r0[2]), 0, 0]} scale={[0.05, 0.05, len]} />
  </>;
}

/** The aquarium: a two-storey block of bright water behind its glass, in a dark frame, a warm strip along its base. */
function Aquarium({ o }: { o: HqOption }) {
  const a = o.aquarium, frame = matte("#26282b");
  const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, sx = a.x1 - a.x0, sz = a.z1 - a.z0;
  const face = a.facing === "-x" ? { at: [a.x0 - 0.02, 0, cz] as V3, size: [0.04, 0.22, sz] as V3 } : { at: [cx, 0, a.z0 - 0.02] as V3, size: [sx, 0.22, 0.04] as V3 };
  return <>
    <Block at={[cx, 0, cz]} size={[sx, a.y0, sz]} material={frame} />
    <Block at={[cx, a.y0, cz]} size={[sx - 0.08, a.y1 - a.y0, sz - 0.08]} material={WATER} />
    <Block at={[cx, a.y1, cz]} size={[sx, 2 * F - a.y1, sz]} material={frame} />
    <Block at={[face.at[0], a.y0 - 0.12, face.at[2]]} size={[face.size[0], 0.05, face.size[2]]} material={GLOW} />
  </>;
}

/** The walnut ceiling over the upper lounge with its oval cut-outs (seen from below only): a 3 x 2 grid of light. */
function OvalCeiling({ r }: { r: Rect }) {
  const y = F - 0.18, w = r.x1 - r.x0, d = r.z1 - r.z0;
  const ovals = useMemo(() => {
    const g = new THREE.CircleGeometry(0.5, 28);
    return g;
  }, []);
  useEffect(() => () => ovals.dispose(), [ovals]);
  const cols = 3, rows = 2;
  return <group>
    <mesh position={[(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={CEILING}><planeGeometry args={[w, d]} /></mesh>
    {Array.from({ length: cols * rows }, (_, i) => {
      const cx = r.x0 + w * ((i % cols) + 0.5) / cols, cz = r.z0 + d * (Math.floor(i / cols) + 0.5) / rows;
      return <mesh key={i} geometry={ovals} material={OVAL} position={[cx, y - 0.01, cz]} rotation={[Math.PI / 2, 0, 0]} scale={[w / cols * 0.8, d / rows * 0.7, 1]} />;
    })}
  </group>;
}

export default function HqGreybox({ o, walker }: { o: HqOption; walker: HqWalker }) {
  // The layout's numbers and the walker, for the evidence script's labels and routes (dev only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __hqLayout: { ...layout, option: o, zones: layout.zoneLabels(o) }, __hqWalker: walker });
    return () => { delete (window as { __hqLayout?: unknown }).__hqLayout; delete (window as { __hqWalker?: unknown }).__hqWalker; };
  }, [o, walker]);
  const parts = useRef<(THREE.Group | null)[]>([]);
  // The evidence script's ground-floor plan hides the upper floor outright (dev: window.__hqHideUpper).
  useFrame(() => {
    const hide = process.env.NODE_ENV !== "production" && (window as { __hqHideUpper?: boolean }).__hqHideUpper;
    parts.current.forEach((g, i) => { if (g) g.visible = !hide && (walker.shown[i] ?? true); });
  });
  const well: Rect = { x0: o.stair.x0, x1: o.stair.x1, z0: Math.min(o.stair.foot, o.stair.head), z1: Math.max(o.stair.foot, o.stair.head) };
  const slab = matte(FLOOR_TONE[1]);
  return <group>
    {/* ── Ground floor: a flat tone; a click walks you there. ── */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={walk} material={matte(FLOOR_TONE[0])}><planeGeometry args={[2 * W, 2 * D]} /></mesh>
    <Walls />
    <Fixtures o={o} level={0} />
    <Paths o={o} level={0} />
    <Stair o={o} />
    <Aquarium o={o} />

    {/* ── The upper floor, part by part (each cut away while you're under it), on its slab, open over the stair. ── */}
    {o.upper.map((r, i) => <group key={i} ref={g => { parts.current[i] = g; }} position={[0, F, 0]}>
      {minus(r, well).map((q, k) => <mesh key={k} geometry={BOX} material={slab} position={[(q.x0 + q.x1) / 2, -HQ_SLAB / 2, (q.z0 + q.z1) / 2]}
        scale={[q.x1 - q.x0, HQ_SLAB, q.z1 - q.z0]} receiveShadow castShadow onClick={walk} />)}
      <Fixtures o={o} level={1} part={i} />
      <Paths o={o} level={1} part={i} />
      {/* its rails: the glass along each open edge that lies on this part */}
      {o.rails.filter(rl => {
        const [ax, az] = rl.from, [bx, bz] = rl.to, mx = (ax + bx) / 2, mz = (az + bz) / 2;
        return mx >= r.x0 - 0.01 && mx <= r.x1 + 0.01 && mz >= r.z0 - 0.01 && mz <= r.z1 + 0.01;
      }).map((rl, k) => <group key={k}>
        <Bar from={[rl.from[0], 0.5, rl.from[1]]} to={[rl.to[0], 0.5, rl.to[1]]} thick={[1.0, 0.04]} material={SEE_THROUGH} />
        <Bar from={[rl.from[0], 1.02, rl.from[1]]} to={[rl.to[0], 1.02, rl.to[1]]} thick={[0.05, 0.06]} material={matte(FINISH_TONE.walnut)} />
      </group>)}
      {o.upper.length === 1 || (o.ovalCeiling.x0 >= r.x0 - 0.01 && o.ovalCeiling.x1 <= r.x1 + 0.01 && o.ovalCeiling.z0 >= r.z0 - 0.01 && o.ovalCeiling.z1 <= r.z1 + 0.01)
        ? <OvalCeiling r={o.ovalCeiling} /> : null}
    </group>)}
  </group>;
}
