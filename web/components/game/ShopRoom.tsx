"use client";

/**
 * The furnished shop (specs/interiors/shop.md, phase 2): the modelled ground floor and the mezzanine's shell
 * (art/interiors/build_shop.py, on lib/game/shopLayout.ts's numbers), the items on show (ShopDisplays), and the
 * mezzanine shown or cut away as the room's walker says. The windows show the outside for the time of day (RoomShell's
 * window view). A click on a floor walks you there; near an item on show, its tag shows (ShopItemTag). Upstairs, the
 * merch level after ref 1 (the pegboard wall, the metal counter, the plinths, the edge light) and the keycap keychain
 * on its peg.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { prepareModel } from "@/lib/game/modelMaterials";
import { applyEnvironment, disposeEnvironment, type EnvPhaseSpec } from "@/lib/game/envLight";
import * as layout from "@/lib/game/shopLayout";
import { SHOP_FLOOR_HEIGHT, type ShopWalker } from "@/lib/game/shopLayout";
import { shopDisplay } from "@/lib/game/shopDisplay";
import type { IslandLight } from "@/lib/game/islandLighting";
import { useOutside, windowViewMaterial } from "./RoomShell";
import ShopDisplays from "./ShopDisplays";
import ShopItemTag from "./ShopItemTag";
import KeycapKeychain from "./KeycapKeychain";
import { KEYCHAIN_HANG } from "@/lib/game/keychainSwing";
import Lanyard, { LANYARD_HANG, LANYARD_SLUG } from "./Lanyard";
import { iconUrl } from "@/lib/icons/keys";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { SHOP_KEYCHAIN, SHOP_LANYARD } from "@/lib/game/shopLayout";
import { KEYCHAIN_SLUG } from "./KeychainStage";

const GROUND = "/assets/game/interiors/shop/ground.glb";
const MEZZ = "/assets/game/interiors/shop/mezz.glb";

/**
 * The room's own light field for reflections and fill (the island's sky isn't here): a bright warm ceiling, the walls,
 * the oak's bounce from below and the lamps' hot spot overhead. Metal reads as metal and the fill stays even.
 */
const SHOP_ENV: EnvPhaseSpec = { skyTop: "#fbf6ec", skyBottom: "#e6dfd4", ground: "#c7a47b", sun: "#fff3d8", intensity: 0.55, sunElev: 0.9, sunAzimuth: 90 };

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
  const { gl, scene } = useThree();
  useEffect(() => { applyEnvironment(gl, scene, SHOP_ENV); return () => disposeEnvironment(scene); }, [gl, scene]);
  const ground = useRoomModel(GROUND), mezz = useRoomModel(MEZZ);
  const items = useMemo(() => shopDisplay(), []);
  const [{ liteMode }] = useGraphicsSettings();
  // The evidence script presses the keychain's keycap (dev): window.__shopKeychainPress().
  const [press, setPress] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __shopKeychainPress: () => setPress(n => n + 1) });
  }, []);
  const upper = useRef<THREE.Group>(null);
  useFrame(() => { if (upper.current) upper.current.visible = walker.upperShown; });
  return <group>
    <primitive object={ground} onClick={walkOn(0)} />
    <ShopDisplays items={items} level={0} />
    <ShopItemTag items={items} walker={walker} player={player} hidden={frozen} />
    <group ref={upper}>
      <primitive object={mezz} onClick={walkOn(1)} />
      {/* The merch on show upstairs (the tote, the sticker packs; the garments and prints are the model's stand-ins). */}
      <ShopDisplays items={items} level={1} except={[SHOP_KEYCHAIN.slot, SHOP_LANYARD.slot]} />
      <group position={[0, SHOP_FLOOR_HEIGHT, 0]}>
        {/* The keycap keychain on its hook: take hold of it, or press its keycap (lite graphics: its sprite). */}
        <mesh position={[SHOP_KEYCHAIN.hook[0], SHOP_KEYCHAIN.hook[1] - 0.012, SHOP_KEYCHAIN.hook[2] + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.13, 8]} /><meshStandardMaterial color="#3b4046" metalness={0.7} roughness={0.4} />
        </mesh>
        {liteMode ? <ItemSprite slug={KEYCHAIN_SLUG} at={SHOP_KEYCHAIN.hook} h={KEYCHAIN_HANG * SHOP_KEYCHAIN.scale} /> : <Suspense fallback={null}><group position={SHOP_KEYCHAIN.hook} rotation={[0, Math.PI, 0]}><KeycapKeychain grab scale={SHOP_KEYCHAIN.scale} press={press} /></group></Suspense>}
        {/* The lanyard folded over its peg: take hold of it and pull it about (lite graphics: its sprite). */}
        <mesh position={[SHOP_LANYARD.peg[0], SHOP_LANYARD.peg[1] - 0.021, SHOP_LANYARD.peg[2] + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} /><meshStandardMaterial color="#3b4046" metalness={0.7} roughness={0.4} />
        </mesh>
        {liteMode ? <ItemSprite slug={LANYARD_SLUG} at={SHOP_LANYARD.peg} h={LANYARD_HANG * SHOP_LANYARD.scale} />
          : <Suspense fallback={null}><group position={SHOP_LANYARD.peg} rotation={[0, Math.PI, 0]}><Lanyard grab scale={SHOP_LANYARD.scale} /></group></Suspense>}
      </group>
    </group>
  </group>;
}

/** A hanging item's sprite on its hook (lite graphics): its icon, a render of the same model, facing the room. */
function ItemSprite({ slug, at, h }: { slug: string; at: readonly [number, number, number]; h: number }) {
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(iconUrl(slug));
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    return t;
  }, [slug]);
  const [x, y, z] = at;
  return <mesh position={[x, y - h / 2, z - 0.06]} rotation={[0, Math.PI, 0]}>
    <planeGeometry args={[h, h]} />
    <meshBasicMaterial map={texture} transparent alphaTest={0.3} />
  </mesh>;
}
