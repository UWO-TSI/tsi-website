"use client";

/**
 * The fish market's boards (d-now; David, 2026-10-28: the board "should be near the fish shop", and "a time graphic with
 * the things available ... icon and you can hover to see what the fish is"): two chalkboards out front of the market
 * (lib/game/wharf.ts marketBoardsOf; the catch board the big one, under a little roof). The catch board's chalk lists what bites this hour; E opens the day as a strip
 * (CatchBoardSheet: the kit's TimeStrip, a lane per water, the fish on at each span of hours, each a hover card). The
 * task board's chalk lists today's fishing tasks; E opens them (FishingTasks). Plain wood and slate, no texture but the
 * chalk (lane rules: textures only where they show).
 */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Clock, CloudFog, CloudRain, Coins, Droplets, Flower2, Leaf, Lock, MapPin, Moon, Mountain, Ruler, Snowflake, Sparkles, Sun, Sunrise, Sunset, Waves, Wind } from "lucide-react";
import { RARITY_RANK, ROSTER } from "@/lib/collections/roster";
import { fishOut } from "@/lib/game/peaceful";
import { reelWeather, type IslandWeather } from "@/lib/game/islandWeather";
import type { WaterType } from "@/lib/game/fishingSpots";
import type { Season } from "@/lib/game/season";
import type { IslandPhase } from "@/lib/game/islandTime";
import { iconFor, type FishDef } from "@/lib/game/fishing";
import { BOARD, type BoardSize, type BoardSpot } from "@/lib/game/wharf";
import { fishingTasks, speciesSellPrice, torontoDay } from "@/lib/wallet/rules";
import { weekStart } from "@/lib/collections/logic";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { Conditions, FlatPanel, MonthDots, TimeStrip, TipBody, type StripLane } from "@/components/gui/flat";

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
const SHORT_NAME: Record<WaterType, string> = { sea: "Sea", river: "River", pond: "Pond" };

const SEASON: Record<Season, [string, React.ReactNode]> = { spring: ["Spring", <Flower2 key="s" />], summer: ["Summer", <Sun key="s" />], autumn: ["Autumn", <Leaf key="s" />], winter: ["Winter", <Snowflake key="s" />] };
const SKY: Record<IslandWeather, [string, React.ReactNode]> = { clear: ["Clear", <Sun key="w" />], rain: ["Rain", <CloudRain key="w" />], snow: ["Snow", <Snowflake key="w" />], fog: ["Fog", <CloudFog key="w" />], wind: ["Windy", <Wind key="w" />] };
const PHASE: Record<IslandPhase, [string, React.ReactNode]> = { dawn: ["Dawn", <Sunrise key="p" />], day: ["Day", <Sun key="p" />], evening: ["Evening", <Sunset key="p" />], night: ["Night", <Moon key="p" />] };
const MONTH = (m: number) => new Date(2000, m - 1, 15).toLocaleDateString("en-CA", { month: "long" });

/**
 * The catch board read up close: what's true now (the season and month, the weather, the time of day: all three change
 * what bites), then today as a strip, now marked; hover a fish for what it is.
 */
export function CatchBoardSheet({ open, onClose, keys, waters, hour, month, weather, season, phase }: {
  open: boolean; onClose: () => void; keys?: string; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather; season: Season; phase: IslandPhase;
}) {
  const lanes = useMemo(() => (open ? catchLanes(waters, month, weather) : []), [open, waters, month, weather]);
  const pondShut = useMemo(() => open && !waters.includes("pond"), [open, waters]);
  const strip: StripLane<StripFish>[] = [
    ...lanes.map(l => ({ id: l.water, icon: WATER[l.water].icon, label: WATER[l.water].label, short: SHORT_NAME[l.water], bands: l.bands })),
    ...(pondShut ? [{ id: "pond", icon: WATER.pond.icon, label: WATER.pond.label, short: SHORT_NAME.pond, bands: [], closed: <><Lock size={16} aria-hidden /> Opens with the mountain</> }] : []),
  ];
  const now = [
    { icon: SEASON[season][1], label: "Season", value: `${SEASON[season][0]}, ${MONTH(month)}` },
    { icon: SKY[weather][1], label: "Weather", value: SKY[weather][0] },
    { icon: PHASE[phase][1], label: "Time of day", value: PHASE[phase][0] },
  ];
  return <FlatPanel open={open} onClose={onClose} title="Catch board" keys={keys} testId="catch-board">
    <Conditions items={now} />
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

const PX = 512;
const FONT = '"Tethos Nunito", Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif';
const CHALK = { slate: "#2f3b36", ink: "#f2efe4", soft: "#c9d4c6" };
/** A chalk row: its words, a quiet end, and a picture (a fish's icon) drawn before the words when it has loaded. */
type ChalkRow = readonly [main: string, end: string, picture?: string];
/** A board's chalk, a canvas texture as wide as PX and as tall as the slate's shape, drawn by `chalkList`. */
function newChalk(size: BoardSize) {
  const canvas = Object.assign(document.createElement("canvas"), { width: PX, height: Math.round((PX * size.h) / size.w) });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture };
}
/** Pictures for the chalk, loaded once; `onLoad` redraws the board that asked. */
const PICTURES = new Map<string, HTMLImageElement>();
function picture(src: string, onLoad: () => void): HTMLImageElement | null {
  let img = PICTURES.get(src);
  if (!img) { img = new Image(); img.src = src; PICTURES.set(src, img); }
  if (img.complete && img.naturalWidth) return img;
  img.addEventListener("load", onLoad, { once: true });
  return null;
}
const ROW = 44, TOP = 76;
/** How many rows a board's chalk holds under its title, leaving the foot. */
const rowsOn = (size: BoardSize) => Math.floor((Math.round((PX * size.h) / size.w) - TOP - 34) / ROW);
/** A title, a quiet note at its right, a rule, then as many rows as fit (a picture, the words, a quiet end) and a quiet foot. */
function chalkList({ canvas, texture }: ReturnType<typeof newChalk>, title: string, note: string, rows: readonly ChalkRow[], foot: string, redraw: () => void) {
  texture.needsUpdate = true;
  const g = canvas.getContext("2d")!, W = canvas.width, H = canvas.height, fit = Math.floor((H - TOP - 34) / ROW);
  g.fillStyle = CHALK.slate;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  g.fillStyle = CHALK.ink;
  g.font = `800 40px ${FONT}`;
  g.fillText(title, 22, 34);
  g.font = `600 24px ${FONT}`;
  g.fillStyle = CHALK.soft;
  g.textAlign = "right";
  g.fillText(note, W - 22, 36);
  g.textAlign = "left";
  g.globalAlpha = 0.7;
  g.fillRect(22, 62, W - 44, 2.5);
  g.globalAlpha = 1;
  rows.slice(0, fit).forEach(([main, end, src], i) => {
    const y = TOP + i * ROW + ROW / 2, img = src ? picture(src, redraw) : null;
    if (img) g.drawImage(img, 22, y - 19, 38, 38);
    const x = src ? 70 : 24;
    g.fillStyle = CHALK.ink;
    g.font = `700 28px ${FONT}`;
    g.fillText(main, x, y, W - x - 130);
    g.fillStyle = CHALK.soft;
    g.font = `600 22px ${FONT}`;
    g.textAlign = "right";
    g.fillText(end, W - 24, y + 1);
    g.textAlign = "left";
  });
  if (foot) {
    g.fillStyle = CHALK.soft;
    g.font = `600 22px ${FONT}`;
    g.fillText(foot, 24, H - 22, W - 48);
  }
}

/**
 * A board's wood, one merged mesh (one draw): two posts, the frame round the slate, a cross brace low down, a ledge
 * with its chalk under the slate, a header plank, and a small pitched roof over the top that keeps the rain off, as a
 * wharf notice board has. The slate (the chalk's canvas) sits in the frame's face.
 */
function boardGeometry({ w, h, foot }: BoardSize): THREE.BufferGeometry {
  const box = (bw: number, bh: number, bd: number, x: number, y: number, z: number, rz = 0, rx = 0) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return g;
  };
  const post = 0.06 + w * 0.03, top = foot + h + 0.34, edge = w / 2 + post / 2 + 0.02, rafter = Math.hypot(edge + 0.2, 0.22);
  return mergeGeometries([
    box(post, top, post, -edge, top / 2, -0.03), box(post, top, post, edge, top / 2, -0.03),                 // the posts
    box(w + 0.1, 0.07, 0.08, 0, foot - 0.02, 0), box(w + 0.1, 0.07, 0.08, 0, foot + h + 0.02, 0),           // the frame, top and bottom
    box(0.07, h + 0.1, 0.08, -(w / 2 + 0.02), foot + h / 2, 0), box(0.07, h + 0.1, 0.08, w / 2 + 0.02, foot + h / 2, 0),
    box(w, h, 0.03, 0, foot + h / 2, -0.03),                                                              // the back
    box(w * 0.92, 0.035, 0.12, 0, foot - 0.07, 0.07),                                                        // the chalk ledge
    box(w + 0.1, 0.06, 0.05, 0, 0.32, -0.03),                                                             // the brace
    box(w + 0.36, 0.2, 0.06, 0, foot + h + 0.18, 0.01),                                                   // the header plank
    box(rafter + 0.1, 0.045, 0.5, -(edge + 0.2) / 2 + 0.02, top + 0.11, -0.02, Math.atan2(0.22, edge + 0.2)),   // the roof, two pitches
    box(rafter + 0.1, 0.045, 0.5, (edge + 0.2) / 2 - 0.02, top + 0.11, -0.02, -Math.atan2(0.22, edge + 0.2)),
  ])!;
}
const WOOD = new THREE.MeshStandardMaterial({ color: "#8a5a36", roughness: 0.9, metalness: 0 });
const CHALK_STICK = new THREE.MeshStandardMaterial({ color: CHALK.ink, roughness: 1, metalness: 0 });

/** One board at `at`, on the ground `y`, `size` big, its chalk `rows` under `title`. */
export function Chalkboard({ at, y, size, title, note, rows, foot = "" }: { at: BoardSpot; y: number; size: BoardSize; title: string; note: string; rows: readonly ChalkRow[]; foot?: string }) {
  const [chalk] = useState(() => newChalk(size));
  const wood = useMemo(() => boardGeometry(size), [size]);
  const [loaded, setLoaded] = useState(0);
  const key = JSON.stringify([title, note, rows, foot]);
  useEffect(() => chalkList(chalk, title, note, rows, foot, () => setLoaded(n => n + 1)), [chalk, key, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { chalk.texture.dispose(); wood.dispose(); }, [chalk, wood]);
  const { w, h, foot: up } = size;
  return (
    <group position={[at.x, y, at.z]} rotation={[0, at.yaw, 0]}>
      <mesh geometry={wood} material={WOOD} castShadow />
      <mesh position={[0, up + h / 2, 0.042]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={chalk.texture} roughness={1} metalness={0} />
      </mesh>
      <mesh material={CHALK_STICK} position={[w * 0.28, up - 0.03, 0.09]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.09, 6]} /></mesh>
    </group>
  );
}

const SHORT: Record<WaterType, string> = { sea: "sea", river: "river", pond: "pond" };
/** The catch board in the world: what bites this hour, redrawn when the hour or the weather turns. */
export function CatchChalk({ at, y, waters, hour, month, weather }: { at: BoardSpot; y: number; waters: readonly WaterType[]; hour: number; month: number; weather: IslandWeather }) {
  const h = Math.floor(hour) % 24;
  const out = useMemo(() => outNow(waters, h + 0.5, month, weather), [waters, h, month, weather]);
  const pondClosed = useMemo(() => closedNow(waters, h + 0.5, month, weather).length > 0, [waters, h, month, weather]);
  const rows = out.map(({ fish, water }) => [fish.name, SHORT[water], iconFor(fish)] as const), fit = rowsOn(BOARD.catch);
  const foot = [out.length > fit ? `and ${out.length - fit} more` : "", pondClosed ? "Pond fish: mountain, closed" : ""].filter(Boolean).join(" · ");
  return <Chalkboard at={at} y={y} size={BOARD.catch} title="Biting now" note={`${String(h).padStart(2, "0")}:00 to ${String((h + 1) % 24).padStart(2, "0")}:00`} rows={rows} foot={foot} />;
}

/** The task board in the world: today's three fishing tasks in chalk, rewritten each Toronto day. */
export function TaskChalk({ at, y, waters }: { at: BoardSpot; y: number; waters: readonly WaterType[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);
  const day = torontoDay(now), week = weekStart(now);
  const tasks = useMemo(() => fishingTasks(day, week, waters), [day, week, waters]);
  const rows = tasks.day.map(t => [`Catch a ${t.name}`, `${t.reward} coins`] as const);
  const big = tasks.week[0];
  return <Chalkboard at={at} y={y} size={BOARD.tasks} title="Fishing tasks" note="Today" rows={rows} foot={big?.item_key ? `This week: a ${big.name}, and ${tasks.week[1]?.need ?? 8} kinds` : ""} />;
}
