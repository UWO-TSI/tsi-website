"use client";

/**
 * The top right's pieces (hud-first-login §2, row 124): the island clock `HudClock`, under the minimap, and the wallet
 * `HudWallet` under the clock. The level and its XP are the HUD's bars (HudBars); Settings and mail are in the UI view's
 * dock (round 8: the gear that sat here moved into the dock, so the cluster itself is gone).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudFog, CloudRain, Moon, Snowflake, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { useHud } from "@/lib/game/hudStore";
import { worldNow } from "@/lib/game/worldClock";
import { AudioManager } from "@/lib/game/audio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { FLASH_MS } from "@/lib/game/hudPrefs";
import { BuffChip, WalletSlot } from "@/components/gui/flat";
import { mealRows } from "@/components/economy/statIcons";
import { useMeal } from "@/lib/game/mealStore";
import { mealOf } from "@/lib/wallet/catalogue";
import { useFlash } from "./useFlash";
import styles from "./TopCluster.module.css";

const WEATHER_NAME: Record<IslandWeather, string> = { clear: "Clear", fog: "Foggy", rain: "Rain", snow: "Snow", wind: "Windy" };
const PHASE_NAME: Record<IslandPhase, string> = { dawn: "dawn", day: "daytime", evening: "evening", night: "night" };
function WeatherIcon({ weather, phase }: { weather: IslandWeather; phase: IslandPhase }) {
  const Icon = weather === "fog" ? CloudFog : weather === "rain" ? CloudRain : weather === "snow" ? Snowflake : weather === "wind" ? Wind
    : phase === "night" ? Moon : phase === "dawn" ? Sunrise : phase === "evening" ? Sunset : Sun;
  return <Icon size={18} aria-hidden />;
}

/** A short-lived "+N" ping when a number goes up (not on its first load). */
function useGain(value: number | null) {
  const last = useRef(value);
  const [gain, setGain] = useState<{ amount: number; id: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = value;
    if (prev === null || value === null || value <= prev) return;
    setGain({ amount: value - prev, id: value });
    const t = window.setTimeout(() => setGain(null), 1600);
    return () => window.clearTimeout(t);
  }, [value]);
  return gain;
}

/** World-clock time, re-read on each minute boundary (and on return to the tab). */
const minuteNow = () => Math.floor(worldNow() / 60_000);
function subscribeMinute(on: () => void) {
  let t = 0;
  const arm = () => { t = window.setTimeout(() => { on(); arm(); }, 60_000 - (worldNow() % 60_000) + 50); };
  arm();
  document.addEventListener("visibilitychange", on);
  return () => { window.clearTimeout(t); document.removeEventListener("visibilitychange", on); };
}
const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short", month: "short", day: "numeric" });

/**
 * The island's time and its sky (playtest round 1: "time sun"), always on under the minimap: the hour on the world
 * clock and the weather or the sun's place in the day, the date on hover.
 */
export function HudClock({ weather, phase, className }: { weather: IslandWeather; phase: IslandPhase; className?: string }) {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => 0);
  if (minute <= 0) return null;
  const when = new Date(minute * 60_000);
  return <p className={className ?? styles.time} title={`${DATE.format(when)} · ${WEATHER_NAME[weather]}, ${PHASE_NAME[phase]} on the island`}>
    <WeatherIcon weather={weather} phase={phase} /><b>{TIME.format(when)}</b><span className={styles.srOnly}>{WEATHER_NAME[weather]}</span>
  </p>;
}

/**
 * The wallet, coins and gems (design bible UI 8b): its slot top right directly under the time. In the UI view (`full`)
 * it rests there; at rest it slides in when coins or gems change, counts, and slides away after about 2 s. `showcase`:
 * a fly-in (Alice's coins and gems) is on its way to it: it slides in with that cell empty, the icon clicks in as the
 * FlyIn lands, the count ticks, and it slides away after. A cinematic fades it with the rest of the top right.
 */
export function HudWallet({ full, showcase = null, onWallet, walletKey }: {
  full: boolean; showcase?: "coins" | "gems" | null;
  onWallet?: () => void; walletKey?: string;
}) {
  const hud = useHud();
  const coinGain = useGain(hud.coins), gemGain = useGain(hud.gems);
  useEffect(() => { if (coinGain || gemGain) AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.6 }); }, [coinGain, gemGain]);
  const coins = useFlash(hud.coins, FLASH_MS.coins), gems = useFlash(hud.gems, FLASH_MS.coins);
  // The showcase holds it in, then it stays a moment as the count ticks, and slides away.
  const [shown, setShown] = useState<{ kind: "coins" | "gems"; out: boolean } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the wallet follows the showcase in, then lingers to slide out
    if (showcase) { setShown({ kind: showcase, out: false }); return; }
    const out = window.setTimeout(() => setShown(s => (s ? { ...s, out: true } : s)), 900);
    const gone = window.setTimeout(() => setShown(null), 1300);
    return () => { window.clearTimeout(out); window.clearTimeout(gone); };
  }, [showcase]);
  const at = full && !shown ? undefined : shown ? (shown.out ? "out" : "in") : coins === "in" || gems === "in" ? "in" : coins ?? gems ?? null;
  // Signed out (a preview) there's no wallet to show, unless Alice is showing it to you.
  if (at === null || (hud.coins === null && hud.gems === null && !shown)) return null;
  return <WalletSlot coins={hud.coins ?? 0} gems={hud.gems ?? 0} at={at} landing={shown?.kind ?? null}
    onOpen={onWallet} title={walletKey ? `Wallet (${walletKey})` : "Wallet"} />;
}

const wallMinute = () => Math.floor(Date.now() / 60_000);
/**
 * The meal you ate (design bible UI 8b's right side, tasting-book r3: "buff will show on the right side of the screen with
 * icon, timer and percent, its like very faint"): its stats and the minutes left, faint, gone when it runs out.
 */
export function HudBuff({ className }: { className?: string }) {
  const buff = useMeal(), meal = mealOf(buff?.source), minute = useSyncExternalStore(subscribeMinute, wallMinute, () => 0);
  if (!buff || !meal || minute <= 0) return null;
  const left = Math.max(1, Math.ceil((new Date(buff.until).getTime() - minute * 60_000) / 60_000)), rows = mealRows(meal.buff);
  return <div className={className} data-hud-buff="">
    <BuffChip stats={rows} left={`${left}m`} title={`${meal.name}: ${rows.map(r => `${r.label} ${r.value}`).join(", ")}, ${left} min left`} />
  </div>;
}
