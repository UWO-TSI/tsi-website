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
 */
import { Gift } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import { useEffect, useRef, useState } from "react";
import { Keycap } from "@/components/recruit/ui";
import { ApiError } from "@/lib/apiClient";
import { COINS } from "@/lib/economy";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { AudioManager } from "@/lib/game/audio";
import { giftDue, markGiftClaimed, putOffGift, readGiftPutOff, useHud } from "@/lib/game/hudStore";
import { escapeEndedCapture } from "@/lib/game/orbitCamera";
import { isTyping, usePresence, worldKeysBlocked, type KeyLike } from "@/lib/game/useWorldDialog";
import { SignInText } from "@/components/gui/SignIn";
import styles from "./DailyGift.module.css";

/** closed: not offered yet this visit; done: offered and finished (it never comes back until the next visit). */
type Phase = { at: "closed" } | { at: "done" } | { at: "offer" } | { at: "opening" } | { at: "opened"; coins: number } | { at: "error"; text: string };

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
  useEffect(() => {
    if (phase.at !== "opened") return;
    const t = window.setTimeout(() => setPhase({ at: "done" }), 3200);
    return () => window.clearTimeout(t);
  }, [phase.at]);

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
      setPhase({ at: "opened", coins: r.coins });
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
  return <section className={styles.card} role="dialog" aria-modal="false" aria-labelledby="daily-gift-title" data-phase={shown.at} data-state={state}>
    <div className={styles.box} aria-hidden="true">
      <span className={styles.gift}><Gift size={44} strokeWidth={1.6} /></span>
      {shown.at === "opened" && <>
        {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={styles.coin} style={{ "--i": i } as React.CSSProperties}><CurrencyIcon size={22} /></span>)}
        <span className={styles.prize}><CurrencyIcon size={40} /></span>
      </>}
    </div>
    <h2 id="daily-gift-title">{shown.at === "opened" ? <>+{shown.coins.toLocaleString()} <CurrencyIcon size={22} /> <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{COINS.name}</span></> : "A little something for today"}</h2>
    <p>{shown.at === "opened" ? "Added to your coins. See you tomorrow!" : shown.at === "error" ? <SignInText text={shown.text} /> : "Everyone on the island gets a small gift each day."}</p>
    <div className={styles.actions}>
      {(shown.at === "offer" || shown.at === "opening") && <>
        <button className={styles.primary} onClick={() => void claim()} disabled={shown.at === "opening"}>{shown.at === "opening" ? "Opening…" : <><Keycap aria-hidden="true" className={styles.key}>E</Keycap>Open it</>}</button>
        <button className={styles.quiet} onClick={later} disabled={shown.at === "opening"}>Later</button>
      </>}
      {(shown.at === "opened" || shown.at === "error") && <button className={styles.primary} onClick={() => setPhase({ at: "done" })}>{shown.at === "opened" ? "Thanks!" : "Close"}</button>}
    </div>
  </section>;
}
