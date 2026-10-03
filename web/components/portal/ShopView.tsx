"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { AudioManager } from "@/lib/game/audio";
import { ShoppingBag, SearchX } from "lucide-react";
import { presenceRequest, PresenceRequestError } from "@/lib/game/mobilePresence";
import { shopReadTransport, type ShopProduct as Product, type ShopReadTransport } from "@/lib/game/shopRead";
import { Amount } from "@/components/economy/Amount";
import { Banner, Button, Card, Empty, ErrorNote, Loading, Sheet, SignInText, Tabs } from "@/components/gui";

type Category = "all" | "apparel" | "accessories" | "digital" | "merch";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "apparel", label: "Apparel" },
  { key: "accessories", label: "Accessories" },
  { key: "digital", label: "Digital" },
  { key: "merch", label: "Merch" },
];

export default function ShopView({ transport = shopReadTransport }: { transport?: ShopReadTransport }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("all");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceState, setBalanceState] = useState<"loading" | "ready" | "error" | "signed-out">("loading");
  const [catalogueError, setCatalogueError] = useState<"error" | "signed-out" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void presenceRequest(transport.balance, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setBalance(value); setBalanceState("ready"); }
    }).catch((error) => {
      if (!controller.signal.aborted) setBalanceState(error instanceof PresenceRequestError && error.status === 401 ? "signed-out" : "error");
    });
    void presenceRequest(transport.catalogue, controller.signal).then((value) => {
      if (!controller.signal.aborted) setProducts(value);
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogueError(error instanceof PresenceRequestError && error.status === 401 ? "signed-out" : "error");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [transport, attempt]);

  const retry = () => {
    setBalance(null); setBalanceState("loading"); setProducts([]); setLoading(true); setCatalogueError(null);
    setAttempt((value) => value + 1);
  };

  const filtered = category === "all" ? products : products.filter((p) => p.category === category);

  const handlePurchase = async (product: Product) => {
    if (!product.price_tc || balance === null) return;
    setPurchasing(true);
    try {
      const res = await fetch("/api/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", item_id: product.id, amount: product.price_tc }),
      });
      if (res.ok) {
        setBalance((b) => b === null ? null : b - (product.price_tc ?? 0));
        setSelected(null);
        // Loop iter 15 (2026-07-24): purchase beat — coin chime, a gold
        // confetti pinch, and a receipt toast (success was silent).
        AudioManager.playSFX("confirm");
        window.setTimeout(() => AudioManager.playSFX("enter"), 150);
        confetti({ particleCount: 14, spread: 45, startVelocity: 24, origin: { x: 0.5, y: 0.6 }, colors: ["#FFD166", "#E8A93C", "#FFFDF5"], disableForReducedMotion: true });
        window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `Bought ${product.name} for ${product.price_tc} Gems.` } }));
      } else {
        window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "That purchase didn’t go through. Try again." } }));
      }
    } catch { /* ignore */ }
    setPurchasing(false);
  };

  const detail = selected;
  const price = detail?.price_tc;
  const categoryName = CATEGORIES.find((c) => c.key === category)?.label ?? "this aisle";
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <Banner title="Shop" icon={<ShoppingBag size={26} />} tone="butter">Club merch, outfits and extras, bought with Gems.</Banner>

        <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
          <Tabs label="Shop categories" value={category} onChange={setCategory} tabs={CATEGORIES.map((c) => ({ id: c.key, label: c.label }))} />
          <div role="status" className="inline-flex flex-wrap items-center gap-2"
            style={{ minHeight: 40, padding: balanceState === "error" ? "4px 4px 4px 16px" : "4px 16px", borderRadius: "var(--gui-r-pill)", background: "var(--gui-paper-hi)", boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)", color: "var(--gui-ink-strong)", fontSize: 15, fontWeight: 800 }}>
            {balanceState === "ready" && balance !== null ? <>You have <Amount n={balance} currency="gems" /></>
              : balanceState === "loading" ? "Checking your Gems…" : balanceState === "signed-out" ? <SignInText text="Sign in to see your Gems" /> : "Your Gems didn’t load"}
            {balanceState === "error" && <Button size="sm" variant="quiet" onClick={retry}>Try again</Button>}
          </div>
        </div>

        {/* Product grid */}
        {catalogueError ? (
          <ErrorNote onRetry={retry}>{catalogueError === "signed-out" ? <SignInText text="You’re signed out. Sign in to browse the shop." /> : "The shop didn’t load. Check your connection and try again."}</ErrorNote>
        ) : loading ? (
          <Loading label="Stocking the shelves…" />
        ) : filtered.length === 0 ? (
          <Empty icon={<SearchX size={32} />} title={category === "all" ? "The shelves are empty" : `Nothing in ${categoryName} yet`}>
            New items show up here as they’re added. Check back soon.
          </Empty>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p)} className="text-left block w-full rounded-[18px] transition-transform hover:-translate-y-1">
                <Card className="h-full" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "1", background: "var(--gui-paper-deep)" }} className="flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag aria-hidden className="w-12 h-12" style={{ color: "var(--gui-taupe)" }} />
                    )}
                  </div>
                  <div style={{ padding: "12px 16px 16px" }}>
                    <h3 className="text-base mb-1 line-clamp-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>{p.name}</h3>
                    {p.price_tc != null && <span className="text-sm" style={{ color: "var(--gui-ink)", fontWeight: 800 }}><Amount n={p.price_tc} currency="gems" size={16} /></span>}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item detail sheet */}
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={detail?.name ?? ""} tone="butter" size="lg"
        eyebrow={CATEGORIES.find((c) => c.key === detail?.category)?.label ?? "Shop"} icon={<ShoppingBag size={22} />}
        footer={detail && price != null && <>
          {balance !== null && <span className="mr-auto text-sm" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>You have <Amount n={balance} currency="gems" size={16} /></span>}
          <Button size="sm" onClick={() => handlePurchase(detail)} disabled={purchasing || balance === null || balance < price}>
            {purchasing ? "Buying…" : balance === null ? (balanceState === "loading" ? "Checking your Gems…" : "Gems unavailable") : balance < price ? "Not enough Gems" : <>Buy for <Amount n={price} currency="gems" size={16} /></>}
          </Button>
        </>}>
        {detail && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="overflow-hidden flex items-center justify-center" style={{ aspectRatio: "1", background: "var(--gui-paper-deep)", borderRadius: "var(--gui-r-card)" }}>
              {detail.image_url ? (
                <img src={detail.image_url} alt={detail.name} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag aria-hidden className="w-16 h-16" style={{ color: "var(--gui-taupe)" }} />
              )}
            </div>
            <div>
              {detail.price_tc != null && <p className="mb-3" style={{ fontSize: 22, fontWeight: 800, color: "var(--gui-ink-strong)" }}><Amount n={detail.price_tc} currency="gems" size={22} /></p>}
              {detail.description && <p className="text-sm" style={{ color: "var(--gui-ink)" }}>{detail.description}</p>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
