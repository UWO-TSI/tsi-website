"use client";

/**
 * A rod's stats and add-ons (David 2026-10-27 and 10-28, v1-gameplay m4 and x-shop), wherever a rod is shown. The hex
 * radar grades the six stats out of 100: in the shop the rod alone; on your own rod the build with its add-ons, the
 * rod alone faint behind it, sliding as an add-on goes on. Only your own rods carry the bait and bobber slots (the
 * stage's bottom-right corner), and what's on them hangs from the rod's tip (their low-poly copies). An add-on's own
 * detail shows just the add-on and its own radar.
 */
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CircleDot, Clover, Link, Magnet, MoveHorizontal, RefreshCw, Timer, Worm } from "lucide-react";
import { GearSlot, HexRadar } from "@/components/gui/flat";
import { prepareModel } from "@/lib/game/modelMaterials";
import { worldModel } from "@/lib/game/world/active";
import { keyModel } from "@/lib/icons/itemModel";
import { shopIcon } from "@/lib/icons/keys";
import { RARITY_LABEL } from "@/lib/rarity";
import { RODS, SLOTS, STAT_INFO, STAT_KEYS, STAT_MAX, hookCap, rig, tackleByKey, type RodStat, type RodTier, type Tackle, type TackleSlot } from "@/lib/game/rods";
import type { InventoryRow } from "@/lib/wallet/store";
import { FittedModel } from "./ItemViewer";
import TurnStage from "./TurnStage";

export const rodOf = (ref: string | null | undefined): RodTier | null => RODS.find(r => r.key === ref) ?? null;
/** The add-ons a member has on (equipped inventory rows), by key. */
export const equippedTackle = (rows: readonly InventoryRow[]): string[] =>
  rows.flatMap(r => (r.equipped && tackleByKey(r.item.catalogue_ref) ? [r.item.catalogue_ref!] : []));
/** "+20 Luck, +10 Lure". */
export const gainsText = (t: Tackle) => STAT_KEYS.flatMap(k => (t.gains[k] ? [`+${t.gains[k]} ${STAT_INFO[k].label}`] : [])).join(", ");
/** "Rare rod · hooks up to epic". */
export const rodLine = (r: RodTier) => `${RARITY_LABEL[r.rarity]} rod · hooks up to ${RARITY_LABEL[hookCap(r.rarity)].toLowerCase()}`;

const STAT_ICON: Record<RodStat, ReactNode> = {
  luck: <Clover />, bite: <Timer />, strength: <Link />, reel: <RefreshCw />, lure: <Magnet />, control: <MoveHorizontal />,
};
const axis = (k: RodStat, value: number, base?: number) => ({ label: STAT_INFO[k].label, hint: STAT_INFO[k].does, icon: STAT_ICON[k], value, base });

/** A rod's radar: the rod alone, or (`tackle`) the build with its add-ons over the rod alone. */
export function RodRadar({ rod, tackle }: { rod: RodTier; tackle?: readonly string[] }) {
  const on = tackle ? rig(rod, tackle) : null;
  return <HexRadar label={`${rod.name} stats`} max={STAT_MAX} testId="rod-radar"
    axes={STAT_KEYS.map(k => axis(k, on ? on.stats[k] : rod.base[k], on ? rod.base[k] : undefined))} />;
}

/** An add-on's own radar: only what it adds (David 2026-10-28: "only show the bobber and not on a rod"). */
export function TackleRadar({ tackle }: { tackle: Tackle }) {
  return <HexRadar label={`${tackle.name} adds`} max={STAT_MAX} testId="tackle-radar" axes={STAT_KEYS.map(k => axis(k, tackle.gains[k] ?? 0))} />;
}

const SLOT_ICON: Record<TackleSlot, ReactNode> = { bait: <Worm />, bobber: <CircleDot /> };
const SLOT_LABEL: Record<TackleSlot, string> = { bait: "Bait", bobber: "Bobber" };

/** Your rod's slots, for the stage's corner: each shows what's on it; a click lists what you own that fits. */
export function RodSlots({ rows, busy, onEquip }: { rows: readonly InventoryRow[]; busy: boolean; onEquip: (itemId: string, on: boolean) => void }) {
  return <>{SLOTS.map(slot => <GearSlot key={slot} label={SLOT_LABEL[slot]} icon={SLOT_ICON[slot]} busy={busy} onPick={onEquip} testId={`slot-${slot}`}
    empty={<>None yet. {SLOT_LABEL[slot]} is on the shop&apos;s Tools shelf.</>}
    options={rows.filter(r => tackleByKey(r.item.catalogue_ref)?.slot === slot).map(r => ({
      id: r.item.id, name: r.item.display_name, picture: r.item.sprite_url ?? shopIcon(r.item), line: gainsText(tackleByKey(r.item.catalogue_ref)!), on: r.equipped,
    }))} />)}</>;
}

/** How far the tackle hangs below the tip, and each piece's size (stage units: the rod spans 1.7). */
const LINE = 0.34, LEADER = 0.1, SIZE: Record<TackleSlot, number> = { bobber: 0.2, bait: 0.12 };
const lineMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a });
const lineGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5).translate(0, -0.5, 0);

/** An add-on's low-poly copy, its top at the origin, `size` across. */
function Piece({ url, size }: { url: string; size: number }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const m = prepareModel(scene, url), g = new THREE.Group(), box = new THREE.Box3().setFromObject(m);
    const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = size / Math.max(s.x, s.y, s.z, 1e-3);
    m.position.set(-c.x, -box.max.y, -c.z);
    g.add(m);
    g.scale.setScalar(k);
    return g;
  }, [scene, url, size]);
  return <primitive object={object} />;
}

/**
 * The tackle on the rod: the bobber on its line from the tip and the bait on a short leader below it. Fitting one
 * drops it from the tip and lets it settle, swinging a little (off under reduced motion).
 */
function Hang({ tackle }: { tackle: readonly Tackle[] }) {
  const swing = useRef<THREE.Group>(null), drop = useRef<THREE.Group>(null), line = useRef<THREE.Mesh>(null);
  const since = useRef(0), still = useRef(false);
  const bobber = tackle.find(t => t.slot === "bobber"), bait = tackle.find(t => t.slot === "bait");
  const key = tackle.map(t => t.key).join();
  useEffect(() => {
    since.current = performance.now();
    still.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, [key]);
  useFrame(() => {
    const t = still.current ? 9 : (performance.now() - since.current) / 1000;
    const y = -LINE * (1 - Math.exp(-6 * t) * Math.cos(8 * t));
    if (drop.current) drop.current.position.y = y;
    if (line.current) line.current.scale.y = Math.max(0.001, -y);
    if (swing.current) swing.current.rotation.z = 0.3 * Math.exp(-2.5 * t) * Math.sin(6 * t);
  });
  return <group ref={swing}>
    <mesh ref={line} geometry={lineGeo} material={lineMat} />
    <group ref={drop}>
      {bobber && <Piece url={worldModel(bobber.model)} size={SIZE.bobber} />}
      {bait && <group position={[0, bobber ? -SIZE.bobber : 0, 0]}>
        {bobber && <mesh geometry={lineGeo} material={lineMat} scale={[1, LEADER, 1]} />}
        <group position={[0, bobber ? -LEADER : 0, 0]}><Piece url={worldModel(bait.model)} size={SIZE.bait} /></group>
      </group>}
    </group>
  </group>;
}

/** Your rod large and turning, with what's on its slots hanging from the tip; `corner` holds the slots. */
export function RodStage({ rod, tackle, className }: { rod: RodTier; tackle: readonly string[]; className?: string }) {
  const spec = keyModel(rod.key);
  const on = rig(rod, tackle).tackle.map(k => tackleByKey(k)!);
  if (!spec) return null;
  return <TurnStage className={className} label={rod.name}>
    <Suspense fallback={null}><FittedModel spec={spec} hang={on.length ? <Suspense fallback={null}><Hang tackle={on} /></Suspense> : undefined} /></Suspense>
  </TurnStage>;
}
