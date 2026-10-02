/**
 * An amount of play coins or Gems with its rendered icon (row 281: real icons, no emoji). Coins only, never an
 * exchange rate (lib/economy.ts); screen readers hear the currency's name.
 */
import { COINS, GEMS } from "@/lib/economy";
import { iconUrl } from "@/lib/icons/keys";

export function CurrencyIcon({ currency = "coins", size = 18 }: { currency?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={iconUrl(currency === "gems" ? "gem" : "coin")} alt="" width={size} height={size} style={{ display: "inline-block", verticalAlign: "-0.22em", flex: "none" }} />;
}

export function Amount({ n, currency = "coins", size }: { n: number; currency?: string; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25em", whiteSpace: "nowrap" }}>
    {n.toLocaleString()}<CurrencyIcon currency={currency} size={size} />
    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{currency === "gems" ? GEMS.name : COINS.name}</span>
  </span>;
}
