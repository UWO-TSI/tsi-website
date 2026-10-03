"use client";

/**
 * The phone companion's top bar (specs/polish/reachability.md deliverable 4): the club's name and your coins, which
 * open your wallet (the game's sheet, K on the island). It also brings the account's settings to the phone: the text
 * size and contrast you chose apply here too.
 */
import { useState } from "react";
import { COINS } from "@/lib/economy";
import { useHud } from "@/lib/game/hudStore";
import { useWorldIdentity } from "@/lib/game/identity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { WalletSheet } from "@/components/economy/EconomySheets";
import s from "@/components/study/companion.module.css";

export default function CompanionHeader({ signedIn }: { signedIn: boolean }) {
  const hud = useHud();
  useWorldIdentity();
  const [wallet, setWallet] = useState(false);
  return <header className={s.top}>
    <h1>Tethos</h1>
    {signedIn && hud.coins !== null && <button type="button" className={`${s.coins} ${s.coinsButton}`} onClick={() => setWallet(true)}
      aria-label={`${hud.coins.toLocaleString()} ${COINS.name}. Open your wallet`}>
      <CurrencyIcon size={20} /><b>{hud.coins.toLocaleString()}</b><small aria-hidden>{COINS.name}</small>
    </button>}
    <WalletSheet open={wallet} onClose={() => setWallet(false)} />
  </header>;
}
