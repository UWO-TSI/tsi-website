"use client";

/**
 * The tackle shop's catch board (d-now, David: "a board or tv or smth that shows what fishes are out rn in what area"):
 * a chalkboard on the shop's porch listing what bites this hour, redrawn when the hour or the weather turns; E in front
 * opens the full list by where (OutNowSheet). The seasonal view is the collection book's. Plain wood and slate, no
 * texture but the chalk (lane rules: textures only where they show).
 */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Fish, Lock } from "lucide-react";
import { RARITY_RANK } from "@/lib/collections/roster";
import { fishOut } from "@/lib/game/peaceful";
import { reelWeather, type IslandWeather } from "@/lib/game/islandWeather";
import type { WaterType } from "@/lib/game/fishingSpots";
import type { FishDef } from "@/lib/game/fishing";
import { CATCH_BOARD } from "@/lib/game/wharf";
import { iconUrl } from "@/lib/icons/keys";
import { Empty, List, ListRow } from "@/components/gui";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import p from "@/components/progression/progression.module.css";

const WHERE: Record<WaterType, string> = { sea: "Off the pier and the beach", river: "In the river", pond: "In the pond" };
const SHORT: Record<WaterType, string> = { sea: "sea", river: "river", pond: "pond" };

/**
 * The pond fish that would bite now in the mountain's pond, on an island with no pond open (David: "pond only in
 * mountain"): listed as closed, never as catchable, until the mountain opens.
 */
export function closedNow(waters: readonly WaterType[], hour: number, month: number, weather: IslandWeather) {
  return waters.includes("pond") ? [] : outNow(["pond"], hour, month, weather);
}

/** What bites now, rarest first (the board's order). */
export function outNow(waters: readonly WaterType[], hour: number, month: number, weather: IslandWeather): { fish: FishDef; water: WaterType }[] {
  const rank = (f: FishDef) => RARITY_RANK[f.rarity as keyof typeof RARITY_RANK] ?? RARITY_RANK.legendary + 1;
  return fishOut(waters, { hour, month, weather: reelWeather(weather) }).sort((a, b) => rank(b.fish) - rank(a.fish) || a.fish.name.localeCompare(b.fish.name));
}

const W = 256, H = 184, ROWS = 7;
const FONT = '"Tethos Nunito", Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif';
/** The board's chalk, a canvas texture drawn when the hour, the weather or the season turns. */
function newChalk() {
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}
function drawBoard({ canvas, texture }: ReturnType<typeof newChalk>, out: { fish: FishDef; water: WaterType }[], hour: number, pondClosed: boolean) {
  texture.needsUpdate = true;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#2f3b36";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#f2efe4";
  g.textBaseline = "top";
  g.font = `800 22px ${FONT}`;
  g.fillText("Biting now", 12, 8);
  g.font = `600 13px ${FONT}`;
  g.fillStyle = "#c9d4c6";
  const h = Math.floor(hour) % 24;
  g.fillText(`${String(h).padStart(2, "0")}:00 to ${String((h + 1) % 24).padStart(2, "0")}:00`, 150, 14);
  g.fillRect(12, 36, W - 24, 1.5);
  out.slice(0, ROWS).forEach(({ fish, water }, i) => {
    const y = 44 + i * 19;
    g.fillStyle = "#f2efe4";
    g.font = `700 15px ${FONT}`;
    g.fillText(fish.name, 14, y, 160);
    g.fillStyle = "#c9d4c6";
    g.font = `600 12px ${FONT}`;
    g.fillText(SHORT[water], 196, y + 2);
  });
  g.fillStyle = "#c9d4c6";
  g.font = `600 12px ${FONT}`;
  const foot = [out.length > ROWS ? `and ${out.length - ROWS} more` : "", pondClosed ? "Pond fish: mountain, closed" : ""].filter(Boolean).join(" · ");
  if (foot) g.fillText(foot, 14, 44 + ROWS * 19, W - 28);
}

const WOOD = new THREE.MeshStandardMaterial({ color: "#8a5a36", roughness: 0.9, metalness: 0 });
const SLATE = new THREE.MeshStandardMaterial({ color: "#2f3b36", roughness: 1, metalness: 0 });

/** The board on the tackle shop's porch: `shop` the prop's place and turn, `y` the porch floor. */
export function CatchBoard({ shop, y, waters, hour, month, weather }: {
  shop: { x: number; z: number; yaw: number }; y: number; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather;
}) {
  const hourNow = Math.floor(hour);
  const out = useMemo(() => outNow(waters, hourNow + 0.5, month, weather), [waters, hourNow, month, weather]);
  const pondClosed = useMemo(() => closedNow(waters, hourNow + 0.5, month, weather).length > 0, [waters, hourNow, month, weather]);
  const [chalk] = useState(newChalk);
  useEffect(() => drawBoard(chalk, out, hourNow, pondClosed), [chalk, out, hourNow, pondClosed]);
  useEffect(() => () => chalk.texture.dispose(), [chalk]);
  const { x, z, w, h, legs } = CATCH_BOARD;
  return (
    <group position={[shop.x, y, shop.z]} rotation={[0, shop.yaw, 0]}>
      <group position={[x, 0, z]}>
        {[-1, 1].map(s => <mesh key={s} material={WOOD} position={[s * (w / 2 - 0.05), (legs + h) / 2, -0.04]}><boxGeometry args={[0.07, legs + h, 0.07]} /></mesh>)}
        <mesh material={WOOD} position={[0, legs + h / 2, 0]}><boxGeometry args={[w, h, 0.05]} /></mesh>
        <mesh material={SLATE} position={[0, legs + h / 2, 0.026]}><planeGeometry args={[w - 0.08, h - 0.08]} /></mesh>
        <mesh position={[0, legs + h / 2, 0.028]}>
          <planeGeometry args={[w - 0.1, h - 0.1]} />
          <meshStandardMaterial map={chalk.texture} roughness={1} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}

/** The board read up close: everything biting this hour, by where. */
export function OutNowSheet({ open, onClose, keys, waters, hour, month, weather }: {
  open: boolean; onClose: () => void; keys?: string; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather;
}) {
  const out = useMemo(() => (open ? outNow(waters, Math.floor(hour) + 0.5, month, weather) : []), [open, waters, hour, month, weather]);
  const shut = useMemo(() => (open ? closedNow(waters, Math.floor(hour) + 0.5, month, weather) : []), [open, waters, hour, month, weather]);
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Catch board" keys={keys}>
      <p className={p.muted} style={{ marginBottom: 10 }}>What&apos;s biting this hour, in this weather. It changes with the hour, the weather and the season; the collection book has the year.</p>
      {out.length === 0 ? <Empty icon={<Fish size={32} />} title="Nothing biting">Try again in an hour.</Empty> : null}
      {waters.map(w => {
        const here = out.filter(o => o.water === w);
        return here.length ? <section key={w} style={{ marginBottom: 12 }}>
          <h3 className={p.muted} style={{ margin: "8px 0" }}>{WHERE[w]}</h3>
          <List label={WHERE[w]}>{here.map(({ fish }) => <ListRow key={fish.key} icon={iconUrl(fish.key)} title={fish.name} detail={fish.whenLabel ? `${fish.rarity} · ${fish.whenLabel}` : fish.rarity} />)}</List>
        </section> : null;
      })}
      {shut.length ? <section style={{ marginBottom: 12, opacity: 0.7 }}>
        <h3 className={p.muted} style={{ margin: "8px 0" }}>In the mountain pond: closed until the mountain opens</h3>
        <List label="In the mountain pond, closed">{shut.map(({ fish }) => <ListRow key={fish.key} icon={<Lock size={20} />} title={fish.name} detail={`${fish.rarity} · not catchable yet`} />)}</List>
      </section> : null}
    </ProgressionPanel>
  );
}
