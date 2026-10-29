"use client";

/**
 * The cream top cluster (hud-first-login §2, row 124): the level with its XP,
 * then the caller's buttons (the gear). XP fills instead of jumping; a gain pings.
 *
 * The minimal HUD (`full` false; rows 283 and playtest round 1): nothing shows
 * while you play; XP slides in on a gain, then fades. The full one (the UI view,
 * Esc 1; the HUD key held; the setting) shows it, and the caller's buttons
 * (`buttons`, default `full`). The island clock is `HudClock`, under the minimap,
 * and the wallet `HudWallet` under the clock; mail is in the UI view's dock.
 *
 * `hidden`: a cinematic moment (talking, the greeting, the boat trip; world
 * audit item 7), where the whole cluster fades out, flashes included.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CloudFog, CloudRain, Moon, Snowflake, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { levelProgress } from "@/lib/combat/progression";
import { useHud } from "@/lib/game/hudStore";
import { worldNow } from "@/lib/game/worldClock";
import { AudioManager } from "@/lib/game/audio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { FLASH_MS } from "@/lib/game/hudPrefs";
import { WalletSlot } from "@/components/gui/flat";
import { useFlash } from "./useFlash";
import styles from "./TopCluster.module.css";

/** The round cream button class, for the buttons a caller puts in the cluster. */
export const hudButton = styles.button;

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

const up = (a: unknown, b: unknown) => (b as number) > (a as number);

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
 * FlyIn lands, the count ticks, and it slides away after.
 */
export function HudWallet({ full, hidden, showcase = null, onWallet, walletKey }: {
  full: boolean; hidden?: boolean; showcase?: "coins" | "gems" | null;
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
  if (hidden || at === null || (hud.coins === null && hud.gems === null && !shown)) return null;
  return <WalletSlot coins={hud.coins ?? 0} gems={hud.gems ?? 0} at={at} landing={shown?.kind ?? null}
    onOpen={onWallet} title={walletKey ? `Wallet (${walletKey})` : "Wallet"} />;
}

export default function TopCluster({ full = true, buttons = full, hidden = false, className, children }: {
  full?: boolean; buttons?: boolean; hidden?: boolean; className?: string; children?: ReactNode;
}) {
  const hud = useHud();
  const progress = hud.xp === null ? null : levelProgress(hud.xp);
  const xpGain = useGain(hud.xp);
  const levelUp = useGain(progress?.level ?? null);
  useEffect(() => { if (levelUp) AudioManager.playSFX("confirm"); }, [levelUp]);
  const fill = progress ? (progress.needed ? progress.into / progress.needed : 1) : 0;
  const flash = { xp: useFlash(hud.xp, FLASH_MS.xp, up) };
  /** In the minimal HUD a part shows only while its change is (its flash state for the slide in and out). */
  const shows = (f: "in" | "out" | null) => (full ? { show: true, at: undefined } : { show: f !== null, at: f ?? undefined });
  const xp = shows(flash.xp);

  return (
    <div className={className ? `${styles.cluster} ${className}` : styles.cluster} data-clean={full ? undefined : ""} data-hidden={hidden || undefined} aria-hidden={hidden || undefined}>
      <div className={styles.chips}>
        {progress && xp.show && <span className={styles.chip} data-flash={xp.at} data-ping={xpGain ? "" : undefined} data-levelup={levelUp ? "" : undefined}
          aria-label={`Level ${progress.level}, ${progress.needed ? `${progress.into.toLocaleString()} of ${progress.needed.toLocaleString()} XP to the next level` : "top level"}`}>
          <b className={styles.level} aria-hidden="true">Lv {progress.level}</b>
          <span className={styles.xpBar} aria-hidden="true"><i style={{ transform: `scaleX(${fill})` }} /></span>
          {xpGain && <em key={xpGain.id} className={styles.gain} aria-hidden="true">{levelUp ? "Level up!" : `+${xpGain.amount.toLocaleString()} XP`}</em>}
        </span>}
      </div>
      {buttons && children && <div className={styles.buttons}>{children}</div>}
    </div>
  );
}
