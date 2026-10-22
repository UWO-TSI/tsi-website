"use client";

/** /dev/economy?view=shop|overlay|sell|inventory|wallet|admin[&tab=specials][&section=items|merch: the shop overlay's two answers] */
import { useEffect, useState, useSyncExternalStore } from "react";
import { InventorySheet, SellSheet, ShopBody, WalletSheet } from "@/components/economy/EconomySheets";
import MerchFulfilment from "@/components/economy/MerchFulfilment";
import ShopOverlay from "@/components/economy/ShopOverlay";
import { merchViewer } from "@/components/game/ShopCounter";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { memoryEconomyTransport } from "@/lib/wallet/memoryTransport";
import * as S from "@/lib/wallet/service";
import type { EconomyTransport } from "@/lib/wallet/transport";

const ME = "00000000-0000-4000-8000-000000000001";
const MAYA = "00000000-0000-4000-8000-000000000101";
const JORDAN = "00000000-0000-4000-8000-000000000102";

async function seed(): Promise<EconomyTransport> {
  const m = memoryEconomyStore();
  m.name(ME, "You");
  m.name(MAYA, "Maya Chen");
  m.name(JORDAN, "Jordan Park");
  m.setTier(ME, 1);
  m.fund(ME, 0, 0);
  const now = new Date();
  await m.store.credit(ME, "coins", 900, "study", "session", "demo-study-1");
  await m.store.credit(ME, "coins", 100, "chapter", "settle-in", "demo-chapter-1");
  await m.store.credit(ME, "coins", 50, "event", "workshop", "demo-event-1");
  await m.store.credit(ME, "gems", 900, "admin", "Bounty: landing page", "demo-gems-1");
  for (const [k, n] of [["fish_coelacanth", 1], ["fish_carp", 4], ["fish_dace", 6], ["bug_monarch_butterfly", 2], ["apple", 5], ["shell_whelk", 1]] as const) m.give(ME, k, n);
  const id = (slug: string) => m.items.find((i) => i.slug === slug)!.id;
  await S.buy(m.store, ME, { item_id: id("rod-basic"), qty: 1, idempotency_key: "demo-buy-1" }, now);
  await S.buy(m.store, ME, { item_id: id("acc-straw-hat"), qty: 1, idempotency_key: "demo-buy-2" }, now);
  await S.buy(m.store, ME, { item_id: id("furn-floor-lamp"), qty: 2, idempotency_key: "demo-buy-3" }, now);
  await S.equip(m.store, ME, { item_id: id("acc-straw-hat"), equipped: true });
  await S.sell(m.store, ME, { item_key: "fish_dace", qty: 2, idempotency_key: "demo-sell-1" });
  await S.reserveMerch(m.store, ME, { item_id: id("merch-sticker-pack"), idempotency_key: "demo-merch-me" });
  m.fund(MAYA, 0, 800);
  m.fund(JORDAN, 0, 2000);
  await S.reserveMerch(m.store, MAYA, { item_id: id("merch-tote"), idempotency_key: "demo-merch-maya" });
  await S.reserveMerch(m.store, JORDAN, { item_id: id("merch-sticker-pack"), idempotency_key: "demo-merch-jordan-2" });
  return memoryEconomyTransport(ME, m);
}

const noSub = () => () => {};
export default function EconomyHarness() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  const [t, setT] = useState<EconomyTransport | null>(null);
  useEffect(() => {
    void seed().then(setT);
  }, []);
  if (search === null || !t) return null;
  const q = new URLSearchParams(search);
  const view = q.get("view") ?? "shop";
  const close = () => undefined;
  return (
    <main className="gui" style={{ minHeight: "100dvh", background: view === "admin" ? "var(--gui-page)" : "linear-gradient(180deg,#a9d8e6,#cfe7cf 55%,#9cc58f)", padding: view === "admin" ? 32 : 0 }}>
      {/* The shop as the portal's pages show it (the overlay's body on the page): ?view=shop[&tab=specials] */}
      {view === "shop" ? <div style={{ padding: 20 }}><ShopBody transport={t} initialTab={(q.get("tab") as "tools" | null) ?? undefined} /></div> : null}
      {/* The in-game shop overlay (ShopOverlay), as the counter opens it: ?view=overlay[&section=items|merch] */}
      {view === "overlay" ? <ShopOverlay open onClose={close} transport={t} title={q.get("section") === "merch" ? "Club merch" : "The shop"}
        section={(q.get("section") as "items" | "merch" | null) ?? undefined} sell={q.get("section") !== "merch"} viewerFor={merchViewer} /> : null}
      {view === "sell" ? <SellSheet open onClose={close} transport={t} /> : null}
      {view === "inventory" ? <InventorySheet open onClose={close} transport={t} /> : null}
      {view === "wallet" ? <WalletSheet open onClose={close} transport={t} /> : null}
      {view === "admin" ? <div style={{ maxWidth: 1000, margin: "0 auto" }}><MerchFulfilment transport={t} /></div> : null}
    </main>
  );
}
