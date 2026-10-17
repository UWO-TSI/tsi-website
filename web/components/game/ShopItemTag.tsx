"use client";

/**
 * The shop's item tag (specs/interiors/shop.md): walk near an item on show and a small card over it shows its name and
 * a mini image (its icon). One at a time, the nearest on your floor (nearestDisplay); it checks a few times a second
 * in the frame loop and React renders only when the item changes. Anchored above the item with the curved world's bend
 * (as the residents' labels are).
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { nearestDisplay, type ShopDisplayItem } from "@/lib/game/shopDisplay";
import { SHOP_FLOOR_HEIGHT, SHOP_SLOTS, type ShopWalker } from "@/lib/game/shopLayout";
import s from "./ShopItemTag.module.css";

const SLOT = new Map(SHOP_SLOTS.map(x => [x.id, x]));
/** How often the nearest item is looked for (s). */
const EVERY = 0.15;

/** Module scope (the react compiler forbids writing through hook values): the nearest item now, if it changed. */
function look(state: { t: number; slot: string | null }, dt: number, items: readonly ShopDisplayItem[], walker: ShopWalker, p: THREE.Vector3, show: (i: ShopDisplayItem | null) => void) {
  state.t += dt;
  if (state.t < EVERY) return;
  state.t = 0;
  const level = walker.zone === "ground" ? 0 : walker.zone === "upper" ? 1 : null;
  const item = nearestDisplay(items, p.x, p.z, level);
  const slot = item?.slot ?? null;
  if (slot !== state.slot) { state.slot = slot; show(item); }
}

export default function ShopItemTag({ items, walker, player, hidden = false }: {
  items: readonly ShopDisplayItem[]; walker: ShopWalker; player: React.RefObject<THREE.Vector3>;
  /** A sheet or a talk is up: no tag. */
  hidden?: boolean;
}) {
  const [item, setItem] = useState<ShopDisplayItem | null>(null);
  const state = useRef({ t: 0, slot: null as string | null });
  useFrame((_, dt) => { if (player.current) look(state.current, dt, items, walker, player.current, setItem); });
  const slot = item && SLOT.get(item.slot);
  if (!item || !slot || hidden) return null;
  const top: [number, number, number] = [slot.at[0], slot.level * SHOP_FLOOR_HEIGHT + slot.at[1] + slot.size[1] + 0.3, slot.at[2]];
  return <Html key={item.slot} calculatePosition={calculateCurvedHtmlPosition} position={top} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
    <div className={s.tag} data-testid="shop-item-tag" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.icon} src={item.icon} alt="" width={30} height={30} />
      <span className={s.name}>{item.name}</span>
      {item.special ? <span className={s.special}>Today&apos;s special</span> : null}
    </div>
  </Html>;
}
