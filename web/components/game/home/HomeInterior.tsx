"use client";

/**
 * House interior (specs/homes.md §2–4) on the shared interior kit
 * (interiorShared: backdrop, walker, camera). Rooms are 6×6 cells laid side
 * by side toward screen-right (−x), joined by a door gap. Wallpaper and
 * flooring are ACNH dump RoomTex albedos; furniture uses the placement layer.
 */
import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { InteriorPlayer, applyInteriorBackdrop, nearestStation, type InteriorStation, type RoomBounds } from "../interiorShared";
import { PlacementLayer, type GridMapping } from "./PlacementLayer";
import { CLUBHOUSE_LIGHTING } from "@/lib/game/islandLighting";
import type { IslandPhase } from "@/lib/game/islandTime";
import { catalogueItem } from "@/lib/homes/catalogue";
import {
  FLOORINGS, MAX_ROOMS, ROOM_SIZE, WALLPAPERS, cellsOf, footprint, roomInside, roomWallLength, snapToWall,
  type HomeLayoutDoc, type PlacedItem, type Rotation, type Wall,
} from "@/lib/homes/layout";

const [RW, RD] = ROOM_SIZE;
const WALL_H = 3.2;
const I = "/assets/acnh/interior/";
[...WALLPAPERS.map(w => `${I}wall-${w}.png`), ...FLOORINGS.map(f => `${I}floor-${f}.png`)].forEach(url => useTexture.preload(url));

export type HouseNear = "exit" | "buy" | "closet" | "bed" | null;
/** World x of room i's screen-left edge (rooms centred on x = 0). */
export const roomLeft = (i: number, n: number) => (RW * n) / 2 - RW * i;
/** World x/z of a placed floor item's centre in room i of n. */
function itemCentre(i: number, n: number, item: PlacedItem): [number, number] {
  const cells = cellsOf(item), cx = cells.reduce((a, c) => a + c[0], 0) / cells.length, cz = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  return [roomLeft(i, n) - cx - 0.5, -RD / 2 + cz + 0.5];
}
/** home-bed's comforter top at scale 0.1, measured from the GLB. */
const BED_TOP = 0.58;
/**
 * `tsi:sit` Sleep spots: each bed's middle, head toward its pillow end (model −x, turned with the bed).
 * Sleep lies with the head toward −z at yaw 0, so a quarter turn lines it up with an unturned bed.
 */
const beds = (layout: HomeLayoutDoc) => layout.rooms.flatMap((room, i) => room.items.filter(item => item.piece === "home-bed").map(item => {
  const [x, z] = itemCentre(i, layout.rooms.length, item);
  return { x, z, clip: "Sleep" as const, seatY: BED_TOP, yaw: Math.PI / 2 + item.rot * Math.PI / 2 };
}));
export const nearestBed = (layout: HomeLayoutDoc, x: number, z: number) =>
  beds(layout).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] ?? null;
/** Which room a world x falls in. */
export function roomAt(x: number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor((roomLeft(0, n) - x) / RW)));
}

function useRoomTexture(url: string, repeat: [number, number]) {
  const source = useTexture(url);
  const tex = useMemo(() => {
    const t = source.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    return t;
  }, [source, repeat]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const FLOOR_REPEAT: [number, number] = [2, 2];
const WALL_REPEAT: [number, number] = [3, 1];
function RoomShell({ index, count, wallpaper, flooring }: { index: number; count: number; wallpaper: string; flooring: string }) {
  const floor = useRoomTexture(`${I}floor-${flooring}.png`, FLOOR_REPEAT);
  const wall = useRoomTexture(`${I}wall-${wallpaper}.png`, WALL_REPEAT);
  const left = roomLeft(index, count), cx = left - RW / 2;
  const sideWall = (x: number, gap: boolean) => gap
    // Divider between rooms: a thick wall with a 2-cell doorway in the middle.
    ? [[-RD / 2 + 1, 2], [RD / 2 - 1, 2]].map(([z, len]) => <mesh key={z} position={[x, WALL_H / 2, z]}>
        <boxGeometry args={[0.24, WALL_H, len]} /><meshStandardMaterial color="#e9dfcb" roughness={0.95} /></mesh>)
    : <mesh position={[x, WALL_H / 2, 0]} rotation={[0, x > cx ? -Math.PI / 2 : Math.PI / 2, 0]}>
        <planeGeometry args={[RD, WALL_H]} /><meshStandardMaterial map={wall} roughness={0.95} /></mesh>;
  return <group>
    <mesh position={[cx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[RW, RD]} /><meshStandardMaterial map={floor} roughness={0.9} /></mesh>
    <mesh position={[cx, WALL_H / 2, RD / 2]} rotation={[0, Math.PI, 0]}><planeGeometry args={[RW, WALL_H]} /><meshStandardMaterial map={wall} roughness={0.95} /></mesh>
    {/* Screen-left wall on the first room; shared walls get a door gap; screen-right wall closes the last room. */}
    {index === 0 && sideWall(left, false)}
    {sideWall(left - RW, index < count - 1)}
    <mesh position={[cx, 0.06, RD / 2 - 0.02]}><boxGeometry args={[RW, 0.12, 0.04]} /><meshStandardMaterial color="#8a6a4a" roughness={0.9} /></mesh>
  </group>;
}

export default function HomeInterior({ layout, phase, frozen, player, onNear, decorating, selected, onPlace, onPickUp }: {
  layout: HomeLayoutDoc; phase: IslandPhase; frozen: boolean; player: React.RefObject<THREE.Vector3>;
  onNear: (near: HouseNear) => void; decorating: boolean; selected: { piece: string; rot: Rotation; uid?: string } | null;
  onPlace: (room: number, item: PlacedItem) => void; onPickUp: (room: number, item: PlacedItem) => void;
}) {
  const n = layout.rooms.length;
  const light = CLUBHOUSE_LIGHTING[phase];
  const { scene, camera } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  const spawnX = roomLeft(0, n) - RW / 2;
  const bounds: RoomBounds = useMemo(() => ({ halfW: (RW * n) / 2, halfD: RD / 2, spawn: [spawnX, -1.6] }), [n, spawnX]);
  useEffect(() => { player.current.set(spawnX, 0, -1.6); camera.position.set(spawnX, 8.4, -8.8); }, [camera, player, spawnX]);
  // Solid furniture plus the walls between rooms (door gap |z| < 1).
  const blocked = useMemo(() => layout.rooms.flatMap((room, i) => room.items
    .filter(item => catalogueItem(item.piece)?.mount === "floor")
    .flatMap(cellsOf).map(([cx, cz]) => ({ x: roomLeft(i, n) - cx - 0.5, z: -RD / 2 + cz + 0.5 }))), [layout, n]);
  const constrainMove = useMemo(() => {
    const dividers = Array.from({ length: n - 1 }, (_, i) => roomLeft(i + 1, n));
    const free = (x: number, z: number) => !blocked.some(b => Math.abs(b.x - x) < 0.75 && Math.abs(b.z - z) < 0.75)
      && !dividers.some(d => Math.abs(x - d) < 0.4 && Math.abs(z) > 0.75);
    return (x: number, z: number, nx: number, nz: number): [number, number] => {
      // Getting out of bed: from inside furniture any step is allowed.
      if (free(nx, nz) || !free(x, z)) return [nx, nz];
      if (free(nx, z)) return [nx, z];
      if (free(x, nz)) return [x, nz];
      return [x, z];
    };
  }, [blocked, n]);
  const stations: InteriorStation[] = useMemo(() => [
    { id: "exit", name: "Outside", pos: [spawnX, -2.2], action: "exit", range: 1.3 },
    // Every closet is a wardrobe (decision 210): stand at it and press E.
    ...layout.rooms.flatMap((room, i) => room.items.filter(item => item.piece === "closet")
      .map(item => ({ id: "closet", name: "Closet", pos: itemCentre(i, n, item), action: "closet", range: 1.6 }))),
    // From the bed's middle: a 2-cell bed needs the longer reach to be usable from its pillow or foot end.
    ...beds(layout).map(b => ({ id: "bed", name: "Bed", pos: [b.x, b.z] as [number, number], action: "bed", range: 2 })),
    ...(n < MAX_ROOMS ? [{ id: "buy", name: "Add a room", pos: [roomLeft(n - 1, n) - RW + 1.2, 0] as [number, number], action: "buy", range: 1.4 }] : []),
  ], [layout, n, spawnX]);
  const nearRef = useRef<HouseNear>(null);
  const onWalk = (x: number, z: number) => {
    const next = (nearestStation(stations, x, z)?.id ?? null) as HouseNear;
    if (nearRef.current !== next) { nearRef.current = next; onNear(next); }
  };
  return <>
    <ambientLight color="#fff7ed" intensity={light.ambient} />
    <hemisphereLight args={["#dde8ff", "#b79c80", light.hemisphere]} />
    <directionalLight color={light.keyColor} intensity={light.key} position={[3, 8, -4]} />
    {layout.rooms.map((room, i) => <group key={room.id}>
      <RoomShell index={i} count={n} wallpaper={room.wallpaper} flooring={room.flooring} />
      <pointLight color="#ffe3ba" intensity={light.ceiling * 0.55} distance={9} position={[roomLeft(i, n) - RW / 2, 2.8, 0.4]} />
      <RoomPlacement index={i} count={n} items={room.items} decorating={decorating} selected={selected}
        onPlace={item => onPlace(i, item)} onPickUp={item => onPickUp(i, item)} />
    </group>)}
    <InteriorPlayer frozen={frozen || (decorating && !!selected)} bounds={bounds} playerPosRef={player as React.MutableRefObject<THREE.Vector3>} onMove={onWalk} constrainMove={constrainMove} />
  </>;
}

/** One room's grid mapping: cell x grows toward screen-right (−x world); z from the front (cz 0) to the back wall. */
function RoomPlacement({ index, count, items, decorating, selected, onPlace, onPickUp }: {
  index: number; count: number; items: readonly PlacedItem[]; decorating: boolean;
  selected: { piece: string; rot: Rotation; uid?: string } | null;
  onPlace: (item: PlacedItem) => void; onPickUp: (item: PlacedItem) => void;
}) {
  const left = roomLeft(index, count);
  const hasWall = (wall: Wall) => wall === "n" || (wall === "w" && index === 0) || (wall === "e" && index === count - 1);
  const mapping: GridMapping = useMemo(() => {
    const local = (p: THREE.Vector3) => [left - p.x, p.z + RD / 2] as const;
    return {
      fromPoint: (point, piece, rot) => {
        const def = catalogueItem(piece);
        const [lx, lz] = local(point);
        if (def?.mount === "wall") {
          let snap = snapToWall(lx, lz, def.size[0]);
          if (!hasWall(snap.wall)) snap = { wall: "n", index: Math.max(0, Math.min(RW - def.size[0], Math.floor(lx - def.size[0] / 2 + 0.5))) };
          return { cell: [snap.index, 0], wall: snap.wall };
        }
        const [w, d] = footprint(def?.size ?? [1, 1], rot);
        return { cell: [Math.floor(lx - w / 2 + 0.5), Math.floor(lz - d / 2 + 0.5)] };
      },
      toWorld: (item) => {
        const def = catalogueItem(item.piece);
        if (def?.mount === "wall" && item.wall) {
          const mid = item.cell[0] + def.size[0] / 2;
          if (item.wall === "n") return { position: [left - mid, 1.6, RD / 2 - 0.02], rotY: Math.PI };
          if (item.wall === "w") return { position: [left - 0.02, 1.6, -RD / 2 + mid], rotY: -Math.PI / 2 };
          return { position: [left - RW + 0.02, 1.6, -RD / 2 + mid], rotY: Math.PI / 2 };
        }
        const [w, d] = footprint(def?.size ?? [1, 1], item.rot);
        return { position: [left - item.cell[0] - w / 2, def?.mount === "rug" ? 0.005 : 0, -RD / 2 + item.cell[1] + d / 2], rotY: item.rot * Math.PI / 2 };
      },
      footprintQuad: (item) => {
        const def = catalogueItem(item.piece);
        if (def?.mount === "wall" && item.wall) {
          const { position } = mapping.toWorld(item);
          const along = item.wall === "n" ? 0 : Math.PI / 2;
          const inset = item.wall === "n" ? [0, -0.5] : item.wall === "w" ? [-0.5, 0] : [0.5, 0];
          return { center: [position[0] + inset[0], 0.02, position[2] + inset[1]], size: [def.size[0], 1], rotY: along };
        }
        const [w, d] = footprint(def?.size ?? [1, 1], item.rot);
        return { center: [left - item.cell[0] - w / 2, 0.02, -RD / 2 + item.cell[1] + d / 2], size: [w, d], rotY: 0 };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasWall derives from index/count.
  }, [left, index, count]);
  const context = useMemo(() => ({ inside: roomInside(selected ? catalogueItem(selected.piece)?.mount ?? "floor" : "floor"), wallLength: roomWallLength }), [selected]);
  return <PlacementLayer items={items} mapping={mapping} context={context} active={decorating} selected={selected} onPlace={onPlace} onPickUp={onPickUp}
    plane={{ center: [left - RW / 2, 0.01, 0], size: [RW, RD] }}
    onFloorClick={p => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: p.x, z: p.z } }))} />;
}
