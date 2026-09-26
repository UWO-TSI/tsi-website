"use client";

/**
 * Grid placement shared by the house rooms and the home island (specs/homes.md
 * §3): renders placed items, a snapped ghost footprint (green = fits, red =
 * blocked) under the pointer, places on click, picks an item up when clicked
 * in decorate mode. Geometry comes from `web/lib/homes/layout.ts`; the caller
 * supplies the coordinate mapping for its grid.
 */
import { Suspense, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLBProp } from "../NatureModels";
import { catalogueItem } from "@/lib/homes/catalogue";
import { canPlace, footprint, type PlaceContext, type PlacedItem, type Rotation } from "@/lib/homes/layout";

export interface GridMapping {
  /** Pointer point → candidate item position for `piece` (cell, wall). */
  fromPoint: (point: THREE.Vector3, piece: string, rot: Rotation) => Pick<PlacedItem, "cell" | "wall">;
  /** Item → world transform of the model origin. */
  toWorld: (item: PlacedItem) => { position: [number, number, number]; rotY: number };
  /** World centre + size of a footprint quad for the ghost. */
  footprintQuad: (item: PlacedItem) => { center: [number, number, number]; size: [number, number]; rotY: number };
}

export function PlacementLayer({ items, mapping, context, active, selected, onPlace, onPickUp, plane, onFloorClick }: {
  items: readonly PlacedItem[];
  mapping: GridMapping;
  context: Omit<PlaceContext, "items">;
  active: boolean;
  selected: { piece: string; rot: Rotation; uid?: string } | null;
  onPlace: (item: PlacedItem) => void;
  onPickUp: (item: PlacedItem) => void;
  /** Pointer plane: centre and size in world units. */
  plane: { center: [number, number, number]; size: [number, number] };
  onFloorClick?: (point: THREE.Vector3) => void;
}) {
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const ghost: PlacedItem | null = active && selected && hover
    ? { uid: selected.uid ?? "ghost", piece: selected.piece, rot: selected.rot, ...mapping.fromPoint(hover, selected.piece, selected.rot) }
    : null;
  const fits = ghost ? canPlace(ghost, { ...context, items }) : false;
  const quad = ghost ? mapping.footprintQuad(ghost) : null;
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!active) { onFloorClick?.(event.point); return; }
    if (ghost && fits) onPlace({ ...ghost, uid: selected?.uid ?? `${ghost.piece}-${Date.now().toString(36)}` });
  };
  return <>
    <mesh position={plane.center} rotation={[-Math.PI / 2, 0, 0]} onPointerMove={e => active && setHover(e.point.clone())} onPointerOut={() => setHover(null)} onClick={click}>
      <planeGeometry args={plane.size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {items.map(item => {
      const def = catalogueItem(item.piece);
      if (!def) return null;
      const { position, rotY } = mapping.toWorld(item);
      return <group key={item.uid} position={position} rotation={[0, rotY, 0]}
        onClick={active && !selected ? (e) => { e.stopPropagation(); onPickUp(item); } : undefined}>
        <Suspense fallback={null}><GLBProp url={def.url} scale={def.scale} castShadow={def.mount !== "rug"} /></Suspense>
      </group>;
    })}
    {ghost && quad && <>
      <mesh position={quad.center} rotation={[-Math.PI / 2, 0, quad.rotY]} renderOrder={6} raycast={() => {}}>
        <planeGeometry args={quad.size} />
        <meshBasicMaterial color={fits ? "#6fcf7a" : "#e56b5d"} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {(() => {
        const def = catalogueItem(ghost.piece)!;
        const { position, rotY } = mapping.toWorld(ghost);
        return <group position={position} rotation={[0, rotY, 0]} raycast={() => {}}>
          <Suspense fallback={null}><GLBProp url={def.url} scale={def.scale} castShadow={false} /></Suspense>
        </group>;
      })()}
    </>}
  </>;
}

export { footprint };
