"use client";

/**
 * The cream top cluster (hud-first-login §2, row 124): play coins, level and
 * XP, the island clock and weather, the mailbox, then the caller's buttons
 * (sound, settings). Coins count up and XP fills instead of jumping; a gain
 * pings. Coins only, never an exchange rate (lib/economy.ts).
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CloudFog, CloudRain, Mail, Moon, Snowflake, Sun, Sunrise, Sunset, Wind } from "lucide-react";
import { COINS } from "@/lib/economy";
import { levelProgress } from "@/lib/combat/progression";
import { useHud } from "@/lib/game/hudStore";
import { worldNow } from "@/lib/game/worldClock";
import { AudioManager } from "@/lib/game/audio";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
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

export default function TopCluster({ weather, phase, unread, mailKey, onMail, children }: {
  weather: IslandWeather; phase: IslandPhase; unread: number; mailKey: string; onMail: () => void; children?: ReactNode;
}) {
  const hud = useHud();
  const progress = hud.xp === null ? null : levelProgress(hud.xp);
  const coinGain = useGain(hud.coins), xpGain = useGain(hud.xp);
  const levelUp = useGain(progress?.level ?? null);
  useEffect(() => { if (coinGain) AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.6 }); }, [coinGain]);
  useEffect(() => { if (levelUp) AudioManager.playSFX("confirm"); }, [levelUp]);
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => 0);
  const when = new Date(minute * 60_000);
  const fill = progress ? (progress.needed ? progress.into / progress.needed : 1) : 0;

  return (
    <div className={styles.cluster}>
      <div className={styles.chips}>
        {hud.coins !== null && <span className={styles.chip} data-ping={coinGain ? "" : undefined} aria-label={`${hud.coins.toLocaleString()} ${COINS.name}`} title="Play coins">
          <span className={styles.coin} aria-hidden="true">{COINS.symbol}</span><b aria-hidden="true"><CountUp value={hud.coins} /></b><small aria-hidden="true">{COINS.name}</small>
          {coinGain && <em key={coinGain.id} className={styles.gain} aria-hidden="true">+{coinGain.amount.toLocaleString()}</em>}
        </span>}
        {progress && <span className={styles.chip} data-ping={xpGain ? "" : undefined} data-levelup={levelUp ? "" : undefined}
          aria-label={`Level ${progress.level}, ${progress.needed ? `${progress.into.toLocaleString()} of ${progress.needed.toLocaleString()} XP to the next level` : "top level"}`}>
          <b className={styles.level} aria-hidden="true">Lv {progress.level}</b>
          <span className={styles.xpBar} aria-hidden="true"><i style={{ transform: `scaleX(${fill})` }} /></span>
          {xpGain && <em key={xpGain.id} className={styles.gain} aria-hidden="true">{levelUp ? "Level up!" : `+${xpGain.amount.toLocaleString()} XP`}</em>}
        </span>}
        {minute > 0 && <span className={styles.chip} title={`${WEATHER_NAME[weather]}, ${PHASE_NAME[phase]} on the island`}>
          <WeatherIcon weather={weather} phase={phase} />
          <span className={styles.clock}><b>{TIME.format(when)}</b><small>{DATE.format(when)}</small></span>
          <span className={styles.srOnly}>{WEATHER_NAME[weather]}</span>
        </span>}
      </div>
      <div className={styles.buttons}>
        <button className={styles.button} onClick={onMail} aria-label={unread ? `Mail, ${unread} unread` : "Mail"} title={`Mail (${mailKey})`}>
          <Mail size={18} aria-hidden />{unread > 0 && <span className={styles.badge} aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {children}
      </div>
    </div>
  );
}
