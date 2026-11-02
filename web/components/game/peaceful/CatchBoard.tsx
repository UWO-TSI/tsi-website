"use client";

/**
 * The fish market's boards (d-now; David, 2026-10-28: the board "should be near the fish shop", and "a time graphic with
 * the things available ... icon and you can hover to see what the fish is"): two chalkboards out front of the market
 * (lib/game/wharf.ts marketBoardsOf; the catch board the big one, both the board model of art/props/build_fishing_signs.py). The catch board's chalk lists what bites this hour; E opens the day as a strip
 * (CatchBoardSheet: the kit's TimeStrip, a lane per water, the fish on at each span of hours, each a hover card). The
 * task board's chalk lists today's fishing tasks; E opens them (FishingTasks).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { Clock, CloudFog, CloudRain, Coins, Droplets, Lock, MapPin, Moon, Mountain, Ruler, Snowflake, Sparkles, Sun, Sunrise, Sunset, Waves, Wind } from "lucide-react";
import { RARITY_RANK, ROSTER } from "@/lib/collections/roster";
import { fishOut } from "@/lib/game/peaceful";
import { reelWeather, type IslandWeather } from "@/lib/game/islandWeather";
import type { WaterType } from "@/lib/game/fishingSpots";
import { nextSeason, seasonsOf, type Season } from "@/lib/game/season";
import type { IslandPhase } from "@/lib/game/islandTime";
import { iconFor, type FishDef } from "@/lib/game/fishing";
import { BOARD, FISH_BOARD_URL, waterSignUrl, type BoardSize, type BoardSpot, type SignWater } from "@/lib/game/wharf";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { fishingTasks, speciesSellPrice, torontoDay } from "@/lib/wallet/rules";
import { weekStart } from "@/lib/collections/logic";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { Conditions, FlatPanel, SEASON_LOOK, SeasonDots, TimeStrip, TipBody, type StripLane, type Tint } from "@/components/gui/flat";

const rank = (f: FishDef) => RARITY_RANK[f.rarity as keyof typeof RARITY_RANK] ?? RARITY_RANK.legendary + 1;

/**
 * The pond fish that would bite now in the mountain's pond, on an island with no pond open (David: "pond only in
 * mountain"): listed as closed, never as catchable, until the mountain opens.
 */
export function closedNow(waters: readonly WaterType[], hour: number, season: Season, weather: IslandWeather) {
  return waters.includes("pond") ? [] : outNow(["pond"], hour, season, weather);
}

/** What bites now, rarest first (the chalk's order). */
export function outNow(waters: readonly WaterType[], hour: number, season: Season, weather: IslandWeather): { fish: FishDef; water: WaterType }[] {
  return fishOut(waters, { hour, season, weather: reelWeather(weather) }).sort((a, b) => rank(b.fish) - rank(a.fish) || a.fish.name.localeCompare(b.fish.name));
}

/** A fish on the strip: what the hover card says (`seasons` [] = all year). */
export interface StripFish { key: string; picture: string; rarity: string; label: string; mark: boolean; fish: FishDef; water: WaterType; hours: boolean[]; seasons: Season[] }
/**
 * The day as the board draws it: per water, the fish out this season in this weather grouped by the hours they bite
 * (all day first, then by when they start), rarest first in each. `mark`: it leaves when the season turns, before `soon`
 * (the season a month on).
 */
export function catchLanes(waters: readonly WaterType[], season: Season, weather: IslandWeather, soon: Season = season): { water: WaterType; bands: { id: string; hours: boolean[]; items: StripFish[] }[] }[] {
  return waters.map(water => {
    const hours = new Map<string, { fish: FishDef; hours: boolean[] }>();
    for (let h = 0; h < 24; h++) for (const { fish } of outNow([water], h + 0.5, season, weather)) {
      const row = hours.get(fish.key) ?? { fish, hours: Array<boolean>(24).fill(false) };
      row.hours[h] = true;
      hours.set(fish.key, row);
    }
    const bands = new Map<string, { id: string; hours: boolean[]; items: StripFish[] }>();
    for (const { fish, hours: on } of hours.values()) {
      const id = on.map(Number).join(""), seasons = seasonsOf(ROSTER.find(s => s.key === fish.key)?.months ?? []);
      const band = bands.get(id) ?? { id, hours: on, items: [] };
      band.items.push({ key: fish.key, picture: iconFor(fish), rarity: fish.rarity, label: fish.name, fish, water, hours: on, seasons,
        mark: seasons.length > 0 && !seasons.includes(soon) });
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

const SKY: Record<IslandWeather, [string, React.ReactNode, Tint]> = { clear: ["Clear", <Sun key="w" />, "sky"], rain: ["Rain", <CloudRain key="w" />, "rain"], snow: ["Snow", <Snowflake key="w" />, "ice"], fog: ["Fog", <CloudFog key="w" />, "mist"], wind: ["Windy", <Wind key="w" />, "leaf"] };
const PHASE: Record<IslandPhase, [string, React.ReactNode, Tint]> = { dawn: ["Dawn", <Sunrise key="p" />, "rose"], day: ["Day", <Sun key="p" />, "sun"], evening: ["Evening", <Sunset key="p" />, "amber"], night: ["Night", <Moon key="p" />, "night"] };
const MONTH_SHORT = (m: number) => new Date(2000, m - 1, 15).toLocaleDateString("en-CA", { month: "short" });

/**
 * The catch board read up close: what's true now (the season, the weather, the time of day: all three change what
 * bites), each chip in its colour, then today as a strip, now marked; hover a fish for what it is. `soon`: the season a
 * month on (a fish leaving before it is marked).
 */
export function CatchBoardSheet({ open, onClose, keys, waters, hour, weather, season, soon, phase }: {
  open: boolean; onClose: () => void; keys?: string; waters: readonly WaterType[]; hour: number; weather: IslandWeather; season: Season; soon: Season; phase: IslandPhase;
}) {
  const lanes = useMemo(() => (open ? catchLanes(waters, season, weather, soon) : []), [open, waters, season, weather, soon]);
  const pondShut = useMemo(() => open && !waters.includes("pond"), [open, waters]);
  const strip: StripLane<StripFish>[] = [
    ...lanes.map(l => ({ id: l.water, icon: WATER[l.water].icon, label: WATER[l.water].label, short: SHORT_NAME[l.water], bands: l.bands })),
    ...(pondShut ? [{ id: "pond", icon: WATER.pond.icon, label: WATER.pond.label, short: SHORT_NAME.pond, bands: [], closed: <><Lock size={16} aria-hidden /> Opens with the mountain</> }] : []),
  ];
  const next = nextSeason();
  const now = [
    { icon: SEASON_LOOK[season].icon, label: "Season", value: SEASON_LOOK[season].word, tint: SEASON_LOOK[season].tint, note: `${SEASON_LOOK[next.season].word} on ${MONTH_SHORT(next.month)} ${next.day}` },
    { icon: SKY[weather][1], label: "Weather", value: SKY[weather][0], tint: SKY[weather][2] },
    { icon: PHASE[phase][1], label: "Time of day", value: PHASE[phase][0], tint: PHASE[phase][2] },
  ];
  return <FlatPanel open={open} onClose={onClose} title="Catch board" keys={keys} testId="catch-board">
    <Conditions items={now} />
    <TimeStrip now={hour} lanes={strip} label="What bites when, today" tip={f => <FishTip f={f} season={season} />} />
  </FlatPanel>;
}

function FishTip({ f, season }: { f: StripFish; season: Season }) {
  const price = speciesSellPrice(f.key), size = f.fish.sizeCm;
  return <TipBody picture={f.picture} rarity={f.rarity} kind={RARITY_LABEL[f.rarity as Rarity] ?? f.rarity} name={f.label} facts={[
    [<Clock key="c" size={14} />, hoursText(f.hours)],
    [<MapPin key="w" size={14} />, WHERE[f.water]],
    [<Ruler key="s" size={14} />, `${size[0]} to ${size[1]} cm`],
    ...(price ? [[<Coins key="p" size={14} />, <span key="pv" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{price.toLocaleString()} <CurrencyIcon size={13} /></span>] as const] : []),
    ...(f.mark ? [[<Sparkles key="l" size={14} />, `Gone when ${SEASON_LOOK[season].word.toLowerCase()} ends`] as const] : []),
  ]}>
    <SeasonDots on={f.seasons} now={season} />
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
 * One board at `at`, on the ground `y`, `size` big: the fish market's board model (art/props/build_fishing_signs.py, the
 * catch board's size; the task board at its scale), its chalk `rows` under `title` on the slate in its frame.
 */
export function Chalkboard({ at, y, size, title, note, rows, foot = "" }: { at: BoardSpot; y: number; size: BoardSize; title: string; note: string; rows: readonly ChalkRow[]; foot?: string }) {
  const [chalk] = useState(() => newChalk(size));
  const [loaded, setLoaded] = useState(0);
  const key = JSON.stringify([title, note, rows, foot]);
  useEffect(() => chalkList(chalk, title, note, rows, foot, () => setLoaded(n => n + 1)), [chalk, key, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => chalk.texture.dispose(), [chalk]);
  const { w, h, foot: up } = BOARD.catch;
  return (
    <group position={[at.x, y, at.z]} rotation={[0, at.yaw, 0]} scale={size.w / w}>
      <Suspense fallback={null}><Glb url={FISH_BOARD_URL} /></Suspense>
      <mesh position={[0, up + h / 2, 0.042]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={chalk.texture} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
/** One of our props' models, as the game draws it (its look class and shadows). */
function Glb({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => prepareModel(scene, url), [scene, url]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  return <primitive object={model} />;
}

/** The water signs (lib/game/wharf.ts WATER_SIGNS; the approved round 4 mock): each water's sign where it is fished. */
export function WaterSigns({ signs, ground }: { signs: readonly (BoardSpot & { water: SignWater })[]; ground: (x: number, z: number) => number }) {
  return <Suspense fallback={null}>
    {signs.map(sg => <group key={sg.water} position={[sg.x, ground(sg.x, sg.z), sg.z]} rotation={[0, sg.yaw, 0]}><Glb url={waterSignUrl(sg.water)} /></group>)}
  </Suspense>;
}

const SHORT: Record<WaterType, string> = { sea: "sea", river: "river", pond: "pond" };
/** The catch board in the world: what bites this hour, redrawn when the hour or the weather turns. */
export function CatchChalk({ at, y, waters, hour, season, weather }: { at: BoardSpot; y: number; waters: readonly WaterType[]; hour: number; season: Season; weather: IslandWeather }) {
  const h = Math.floor(hour) % 24;
  const out = useMemo(() => outNow(waters, h + 0.5, season, weather), [waters, h, season, weather]);
  const pondClosed = useMemo(() => closedNow(waters, h + 0.5, season, weather).length > 0, [waters, h, season, weather]);
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
