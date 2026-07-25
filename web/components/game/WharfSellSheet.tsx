"use client";

/**
 * WharfSellSheet (economy v2 E3, 2026-07-25) — the Wharf Shack counter.
 * Lists the member's caught fish + sea creatures (local-first collections)
 * with per-rarity prices; Sell 1 / Sell all pay coins 🪙 via earnCoins().
 * v1 is count-based and local-first (server-side atomic sale = E4).
 */

import { useState } from "react";
import { FISH, RARITY_META, SELL_PRICES, HOLO_GRADIENT, iconFor, type FishDef } from "@/lib/game/fishing";
import { localCollections, spendCollected } from "@/lib/game/collections";
import { earnCoins, localCoins } from "@/lib/game/coins";
import { GEAR, buyGear, localGear } from "@/lib/game/gear";
import { useTickUp } from "./StatsHUD";
import { AudioManager } from "@/lib/game/audio";
import { COINS } from "@/lib/economy";

const SELLABLE = new Map<string, FishDef>(FISH.map((f) => [f.key, f]));

function sellableRows(): { fish: FishDef; count: number }[] {
  const all = localCollections();
  return Object.entries(all)
    .filter(([k, n]) => n > 0 && SELLABLE.has(k))
    .map(([k, n]) => ({ fish: SELLABLE.get(k)!, count: n }))
    .sort((a, b) => SELL_PRICES[b.fish.rarity] - SELL_PRICES[a.fish.rarity]);
}

export default function WharfSellSheet() {
  const [rows, setRows] = useState(sellableRows);
  const [coins, setCoins] = useState(localCoins);
  const [owned, setOwned] = useState<string[]>(localGear);
  const { value: coinsShown, flashing } = useTickUp(coins);

  const sell = (fish: FishDef, qty: number) => {
    const have = localCollections()[fish.key] ?? 0;
    const n = Math.min(qty, have);
    if (n < 1) return;
    spendCollected(fish.key, n);
    const paid = SELL_PRICES[fish.rarity] * n;
    const total = earnCoins(paid, "fish_sale");
    // E4: atomic server sale rides along (price resolves server-side;
    // pre-migration DBs 503 and the local mirrors stay authoritative).
    fetch("/api/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: fish.key, qty: n }),
    }).catch(() => {});
    setCoins(total);
    setRows(sellableRows());
    AudioManager.playSFX("confirm");
    window.dispatchEvent(
      new CustomEvent("tsi:toast", { detail: { text: `Sold ${n}× ${fish.name} for ${paid} ${COINS.symbol}` } })
    );
  };

  const sellEverything = () => {
    let paid = 0;
    for (const r of rows) {
      spendCollected(r.fish.key, r.count);
      paid += SELL_PRICES[r.fish.rarity] * r.count;
      fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: r.fish.key, qty: r.count }),
      }).catch(() => {});
    }
    if (paid < 1) return;
    const total = earnCoins(Math.min(paid, 4000), "fish_sale_all");
    setCoins(total);
    setRows(sellableRows());
    AudioManager.playSFX("confirm");
    window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `Sold the lot for ${paid} ${COINS.symbol}!` } }));
  };

  const totalValue = rows.reduce((s, r) => s + SELL_PRICES[r.fish.rarity] * r.count, 0);

  const buy = (key: string) => {
    const total = buyGear(key);
    if (total === null) {
      AudioManager.playSFX("click");
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Not enough coins yet — sell some catches!" } }));
      return;
    }
    setCoins(total);
    setOwned(localGear());
    AudioManager.playSFX("confirm");
    const item = GEAR.find((g) => g.key === key);
    window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `${item?.emoji} ${item?.name} is yours!` } }));
  };

  return (
    <div style={{ fontFamily: "var(--font-highlight, sans-serif)", color: "#4A4034", padding: "4px 2px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: "#8A7B5E" }}>Your wallet</span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            textShadow: flashing ? "0 0 10px rgba(201, 150, 46, 0.8)" : "none",
          }}
        >
          {coinsShown.toLocaleString()} {COINS.symbol}
        </span>
        {rows.length > 0 && (
          <button
            onClick={sellEverything}
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              borderRadius: 8,
              border: "2px solid #C9962E",
              background: "#F8EFC9",
              color: "#7A5A10",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Sell all ({totalValue} {COINS.symbol})
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "#8A7B5E", fontSize: 14 }}>
          Nothing in the cooler — go catch something! The Shack pays by rarity: common 8 🪙 up to Sea King 2,500 🪙.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map(({ fish, count }) => {
            const meta = RARITY_META[fish.rarity];
            const price = SELL_PRICES[fish.rarity];
            return (
              <div
                key={fish.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: "#FFFDF5",
                  border: "1.5px solid #E0D2B0",
                  borderRadius: 10,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconFor(fish)} alt="" width={34} height={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {fish.name} <span style={{ color: "#8A7B5E", fontWeight: 400 }}>×{count}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      ...(fish.rarity === "seaking"
                        ? { backgroundImage: HOLO_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }
                        : { color: meta.color }),
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {price} {COINS.symbol}
                </span>
                <button
                  onClick={() => sell(fish, 1)}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #C9962E", background: "#FFF8E4", color: "#7A5A10", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  Sell 1
                </button>
                {count > 1 && (
                  <button
                    onClick={() => sell(fish, count)}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E0D2B0", background: "#FFFDF5", color: "#8A7B5E", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    All
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* E4: the gear shelf — rods and tackle for coins (cosmetic flair) */}
      <div style={{ marginTop: 18, borderTop: "2px dashed #E0D2B0", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#8A7B5E", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Gear shelf
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {GEAR.map((g) => {
            const has = owned.includes(g.key);
            return (
              <div
                key={g.key}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: has ? "#F4F8EE" : "#FFFDF5", border: "1.5px solid #E0D2B0", borderRadius: 10 }}
              >
                <span style={{ fontSize: 22 }}>{g.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#8A7B5E" }}>{g.desc}</div>
                </div>
                {has ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#5B8A4A", padding: "4px 10px", background: "#E4F0DC", borderRadius: 7 }}>OWNED</span>
                ) : (
                  <button
                    onClick={() => buy(g.key)}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #C9962E", background: "#FFF8E4", color: "#7A5A10", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {g.price} {COINS.symbol}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ marginTop: 14, fontSize: 11, color: "#B0A17C" }}>
        Coins (TC 🪙) are the island play currency — earned at this counter, spent on the shelf above. They never convert to Gems.
      </p>
    </div>
  );
}
