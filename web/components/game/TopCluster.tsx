"use client";

/**
 * The cream top cluster (hud-first-login §2, row 124): play coins and the level
 * with its XP, then the caller's buttons (the gear). Coins count up and XP fills
 * instead of jumping; a gain pings. Coins only, never an exchange rate
 * (lib/economy.ts).
 *
 * The minimal HUD (`full` false; rows 283 and playtest round 1): nothing shows
 * while you play; coins slide in when they change and XP on a gain, then fade.
 * The full one (the UI view, Esc 1; the HUD key held; the setting) shows them,
 * and the caller's buttons (`buttons`, default `full`). The island clock is
 * `HudClock`, under the minimap; mail is in the UI view's dock.
 *
 * `hidden`: a cinematic moment (talking, the greeting, the boat trip; world
 * audit item 7), where the whole cluster fades out, flashes included.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CloudFog, CloudRain, Moon, Snowflake, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { COINS } from "@/lib/economy";
import { levelProgress } from "@/lib/combat/progression";
import { useHud } from "@/lib/game/hudStore";
import { worldNow } from "@/lib/game/worldClock";
import { AudioManager } from "@/lib/game/audio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { FLASH_MS } from "@/lib/game/hudPrefs";
import { CurrencyIcon } from "@/components/economy/Amount";
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

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The shown number eases to `value` (straight to the DOM, no re-render per frame); the first value just appears. */
function CountUp({ value }: { value: number }) {
  const span = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = span.current, from = shown.current;
    if (!el) return;
    const show = (n: number) => { shown.current = n; el.textContent = n.toLocaleString(); };
    if (from === null || from === value || reduced()) { show(value); return; }
    const start = performance.now(), ms = Math.min(1200, 500 + Math.abs(value - from) * 4);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      show(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={span} />;
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

export default function TopCluster({ onWallet, walletKey, full = true, buttons = full, hidden = false, className, children }: {
  full?: boolean; buttons?: boolean; hidden?: boolean; className?: string; children?: ReactNode;
  /** The coins open the wallet (reachability §2), its key shown on the tooltip. */
  onWallet?: () => void; walletKey?: string;
}) {
  const hud = useHud();
  const progress = hud.xp === null ? null : levelProgress(hud.xp);
  const coinGain = useGain(hud.coins), xpGain = useGain(hud.xp);
  const levelUp = useGain(progress?.level ?? null);
  useEffect(() => { if (coinGain) AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.6 }); }, [coinGain]);
  useEffect(() => { if (levelUp) AudioManager.playSFX("confirm"); }, [levelUp]);
  const fill = progress ? (progress.needed ? progress.into / progress.needed : 1) : 0;
  const flash = { coins: useFlash(hud.coins, FLASH_MS.coins), xp: useFlash(hud.xp, FLASH_MS.xp, up) };
  /** In the minimal HUD a part shows only while its change is (its flash state for the slide in and out). */
  const shows = (f: "in" | "out" | null) => (full ? { show: true, at: undefined } : { show: f !== null, at: f ?? undefined });
  const coins = shows(flash.coins), xp = shows(flash.xp);

  return (
    <div className={className ? `${styles.cluster} ${className}` : styles.cluster} data-clean={full ? undefined : ""} data-hidden={hidden || undefined} aria-hidden={hidden || undefined}>
      <div className={styles.chips}>
        {hud.coins !== null && coins.show && (() => {
          const label = `${hud.coins.toLocaleString()} ${COINS.name}`, face = <>
            <span className={styles.coin} aria-hidden="true"><CurrencyIcon size={22} /></span><b aria-hidden="true"><CountUp value={hud.coins} /></b><small aria-hidden="true">{COINS.name}</small>
            {coinGain && <em key={coinGain.id} className={styles.gain} aria-hidden="true">+{coinGain.amount.toLocaleString()}</em>}
          </>;
          return onWallet
            ? <button type="button" className={styles.chip} data-flash={coins.at} data-ping={coinGain ? "" : undefined} data-wallet="" data-hud-slot="coins" onClick={onWallet}
              aria-label={`${label}. Open your wallet`} title={walletKey ? `Wallet (${walletKey})` : "Wallet"}>{face}</button>
            : <span className={styles.chip} data-flash={coins.at} data-ping={coinGain ? "" : undefined} data-hud-slot="coins" aria-label={label} title="Play coins">{face}</span>;
        })()}
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
