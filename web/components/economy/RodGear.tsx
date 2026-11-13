"use client";

/**
 * A rod's stats and add-ons (David 2026-10-27 and 10-28, v1-gameplay m4 and x-shop), wherever a rod is shown. The hex
 * radar grades the six stats up to STAT_MAX (legendary about 100, Divine past it): in the shop the rod alone; on your own rod the build with its add-ons, the
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
import { rodSpec } from "@/lib/icons/itemModel";
import { shopIcon } from "@/lib/icons/keys";
import { RARITY_LABEL } from "@/lib/rarity";
import { SLOTS, STAT_INFO, TACKLE, STAT_KEYS, STAT_MAX, awakened, nextAwakening, rig, secretAwakenings, tackleByKey, type RodStat, type RodTier, type Tackle, type TackleSlot } from "@/lib/game/rods";
import type { InventoryRow } from "@/lib/wallet/store";
import { FittedModel } from "./ItemViewer";
import TurnStage from "./TurnStage";

/** The add-ons a member has on (equipped inventory rows), by key. */
export const equippedTackle = (rows: readonly InventoryRow[]): string[] =>
  rows.flatMap(r => (r.equipped && tackleByKey(r.item.catalogue_ref) ? [r.item.catalogue_ref!] : []));
/** "+20 Luck, +10 Lure". */
export const gainsText = (t: Tackle) => STAT_KEYS.flatMap(k => (t.gains[k] ? [`+${t.gains[k]} ${STAT_INFO[k].label}`] : [])).join(", ");
const RECORD_LINE = { display: "flex", alignItems: "center", gap: 8, margin: 0, color: "var(--ui-ink-2)", font: "500 13px var(--gui-font)" } as const;
/**
 * The rod card's record (rod_catches), small lines under its title (David 2026-11-03: "you dont need a whole bar to
 * say"; 2026-11-04: no levels, only awakenings). The fish landed with it; on a rod that awakens in the open (epic and
 * up) a small bar of the way to its next awakening (the Training rod's stay a surprise: its count only); and its
 * passive, a line kept empty on rods without one so every card lines up. `rod` is the rod as bought; the line shows it
 * as `catches` have awakened it.
 */
export function RodRecord({ rod, catches = 0 }: { rod: RodTier; catches?: number }) {
  const now = awakened(rod, catches), open = rod.awakenings.length > 0 && !secretAwakenings(rod), next = nextAwakening(rod, catches);
  const from = rod.awakenings[now.stage - 1]?.at ?? 0, done = next ? (catches - from) / (next.at - from) : 1;
  const fish = `${catches.toLocaleString()} fish caught`;
  return <div data-testid="rod-record" style={{ display: "grid", gap: 4, margin: "0 0 4px" }}>
    <p style={RECORD_LINE} title={open && next ? `${(next.at - catches).toLocaleString()} more fish to its next awakening` : undefined}>
      {open && <span role="progressbar" aria-label="To its next awakening" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}
        style={{ flex: "none", width: 64, height: 4, borderRadius: 2, background: "var(--ui-line)", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${done * 100}%`, height: "100%", background: "var(--ui-chart)" }} />
      </span>}
      <span>{!open ? fish : next ? `${catches.toLocaleString()} / ${next.at.toLocaleString()} fish to awaken` : `${fish} · fully awakened`}</span>
    </p>
    <p data-testid="rod-passive" style={{ ...RECORD_LINE, minHeight: 18 }}>{now.passive && <><b style={{ fontWeight: 600, color: "var(--ui-ink)" }}>{now.passive.name}</b>{now.passive.text}</>}</p>
  </div>;
}
/** "Rare rod · hooks up to epic" (the rod as it is now: an awakening can hook rarer fish). */
export const rodLine = (r: RodTier) => `${RARITY_LABEL[r.rarity]} rod · hooks up to ${RARITY_LABEL[r.hooks].toLowerCase()}`;

const STAT_ICON: Record<RodStat, ReactNode> = {
  luck: <Clover />, bite: <Timer />, strength: <Link />, reel: <RefreshCw />, lure: <Magnet />, control: <MoveHorizontal />,
};
const axis = (k: RodStat, value: number, base?: number) => ({ label: STAT_INFO[k].label, hint: STAT_INFO[k].does, icon: STAT_ICON[k], value, base });

/** A rod's radar: the rod alone, or (`tackle`) the build with its add-ons over the rod alone, or (`from`) the rod over what it was. */
export function RodRadar({ rod, tackle, from, size }: { rod: RodTier; tackle?: readonly string[]; from?: RodTier; size?: number }) {
  const on = tackle ? rig(rod, tackle) : null, under = on ? rod : from;
  return <HexRadar label={`${rod.name} stats`} max={STAT_MAX} size={size} testId="rod-radar" baseLabel={on ? undefined : "before"}
    axes={STAT_KEYS.map(k => axis(k, on ? on.stats[k] : rod.base[k], under?.base[k]))} />;
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
const LINE = 0.34, LEADER = 0.1, SIZE: Record<TackleSlot, number> = { bobber: 0.09, bait: 0.07 };
// A light, fine line (David 10-29: "make the line not black and thinner more subtle").
const lineMat = new THREE.MeshBasicMaterial({ color: 0xb4bcc4 });
const lineGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5).translate(0, -0.5, 0);
// The low-poly tackle loads with the stage, so fitting one never blinks the rest out while it loads.
for (const t of TACKLE) useGLTF.preload(worldModel(t.model));

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

/** Your rod (as awakened) large and turning, with what's on its slots hanging from the tip; `corner` holds the slots. */
export function RodStage({ rod, tackle, className }: { rod: RodTier; tackle: readonly string[]; className?: string }) {
  const spec = rodSpec(rod);
  const on = rig(rod, tackle).tackle.map(k => tackleByKey(k)!);
  if (!spec) return null;
  return <TurnStage className={className} label={rod.name}>
    <Suspense fallback={null}><FittedModel spec={spec} hang={on.length ? <Suspense fallback={null}><Hang tackle={on} /></Suspense> : undefined} /></Suspense>
  </TurnStage>;
}
