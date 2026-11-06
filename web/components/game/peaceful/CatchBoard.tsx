"use client";

/**
 * The fish market's boards (d-now; David, 2026-10-28: the board "should be near the fish shop", and "a time graphic with
 * the things available ... icon and you can hover to see what the fish is"): two chalkboards out front of the market
 * (lib/game/wharf.ts marketBoardsOf; the catch board the big one, both the board model of art/props/build_fish_board.py). The catch board's chalk shows what bites this hour, in pictures; E opens the day as a strip
 * (CatchBoardSheet: the kit's TimeStrip, a lane per water, the fish on at each span of hours, each a hover card). The
 * task board's chalk lists today's fishing tasks; E opens them (FishingTasks).
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { Clock, CloudFog, CloudRain, Coins, Lock, MapPin, Moon, Ruler, Snowflake, Sparkles, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { RARITY_RANK, ROSTER } from "@/lib/collections/roster";
import { fishOut } from "@/lib/game/peaceful";
import { reelWeather, type IslandWeather } from "@/lib/game/islandWeather";
import type { WaterType } from "@/lib/game/fishingSpots";
import { nextSeason, seasonsOf, type Season } from "@/lib/game/season";
import type { IslandPhase } from "@/lib/game/islandTime";
import { RARITY_META, iconFor, type FishDef } from "@/lib/game/fishing";
import { BOARD, FISH_BOARD_URL, SELL_FISH_URL, type BoardSize, type BoardSpot } from "@/lib/game/wharf";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { fishingTasks, speciesSellPrice, torontoDay } from "@/lib/wallet/rules";
import { weekStart } from "@/lib/collections/logic";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { BIOME_LOOK, Conditions, FlatPanel, SEASON_LOOK, SeasonDots, TimeStrip, TipBody, type StripLane, type Tint } from "@/components/gui/flat";

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

const WATER: Record<WaterType, string> = { sea: "The sea, off the pier and the beach", river: "The river", pond: "The mountain pond" };
const WHERE: Record<WaterType, string> = { sea: "Sea", river: "River", pond: "Mountain pond" };

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
    ...lanes.map(l => ({ id: l.water, icon: BIOME_LOOK[l.water].icon, label: WATER[l.water], short: BIOME_LOOK[l.water].word, bands: l.bands })),
    ...(pondShut ? [{ id: "pond", icon: BIOME_LOOK.pond.icon, label: WATER.pond, short: BIOME_LOOK.pond.word, bands: [], closed: <><Lock size={16} aria-hidden /> Opens with the mountain</> }] : []),
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
const CHALK = { slate: "#2f3b36", tile: "#3a4842", ink: "#f2efe4", soft: "#c9d4c6" };
/** Paints a board's chalk on the slate (already wiped); `redraw` paints it again (a picture it asked for has loaded). */
type ChalkDraw = (g: CanvasRenderingContext2D, w: number, h: number, redraw: () => void) => void;
/** A board's chalk, a canvas texture as wide as PX and as tall as the slate's shape. */
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

/** A chalk list (the task board): a title, a quiet note at its right, a rule, as many rows as fit (the words, a quiet end) and a quiet foot. */
function chalkList(g: CanvasRenderingContext2D, W: number, H: number, title: string, note: string, rows: readonly (readonly [string, string])[], foot: string) {
  const ROW = 44, TOP = 76, fit = Math.floor((H - TOP - 34) / ROW);
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
  rows.slice(0, fit).forEach(([main, end], i) => {
    const y = TOP + i * ROW + ROW / 2;
    g.fillStyle = CHALK.ink;
    g.font = `700 28px ${FONT}`;
    g.fillText(main, 24, y, W - 24 - 130);
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

/** Chalk strokes: round ends, the ink's colour. */
function stroke(g: CanvasRenderingContext2D, width: number, colour: string = CHALK.ink) {
  g.lineWidth = width;
  g.lineCap = g.lineJoin = "round";
  g.strokeStyle = colour;
}
/** A clock face at (x, y), radius r, its hand on `hour` (and the minute hand on the hour). */
function chalkClock(g: CanvasRenderingContext2D, x: number, y: number, r: number, hour: number) {
  stroke(g, 4);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  const a = ((hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.stroke();
  stroke(g, 3);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.75); g.stroke();
}
/** A water's mark, `s` across, centred on (x, y): the sea's two waves, the river's drop, the pond's mountain. */
function chalkWater(g: CanvasRenderingContext2D, water: WaterType, x: number, y: number, s: number, colour: string = CHALK.soft) {
  stroke(g, Math.max(2, s / 7), colour);
  g.beginPath();
  if (water === "sea") for (const dy of [-s * 0.18, s * 0.18]) {
    g.moveTo(x - s / 2, y + dy);
    g.bezierCurveTo(x - s / 4, y + dy - s * 0.22, x - s / 8, y + dy + s * 0.22, x, y + dy);
    g.bezierCurveTo(x + s / 8, y + dy - s * 0.22, x + s / 4, y + dy + s * 0.22, x + s / 2, y + dy);
  }
  else if (water === "river") {
    g.moveTo(x, y - s / 2);
    g.bezierCurveTo(x + s * 0.45, y, x + s * 0.4, y + s / 2, x, y + s / 2);
    g.bezierCurveTo(x - s * 0.4, y + s / 2, x - s * 0.45, y, x, y - s / 2);
  }
  else { g.moveTo(x - s / 2, y + s / 3); g.lineTo(x - s / 8, y - s / 3); g.lineTo(x + s / 8, y); g.lineTo(x + s / 4, y - s / 6); g.lineTo(x + s / 2, y + s / 3); g.closePath(); }
  g.stroke();
}
/** A padlock, `s` tall, centred on (x, y). */
function chalkLock(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  stroke(g, Math.max(2, s / 8));
  g.beginPath(); g.arc(x, y - s * 0.12, s * 0.22, Math.PI, 0); g.stroke();
  g.beginPath(); g.roundRect(x - s * 0.34, y - s * 0.12, s * 0.68, s * 0.5, s * 0.08); g.stroke();
}
/** A rounded tile, its edge `edge` (a rarity's colour) when given. */
function chalkTile(g: CanvasRenderingContext2D, x: number, y: number, s: number, edge?: string) {
  g.beginPath(); g.roundRect(x, y, s, s, 12);
  g.fillStyle = CHALK.tile; g.fill();
  if (edge) { stroke(g, 3, edge); g.stroke(); }
}

const TILE = 70, GAP = 10, COLS = 6, GRID_TOP = 76;
/**
 * The catch board's chalk, pictures only (round 6, David: "make it no text just simple icons"): a clock on the hour up
 * top, then what bites now as tiles, rarest first, each the fish's icon edged in its rarity with its water's mark in the
 * corner; three dots when there are more than fit; the mountain's pond, shut, as a lock over its mountain.
 */
function chalkIcons(g: CanvasRenderingContext2D, W: number, H: number, hour: number, fish: readonly { picture: string; rarity: string; water: WaterType }[], pondShut: boolean, redraw: () => void) {
  chalkClock(g, 44, 36, 24, hour);
  g.globalAlpha = 0.7;
  g.fillStyle = CHALK.ink;
  g.fillRect(84, 35, W - 106, 2.5);
  g.globalAlpha = 1;
  const x0 = (W - (COLS * TILE + (COLS - 1) * GAP)) / 2, rows = Math.floor((H - GRID_TOP + GAP) / (TILE + GAP)), fit = rows * COLS;
  const shown = fish.length + (pondShut ? 1 : 0) > fit ? fish.slice(0, fit - 1 - (pondShut ? 1 : 0)) : fish;
  const at = (i: number) => [x0 + (i % COLS) * (TILE + GAP), GRID_TOP + Math.floor(i / COLS) * (TILE + GAP)] as const;
  shown.forEach((f, i) => {
    const [x, y] = at(i), img = picture(f.picture, redraw);
    chalkTile(g, x, y, TILE, RARITY_META[f.rarity as Rarity]?.color);
    if (img) g.drawImage(img, x + 6, y + 4, TILE - 12, TILE - 12);
    chalkWater(g, f.water, x + TILE - 14, y + TILE - 13, 15);
  });
  let next = shown.length;
  if (shown.length < fish.length) {
    const [x, y] = at(next++);
    chalkTile(g, x, y, TILE);
    g.fillStyle = CHALK.ink;
    for (const dx of [-16, 0, 16]) { g.beginPath(); g.arc(x + TILE / 2 + dx, y + TILE / 2, 4.5, 0, Math.PI * 2); g.fill(); }
  }
  if (pondShut) {
    const [x, y] = at(next);
    chalkTile(g, x, y, TILE);
    chalkWater(g, "pond", x + TILE / 2, y + TILE / 2 + 12, 34);
    chalkLock(g, x + TILE / 2, y + TILE / 2 - 10, 30);
  }
}

/** Wipe the slate and chalk it again. */
function paint({ canvas, texture }: ReturnType<typeof newChalk>, draw: ChalkDraw, redraw: () => void) {
  const g = canvas.getContext("2d")!;
  texture.needsUpdate = true;
  g.fillStyle = CHALK.slate;
  g.fillRect(0, 0, canvas.width, canvas.height);
  draw(g, canvas.width, canvas.height, redraw);
}

/**
 * One board at `at`, on the ground `y`, `size` big: the fish market's board model (art/props/build_fish_board.py, the
 * catch board's size; the task board at its scale), its golden ridge fish swaying, and the chalk `draw` paints on the
 * slate in its frame, painted again when `drawKey` changes.
 */
function Chalkboard({ at, y, size, draw, drawKey }: { at: BoardSpot; y: number; size: BoardSize; draw: ChalkDraw; drawKey: string }) {
  const [chalk] = useState(() => newChalk(size));
  const [loaded, setLoaded] = useState(0);
  useEffect(() => paint(chalk, draw, () => setLoaded(n => n + 1)), [chalk, drawKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => chalk.texture.dispose(), [chalk]);
  const { w, h, foot: up } = BOARD.catch;
  return (
    <group position={[at.x, y, at.z]} rotation={[0, at.yaw, 0]} scale={size.w / w}>
      <Suspense fallback={null}><Glb url={FISH_BOARD_URL} animate={swayRidgeFish} /></Suspense>
      <mesh position={[0, up + h / 2, 0.042]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={chalk.texture} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
/** One of our props' models, as the game draws it (its look class and shadows); `animate` moves its parts each frame. */
function Glb({ url, animate }: { url: string; animate?: (model: THREE.Object3D, t: number) => void }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => prepareModel(scene, url), [scene, url]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  useFrame(({ clock }) => animate?.(model, clock.elapsedTime));
  return <primitive object={model} />;
}
/** A part of a model by name, found once. */
const part = (model: THREE.Object3D, name: string) => (model.userData[name] ??= model.getObjectByName(name) ?? null) as THREE.Object3D | null;
/** The golden fish on the board's ridge sways a little (round 6, David: "i want the fish on top to like kidna move a bit"), as if in a breeze. */
function swayRidgeFish(model: THREE.Object3D, t: number) {
  const f = part(model, "ridge-fish");
  if (!f) return;
  f.rotation.y = 0.2 * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 2.3);
  f.rotation.z = 0.07 * Math.sin(t * 1.6 + 0.8);
}

const FLOP_Q = new THREE.Quaternion(), FLOP_E = new THREE.Euler();
/** Each flopping fish: how often it flops (s), when its first comes, and which way it rolls. */
const FLOPS = [[3.7, 0.4, 1], [5.3, 2.1, -1], [6.1, 4.2, 1]] as const;
const FLOP_S = 0.75;
/**
 * The three fish on top of the sell bin's heap flop now and then (round 6, David: "i wand the fish in the sell bin to flop
 * around"): each hops, rolls up off the ice and back, its tail thrashing, then lies still till its next.
 */
function flopFish(model: THREE.Object3D, t: number) {
  FLOPS.forEach(([every, first, side], i) => {
    const f = part(model, `flop-${i}`);
    if (!f) return;
    const rest = (f.userData.rest ??= { p: f.position.clone(), q: f.quaternion.clone() }) as { p: THREE.Vector3; q: THREE.Quaternion };
    const k = Math.min(1, (((t + every - first) % every) / FLOP_S)), up = Math.sin(Math.PI * k);
    f.position.set(rest.p.x, rest.p.y + 0.07 * up, rest.p.z);
    f.quaternion.copy(rest.q).multiply(FLOP_Q.setFromEuler(FLOP_E.set(side * 0.85 * up, 0.5 * Math.sin(3 * Math.PI * k) * (1 - k), 0)));
  });
}
/** The sell bin's flopping fish (art/wharf/build_sell_stall.py FLOPPERS), in the stall's frame at `at` on the ground `y`. */
export function SellBinFish({ at, y }: { at: { x: number; z: number; yaw?: number }; y: number }) {
  return <group position={[at.x, y, at.z]} rotation={[0, at.yaw ?? 0, 0]}>
    <Suspense fallback={null}><Glb url={SELL_FISH_URL} animate={flopFish} /></Suspense>
  </group>;
}

/** The catch board in the world: what bites this hour, in pictures, redrawn when the hour or the weather turns. */
export function CatchChalk({ at, y, waters, hour, season, weather }: { at: BoardSpot; y: number; waters: readonly WaterType[]; hour: number; season: Season; weather: IslandWeather }) {
  const h = Math.floor(hour) % 24;
  const fish = useMemo(() => outNow(waters, h + 0.5, season, weather).map(({ fish: f, water }) => ({ picture: iconFor(f), rarity: f.rarity, water })), [waters, h, season, weather]);
  const pondShut = useMemo(() => closedNow(waters, h + 0.5, season, weather).length > 0, [waters, h, season, weather]);
  const draw = useCallback<ChalkDraw>((g, W, H, redraw) => chalkIcons(g, W, H, h, fish, pondShut, redraw), [h, fish, pondShut]);
  return <Chalkboard at={at} y={y} size={BOARD.catch} draw={draw} drawKey={JSON.stringify([h, fish, pondShut])} />;
}

/** The task board in the world: today's three fishing tasks in chalk, rewritten each Toronto day. */
export function TaskChalk({ at, y, waters }: { at: BoardSpot; y: number; waters: readonly WaterType[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);
  const day = torontoDay(now), week = weekStart(now);
  const tasks = useMemo(() => fishingTasks(day, week, waters), [day, week, waters]);
  const rows = tasks.day.map(t => [`Catch a ${t.name}`, `${t.reward} coins`] as const);
  const big = tasks.week[0];
  const foot = big?.item_key ? `This week: a ${big.name}, and ${tasks.week[1]?.need ?? 8} kinds` : "";
  const draw = useCallback<ChalkDraw>((g, W, H) => chalkList(g, W, H, "Fishing tasks", "Today", rows, foot), [rows, foot]);
  return <Chalkboard at={at} y={y} size={BOARD.tasks} draw={draw} drawKey={JSON.stringify([rows, foot])} />;
}
