"use client";

/**
 * The furnished shop (specs/interiors/shop.md, phase 2): the modelled ground floor and the mezzanine's shell
 * (art/interiors/build_shop.py, on lib/game/shopLayout.ts's numbers), the items on show (ShopDisplays), and the
 * mezzanine shown or cut away as the room's walker says. The windows show the outside for the time of day (RoomShell's
 * window view). A click on a floor walks you there; near an item on show, its tag shows (ShopItemTag). Upstairs is
 * still the layout's blocks until its furnishing.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { prepareModel } from "@/lib/game/modelMaterials";
import * as layout from "@/lib/game/shopLayout";
import { SHOP_FLOOR_HEIGHT, type ShopWalker } from "@/lib/game/shopLayout";
import { shopDisplay } from "@/lib/game/shopDisplay";
import type { IslandLight } from "@/lib/game/islandLighting";
import { useOutside, windowViewMaterial } from "./RoomShell";
import { Contents } from "./ShopGreybox";
import ShopDisplays from "./ShopDisplays";
import ShopItemTag from "./ShopItemTag";

const GROUND = "/assets/game/interiors/shop/ground.glb";
const MEZZ = "/assets/game/interiors/shop/mezz.glb";
/** The mezzanine's fixtures its model already carries (the rest are blocks until upstairs is furnished). */
const MODELLED_UP = ["stairwell-rail", "mezz-rail", "edge-sign"] as const;

export function preloadShopRoom() {
  useGLTF.preload(GROUND);
  useGLTF.preload(MEZZ);
}

/** A room model, prepared (the shared material presets, look classes, shadows) and its panes showing the outside. */
function useRoomModel(url: string): THREE.Object3D {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const model = prepareModel(scene, url);
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !/^shop_windows/.test(mesh.name)) return;
      mesh.material = windowViewMaterial();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return model;
  }, [scene, url]);
}

/** A click on a floor (downstairs, or the mezzanine's top) walks you there; the walls and fittings take none. */
const walkOn = (level: 0 | 1) => (e: ThreeEvent<MouseEvent>) => {
  if (Math.abs(e.point.y - level * SHOP_FLOOR_HEIGHT) > 0.3) return;
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
  AudioManager.playSFX("click");
};

export default function ShopRoom({ walker, light, player, frozen }: {
  walker: ShopWalker; light: IslandLight; player: React.RefObject<THREE.Vector3>;
  /** A sheet or a talk is up: the item tag hides. */
  frozen: boolean;
}) {
  useOutside(light);
  // The layout's numbers and the walker, for the evidence script's labels and routes (dev only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __shopLayout: layout, __shopWalker: walker });
    return () => { delete (window as { __shopLayout?: unknown }).__shopLayout; delete (window as { __shopWalker?: unknown }).__shopWalker; };
  }, [walker]);
  const ground = useRoomModel(GROUND), mezz = useRoomModel(MEZZ);
  const items = useMemo(() => shopDisplay(), []);
  const upper = useRef<THREE.Group>(null);
  useFrame(() => { if (upper.current) upper.current.visible = walker.upperShown; });
  return <group>
    <primitive object={ground} onClick={walkOn(0)} />
    <ShopDisplays items={items} level={0} />
    <ShopItemTag items={items} walker={walker} player={player} hidden={frozen} />
    <group ref={upper}>
      <primitive object={mezz} onClick={walkOn(1)} />
      <group position={[0, SHOP_FLOOR_HEIGHT, 0]}><Contents level={1} except={MODELLED_UP} paths={false} /></group>
    </group>
  </group>;
}
