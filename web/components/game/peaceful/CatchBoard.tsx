"use client";

/**
 * The fish market's boards (d-now; David, 2026-10-28: the board "should be near the fish shop", and "a time graphic with
 * the things available ... icon and you can hover to see what the fish is"): two chalkboards out front of the market
 * (lib/game/wharf.ts marketBoardsOf). The catch board's chalk lists what bites this hour; E opens the day as a strip
 * (CatchBoardSheet: the kit's TimeStrip, a lane per water, the fish on at each span of hours, each a hover card). The
 * task board's chalk lists today's fishing tasks; E opens them (FishingTasks). Plain wood and slate, no texture but the
 * chalk (lane rules: textures only where they show).
 */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Clock, Coins, Droplets, Lock, MapPin, Mountain, Ruler, Sparkles, Waves } from "lucide-react";
import { RARITY_RANK, ROSTER } from "@/lib/collections/roster";
import { fishOut } from "@/lib/game/peaceful";
import { reelWeather, type IslandWeather } from "@/lib/game/islandWeather";
import type { WaterType } from "@/lib/game/fishingSpots";
import { iconFor, type FishDef } from "@/lib/game/fishing";
import { BOARD, type BoardSpot } from "@/lib/game/wharf";
import { fishingTasks, speciesSellPrice, torontoDay } from "@/lib/wallet/rules";
import { weekStart } from "@/lib/collections/logic";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { FlatPanel, MonthDots, TimeStrip, TipBody, type StripLane } from "@/components/gui/flat";

const rank = (f: FishDef) => RARITY_RANK[f.rarity as keyof typeof RARITY_RANK] ?? RARITY_RANK.legendary + 1;

/**
 * The pond fish that would bite now in the mountain's pond, on an island with no pond open (David: "pond only in
 * mountain"): listed as closed, never as catchable, until the mountain opens.
 */
export function closedNow(waters: readonly WaterType[], hour: number, month: number, weather: IslandWeather) {
  return waters.includes("pond") ? [] : outNow(["pond"], hour, month, weather);
}

/** What bites now, rarest first (the chalk's order). */
export function outNow(waters: readonly WaterType[], hour: number, month: number, weather: IslandWeather): { fish: FishDef; water: WaterType }[] {
  return fishOut(waters, { hour, month, weather: reelWeather(weather) }).sort((a, b) => rank(b.fish) - rank(a.fish) || a.fish.name.localeCompare(b.fish.name));
}

/** A fish on the strip: what the hover card says. */
export interface StripFish { key: string; picture: string; rarity: string; label: string; mark: boolean; fish: FishDef; water: WaterType; hours: boolean[]; months: number[] }
/**
 * The day as the board draws it: per water, the fish out this month in this weather grouped by the hours they bite
 * (all day first, then by when they start), rarest first in each. `mark`: this is its last month in season.
 */
export function catchLanes(waters: readonly WaterType[], month: number, weather: IslandWeather): { water: WaterType; bands: { id: string; hours: boolean[]; items: StripFish[] }[] }[] {
  return waters.map(water => {
    const hours = new Map<string, { fish: FishDef; hours: boolean[] }>();
    for (let h = 0; h < 24; h++) for (const { fish } of outNow([water], h + 0.5, month, weather)) {
      const row = hours.get(fish.key) ?? { fish, hours: Array<boolean>(24).fill(false) };
      row.hours[h] = true;
      hours.set(fish.key, row);
    }
    const bands = new Map<string, { id: string; hours: boolean[]; items: StripFish[] }>();
    for (const { fish, hours: on } of hours.values()) {
      const id = on.map(Number).join(""), months = ROSTER.find(s => s.key === fish.key)?.months ?? [];
      const band = bands.get(id) ?? { id, hours: on, items: [] };
      band.items.push({ key: fish.key, picture: iconFor(fish), rarity: fish.rarity, label: fish.name, fish, water, hours: on, months,
        mark: months.length > 0 && months.length < 12 && !months.includes((month % 12) + 1) });
      bands.set(id, band);
    }
    const start = (b: boolean[]) => (b.every(Boolean) ? -1 : b.findIndex((on, h) => on && !b[(h + 23) % 24]));
    return { water, bands: [...bands.values()].sort((a, b) => start(a.hours) - start(b.hours))
      .map(b => ({ ...b, items: b.items.sort((x, y) => rank(y.fish) - rank(x.fish) || x.label.localeCompare(y.label)) })) };
  });
}

/** "6:00 to 18:00", "20:00 to 4:00", or "All day", from a fish's hours. */
export function hoursText(on: readonly boolean[]): string {
  if (on.every(Boolean)) return "All day";
  const from = on.findIndex((x, h) => x && !on[(h + 23) % 24]), len = on.filter(Boolean).length;
  return `${from}:00 to ${(from + len) % 24}:00`;
}

const WATER: Record<WaterType, { label: string; icon: React.ReactNode }> = {
  sea: { label: "The sea, off the pier and the beach", icon: <Waves /> },
  river: { label: "The river", icon: <Droplets /> },
  pond: { label: "The mountain pond", icon: <Mountain /> },
};
const WHERE: Record<WaterType, string> = { sea: "Sea", river: "River", pond: "Mountain pond" };

/** The catch board read up close: today as a strip, now marked; hover a fish for what it is. */
export function CatchBoardSheet({ open, onClose, keys, waters, hour, month, weather }: {
  open: boolean; onClose: () => void; keys?: string; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather;
}) {
  const lanes = useMemo(() => (open ? catchLanes(waters, month, weather) : []), [open, waters, month, weather]);
  const pondShut = useMemo(() => open && !waters.includes("pond"), [open, waters]);
  const strip: StripLane<StripFish>[] = [
    ...lanes.map(l => ({ id: l.water, icon: WATER[l.water].icon, label: WATER[l.water].label, bands: l.bands })),
    ...(pondShut ? [{ id: "pond", icon: WATER.pond.icon, label: WATER.pond.label, bands: [], closed: <><Lock size={16} aria-hidden /> Opens with the mountain</> }] : []),
  ];
  return <FlatPanel open={open} onClose={onClose} title="Catch board" keys={keys} testId="catch-board">
    <TimeStrip now={hour} lanes={strip} label="What bites when, today" tip={f => <FishTip f={f} month={month} />} />
  </FlatPanel>;
}

function FishTip({ f, month }: { f: StripFish; month: number }) {
  const price = speciesSellPrice(f.key), size = f.fish.sizeCm;
  return <TipBody picture={f.picture} rarity={f.rarity} kind={RARITY_LABEL[f.rarity as Rarity] ?? f.rarity} name={f.label} facts={[
    [<Clock key="c" size={14} />, hoursText(f.hours)],
    [<MapPin key="w" size={14} />, WHERE[f.water]],
    [<Ruler key="s" size={14} />, `${size[0]} to ${size[1]} cm`],
    ...(price ? [[<Coins key="p" size={14} />, <span key="pv" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{price.toLocaleString()} <CurrencyIcon size={13} /></span>] as const] : []),
    ...(f.mark ? [[<Sparkles key="l" size={14} />, "Last month this year"] as const] : []),
  ]}>
    <MonthDots on={f.months.length ? f.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} now={month} />
  </TipBody>;
}

// ── The chalkboards in the world ────────────────────────────────────────────────────────────────────────────────────

const W = 256, H = 184, ROWS = 7;
const FONT = '"Tethos Nunito", Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif';
const CHALK = { slate: "#2f3b36", ink: "#f2efe4", soft: "#c9d4c6" };
/** A board's chalk, a canvas texture, drawn by `draw` whenever what it shows changes. */
function newChalk() {
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}
/** A title, a quiet note at its right, a rule, then up to ROWS lines (main and a quiet end) and a quiet foot. */
function chalkList({ canvas, texture }: ReturnType<typeof newChalk>, title: string, note: string, rows: readonly (readonly [string, string])[], foot: string) {
  texture.needsUpdate = true;
  const g = canvas.getContext("2d")!;
  g.fillStyle = CHALK.slate;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "top";
  g.fillStyle = CHALK.ink;
  g.font = `800 22px ${FONT}`;
  g.fillText(title, 12, 8);
  g.font = `600 13px ${FONT}`;
  g.fillStyle = CHALK.soft;
  g.textAlign = "right";
  g.fillText(note, W - 12, 14);
  g.textAlign = "left";
  g.fillRect(12, 36, W - 24, 1.5);
  rows.slice(0, ROWS).forEach(([main, end], i) => {
    const y = 44 + i * 19;
    g.fillStyle = CHALK.ink;
    g.font = `700 15px ${FONT}`;
    g.fillText(main, 14, y, 170);
    g.fillStyle = CHALK.soft;
    g.font = `600 12px ${FONT}`;
    g.textAlign = "right";
    g.fillText(end, W - 14, y + 2);
    g.textAlign = "left";
  });
  g.fillStyle = CHALK.soft;
  g.font = `600 12px ${FONT}`;
  if (foot) g.fillText(foot, 14, 44 + ROWS * 19, W - 28);
}

const WOOD = new THREE.MeshStandardMaterial({ color: "#8a5a36", roughness: 0.9, metalness: 0 });
const SLATE = new THREE.MeshStandardMaterial({ color: CHALK.slate, roughness: 1, metalness: 0 });

/** One chalkboard on its legs at `at`, on the ground `y`, its chalk `rows` under `title`. */
export function Chalkboard({ at, y, title, note, rows, foot = "" }: { at: BoardSpot; y: number; title: string; note: string; rows: readonly (readonly [string, string])[]; foot?: string }) {
  const [chalk] = useState(newChalk);
  const key = JSON.stringify([title, note, rows, foot]);
  useEffect(() => chalkList(chalk, title, note, rows, foot), [chalk, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => chalk.texture.dispose(), [chalk]);
  const { w, h, legs } = BOARD;
  return (
    <group position={[at.x, y, at.z]} rotation={[0, at.yaw, 0]}>
      {[-1, 1].map(s => <mesh key={s} material={WOOD} position={[s * (w / 2 - 0.05), (legs + h) / 2, -0.04]}><boxGeometry args={[0.07, legs + h, 0.07]} /></mesh>)}
      <mesh material={WOOD} position={[0, legs + h / 2, 0]}><boxGeometry args={[w, h, 0.05]} /></mesh>
      <mesh material={SLATE} position={[0, legs + h / 2, 0.026]}><planeGeometry args={[w - 0.08, h - 0.08]} /></mesh>
      <mesh position={[0, legs + h / 2, 0.028]}>
        <planeGeometry args={[w - 0.1, h - 0.1]} />
        <meshStandardMaterial map={chalk.texture} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

const SHORT: Record<WaterType, string> = { sea: "sea", river: "river", pond: "pond" };
/** The catch board in the world: what bites this hour, redrawn when the hour or the weather turns. */
export function CatchChalk({ at, y, waters, hour, month, weather }: { at: BoardSpot; y: number; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather }) {
  const h = Math.floor(hour) % 24;
  const out = useMemo(() => outNow(waters, h + 0.5, month, weather), [waters, h, month, weather]);
  const pondClosed = useMemo(() => closedNow(waters, h + 0.5, month, weather).length > 0, [waters, h, month, weather]);
  const rows = out.map(({ fish, water }) => [fish.name, SHORT[water]] as const);
  const foot = [out.length > ROWS ? `and ${out.length - ROWS} more` : "", pondClosed ? "Pond fish: mountain, closed" : ""].filter(Boolean).join(" · ");
  return <Chalkboard at={at} y={y} title="Biting now" note={`${String(h).padStart(2, "0")}:00 to ${String((h + 1) % 24).padStart(2, "0")}:00`} rows={rows} foot={foot} />;
}

/** The task board in the world: today's three fishing tasks in chalk, rewritten each Toronto day. */
export function TaskChalk({ at, y, waters }: { at: BoardSpot; y: number; waters: readonly WaterType[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);
  const day = torontoDay(now), week = weekStart(now);
  const tasks = useMemo(() => fishingTasks(day, week, waters), [day, week, waters]);
  const rows = tasks.day.map(t => [`Catch a ${t.name}`, `${t.reward} coins`] as const);
  const big = tasks.week[0];
  return <Chalkboard at={at} y={y} title="Fishing tasks" note="Today" rows={rows} foot={big?.item_key ? `This week: a ${big.name}, and ${tasks.week[1]?.need ?? 8} kinds` : ""} />;
}
