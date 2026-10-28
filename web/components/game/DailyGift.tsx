"use client";

/**
 * Today's gift (hud-first-login §7): a cream card on the first visit of the
 * day (giftDue), opened with the existing server claim (POST
 * /api/economy/daily-gift, once per Toronto day). The box bursts, the coins
 * pop out, and the coin chip counts the gift in. "Later" puts it off until
 * tomorrow's visit on this device.
 *
 * It never takes focus (audit-2026-10-ui item 13): you keep walking and jumping while it shows. E opens it, Escape is
 * "Later" (or closes it once opened), a click works as ever; and it fades out instead of vanishing (item 4).
 *
 * A new member's welcome week (d-streak, lib/wallet/catalogue.ts WELCOME_TRACK; David 2026-10-28: "see the reward for
 * logging in each day"): on their first seven gift days the card is the week's reward track, every day's reward shown
 * ahead, today's lifted; day 7's is the mystery box, a prize wheel that spins to what the server already rolled. Flat,
 * few words (specs/design-bible.md, UI).
 */
import { Gift } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Keycap } from "@/components/gui";
import { DarkButton, GhostButton, PrizeWheel, RewardTrack, WHEEL_SPIN_MS, type TrackStep } from "@/components/gui/flat";
import { ApiError } from "@/lib/apiClient";
import { COINS, GEMS } from "@/lib/economy";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { WELCOME_DAYS, WELCOME_TRACK } from "@/lib/wallet/catalogue";
import type { BoxPrize, GiftView } from "@/lib/wallet/service";
import { AudioManager } from "@/lib/game/audio";
import { giftDue, markGiftClaimed, putOffGift, readGiftPutOff, useHud } from "@/lib/game/hudStore";
import { escapeEndedCapture } from "@/lib/game/orbitCamera";
import { isTyping, usePresence, worldKeysBlocked, type KeyLike } from "@/lib/game/useWorldDialog";
import { SignInText } from "@/components/gui/SignIn";
import styles from "./DailyGift.module.css";

/** closed: not offered yet this visit; done: offered and finished (it never comes back until the next visit). */
type Phase = { at: "closed" } | { at: "done" } | { at: "offer" } | { at: "opening" } | { at: "opened"; coins: number; welcome: GiftView["welcome"] } | { at: "error"; text: string };

/**
 * What a key does to the card: E opens an offered gift, Escape puts it off or closes it. Nothing while a sheet is open
 * (it has the keys), while typing, on a held or modified key, or for the Escape that only ended mouse-look.
 */
export function giftKey(at: Phase["at"], e: KeyLike & { repeat?: boolean }, { typing, blocked, captureEnded }: { typing: boolean; blocked: boolean; captureEnded: boolean }): "claim" | "later" | "close" | null {
  if (blocked || typing || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === "Escape") return captureEnded ? null : at === "offer" ? "later" : at === "opened" || at === "error" ? "close" : null;
  return e.key.toLowerCase() === "e" && at === "offer" ? "claim" : null;
}

const GIFT_EXIT_MS = 220;
const sr = (text: string) => <span className={styles.sr}>{text}</span>;
/** An amount with its currency's icon (and its name for screen readers). */
const Paid = ({ n, gems, size = 18 }: { n: number; gems?: boolean; size?: number }) =>
  <span className={styles.paid}>{n.toLocaleString()}<CurrencyIcon currency={gems ? "gems" : "coins"} size={size} />{sr(gems ? GEMS.name : COINS.name)}</span>;

/** The welcome week as a reward track: each day's reward, the days taken checked, today's lifted (taken once opened). */
export function welcomeSteps(today: number, opened: boolean): TrackStep[] {
  return WELCOME_TRACK.map((r, i) => {
    const d = i + 1;
    return {
      key: `d${d}`, label: `Day ${d}`, big: r.box,
      state: d < today || (d === today && opened) ? "done" : d === today ? "today" : "ahead",
      picture: r.box ? <Gift size={38} strokeWidth={1.7} aria-label="Mystery box" /> : <CurrencyIcon currency={r.gems ? "gems" : "coins"} size={36} />,
      amount: r.box ? <span className={styles.paid}>+{r.gems}<CurrencyIcon currency="gems" size={12} />{sr(GEMS.name)}</span> : (r.gems || r.coins).toLocaleString(),
    };
  });
}

/** The box's wheel: the prize and up to seven others from what the box can hold, the prize somewhere round it. */
function wheelOf(reel: readonly BoxPrize[], prize: BoxPrize): { prizes: BoxPrize[]; at: number } {
  const others = reel.filter(p => p.slug !== prize.slug);
  const seed = [...prize.slug].reduce((n, c) => n + c.charCodeAt(0), 0);
  const picked = Array.from({ length: Math.min(7, others.length) }, (_, i) => others[(seed + i * 5) % others.length]).filter((p, i, a) => a.indexOf(p) === i);
  const at = seed % (picked.length + 1);
  return { prizes: [...picked.slice(0, at), prize, ...picked.slice(at)], at };
}

function BoxWheel({ reel, prize, onStop }: { reel: BoxPrize[]; prize: BoxPrize; onStop: () => void }) {
  const { prizes, at } = useMemo(() => wheelOf(reel, prize), [reel, prize]);
  const stop = useRef(onStop);
  useEffect(() => { stop.current = onStop; });
  const [land, setLand] = useState<number | null>(null);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const go = window.setTimeout(() => setLand(at), 250);
    // Ticks as segments pass the pointer, slowing with the wheel.
    const ticks = still ? [] : Array.from({ length: 16 }, (_, i) => window.setTimeout(() => AudioManager.playSFX("blip3", { rate: 1.6, gain: 0.3 }), 250 + WHEEL_SPIN_MS * (1 - Math.sqrt(1 - (i + 1) / 17))));
    return () => { window.clearTimeout(go); ticks.forEach(t => window.clearTimeout(t)); };
  }, [at]);
  // eslint-disable-next-line @next/next/no-img-element -- item icons are small static webps
  const pictures = prizes.map(p => ({ key: p.slug, label: p.name, picture: <img src={p.icon} alt="" /> }));
  return <PrizeWheel prizes={pictures} land={land} onLanded={() => stop.current()} size={250} label="The mystery box" />;
}

/** `ready`: the world is showing and nothing else holds the player (first login, a fade, a sheet). */
export default function DailyGift({ ready }: { ready: boolean }) {
  const hud = useHud();
  const [phase, setPhase] = useState<Phase>({ at: "closed" });
  const due = ready && phase.at === "closed" && giftDue(hud, readGiftPutOff());
  useEffect(() => {
    if (!due) return;
    const t = window.setTimeout(() => { setPhase({ at: "offer" }); AudioManager.playSFX("blip3"); }, 1200);
    return () => window.clearTimeout(t);
  }, [due]);
  // A box stays until you've seen what it held; the coins alone close themselves.
  const boxed = phase.at === "opened" && !!phase.welcome?.item;
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    if (phase.at !== "opened" || boxed) return;
    const t = window.setTimeout(() => setPhase({ at: "done" }), 3200);
    return () => window.clearTimeout(t);
  }, [phase.at, boxed]);

  const later = () => { if (hud.day) putOffGift(hud.day); setPhase({ at: "done" }); };
  const claim = async () => {
    setPhase({ at: "opening" });
    AudioManager.playSFX("click");
    try {
      const [r] = await Promise.all([httpEconomyTransport.dailyGift(), new Promise(done => window.setTimeout(done, 650))]);
      markGiftClaimed(r.balance, r.day);
      if (!r.claimed) { setPhase({ at: "error", text: "Already opened today. See you tomorrow!" }); return; }
      AudioManager.playSFX("confirm");
      window.setTimeout(() => AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.6 }), 260);
      setPhase({ at: "opened", coins: r.coins + (r.welcome?.coins ?? 0), welcome: r.welcome });
    } catch (err) {
      setPhase({ at: "error", text: err instanceof ApiError && err.status === 401 ? "Sign in to open your gift." : "The gift wouldn’t open. Try again in a moment." });
    }
  };

  // Its keys, ahead of the world's (the window's capture phase), without taking focus from the game.
  const keyed = useRef({ at: phase.at, claim, later });
  useEffect(() => { keyed.current = { at: phase.at, claim, later }; });
  const showing = phase.at !== "closed" && phase.at !== "done";
  useEffect(() => {
    if (!showing) return;
    const on = (e: KeyboardEvent) => {
      const { at, claim, later } = keyed.current;
      const act = giftKey(at, e, { typing: isTyping(document.activeElement as Element | null), blocked: worldKeysBlocked(), captureEnded: escapeEndedCapture() });
      if (!act) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (act === "claim") void claim();
      else if (act === "later") later();
      else setPhase({ at: "done" });
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [showing]);

  // Closing, it keeps what it last showed while it fades out.
  const state = usePresence(showing, GIFT_EXIT_MS);
  const [last, setLast] = useState<Phase>(phase);
  if (showing && last !== phase) setLast(phase);
  if (!state) return null;
  const shown = showing ? phase : last;
  const welcome = shown.at === "opened" ? shown.welcome : null;
  const week = welcome?.day ?? hud.welcomeDay;
  const box = welcome?.item ?? null;
  const opened = shown.at === "opened";
  let head: ReactNode, body: ReactNode = null;
  if (box && welcome) {
    head = stopped ? box.name : "Mystery box";
    body = <div className={styles.wheel}><BoxWheel reel={welcome.reel} prize={box} onStop={() => { setStopped(true); AudioManager.playSFX("confirm"); }} /></div>;
  } else if (opened) {
    head = <span className={styles.won}><Paid n={shown.coins} size={26} />{!!welcome?.gems && <Paid n={welcome.gems} gems size={26} />}</span>;
  } else if (shown.at === "error") {
    head = "Today's gift";
    body = <p className={styles.note}><SignInText text={shown.text} /></p>;
  } else head = week ? (week === WELCOME_DAYS ? "Day 7" : `Day ${week}`) : "Today's gift";
  return <section className={styles.card} role="dialog" aria-modal="false" aria-labelledby="daily-gift-title" data-phase={shown.at} data-state={state} data-box={box ? "" : undefined} data-week={week ? "" : undefined}>
    {week && !box && <RewardTrack steps={welcomeSteps(week, opened)} label={`Welcome week, day ${week} of ${WELCOME_DAYS}`} />}
    {!week && shown.at !== "error" && <div className={styles.box} aria-hidden="true"><span className={styles.gift}>{opened ? <CurrencyIcon size={44} /> : <Gift size={46} strokeWidth={1.6} />}</span></div>}
    <h2 id="daily-gift-title" aria-live="polite">{head}</h2>
    {body}
    {box && stopped && welcome && <p className={styles.extra}><span className={styles.plus}>+</span><Paid n={welcome.gems} gems size={16} /><span className={styles.plus}>+</span><Paid n={shown.at === "opened" ? shown.coins : 0} size={16} /></p>}
    <div className={styles.actions}>
      {(shown.at === "offer" || shown.at === "opening") && <>
        <DarkButton onClick={() => void claim()} disabled={shown.at === "opening"}>{shown.at === "opening" ? "Opening…" : <><Keycap aria-hidden="true" className={styles.key}>E</Keycap>Open</>}</DarkButton>
        <GhostButton onClick={later} disabled={shown.at === "opening"}>Later</GhostButton>
      </>}
      {(opened || shown.at === "error") && <DarkButton disabled={!!box && !stopped} onClick={() => setPhase({ at: "done" })}>{opened ? "Thanks!" : "Close"}</DarkButton>}
    </div>
  </section>;
}
