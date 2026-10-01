"use client";

/**
 * Today's gift (hud-first-login §7): a cream card on the first visit of the
 * day (giftDue), opened with the existing server claim (POST
 * /api/economy/daily-gift, once per Toronto day). The box bursts, the coins
 * pop out, and the coin chip counts the gift in. "Later" puts it off until
 * tomorrow's visit on this device.
 */
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { COINS } from "@/lib/economy";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { AudioManager } from "@/lib/game/audio";
import { giftDue, markGiftClaimed, putOffGift, readGiftPutOff, useHud } from "@/lib/game/hudStore";
import styles from "./DailyGift.module.css";

/** closed: not offered yet this visit; done: offered and finished (it never comes back until the next visit). */
type Phase = { at: "closed" } | { at: "done" } | { at: "offer" } | { at: "opening" } | { at: "opened"; coins: number } | { at: "error"; text: string };

/** `ready`: the world is showing and nothing else holds the player (first login, a fade, a sheet). */
export default function DailyGift({ ready }: { ready: boolean }) {
  const hud = useHud();
  const [phase, setPhase] = useState<Phase>({ at: "closed" });
  const open = useRef<HTMLButtonElement>(null);
  const due = ready && phase.at === "closed" && giftDue(hud, readGiftPutOff());
  useEffect(() => {
    if (!due) return;
    const t = window.setTimeout(() => { setPhase({ at: "offer" }); AudioManager.playSFX("blip3"); }, 1200);
    return () => window.clearTimeout(t);
  }, [due]);
  useEffect(() => { if (phase.at === "offer") open.current?.focus(); }, [phase.at]);
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

  if (phase.at === "closed" || phase.at === "done") return null;
  return <section className={styles.card} role="dialog" aria-modal="false" aria-labelledby="daily-gift-title" data-phase={phase.at}
    onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); if (phase.at === "offer") later(); else setPhase({ at: "done" }); } }}>
    <div className={styles.box} aria-hidden="true">
      <span className={styles.gift}>🎁</span>
      {phase.at === "opened" && <>
        {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={styles.coin} style={{ "--i": i } as React.CSSProperties}>{COINS.symbol}</span>)}
        <span className={styles.prize}>{COINS.symbol}</span>
      </>}
    </div>
    <h2 id="daily-gift-title">{phase.at === "opened" ? `+${phase.coins.toLocaleString()} ${COINS.symbol}` : "A little something for today"}</h2>
    <p>{phase.at === "opened" ? "Added to your coins. See you tomorrow!" : phase.at === "error" ? phase.text : "Everyone on the island gets a small gift each day."}</p>
    <div className={styles.actions}>
      {(phase.at === "offer" || phase.at === "opening") && <>
        <button ref={open} className={styles.primary} onClick={() => void claim()} disabled={phase.at === "opening"}>{phase.at === "opening" ? "Opening…" : "Open it"}</button>
        <button className={styles.quiet} onClick={later} disabled={phase.at === "opening"}>Later</button>
      </>}
      {(phase.at === "opened" || phase.at === "error") && <button className={styles.primary} onClick={() => setPhase({ at: "done" })} autoFocus>{phase.at === "opened" ? "Thanks!" : "Close"}</button>}
    </div>
  </section>;
}
