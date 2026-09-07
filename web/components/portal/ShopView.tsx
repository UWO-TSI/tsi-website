"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { AudioManager } from "@/lib/game/audio";
import { ShoppingBag, Coins, SearchX, X } from "lucide-react";
import { presenceRequest, PresenceRequestError } from "@/lib/game/mobilePresence";
import { shopReadTransport, type ShopProduct as Product, type ShopReadTransport } from "@/lib/game/shopRead";

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
        window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `Purchased ${product.name}! −${product.price_tc} 💎` } }));
      } else {
        window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Purchase failed — try again." } }));
      }
    } catch { /* ignore */ }
    setPurchasing(false);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 209, 102, 0.1)" }}>
              <ShoppingBag className="w-5 h-5" style={{ color: "#ffd166" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Shop</h1>
          </div>
          <div className="font-mono text-sm" role="status" style={{ color: "#ffd166" }}>
            <span className="flex items-center gap-1.5"><Coins className="w-4 h-4" aria-hidden />
              {balanceState === "ready" && balance !== null ? `${balance.toLocaleString()} TSI` : balanceState === "loading" ? "Loading balance…" : balanceState === "signed-out" ? "Sign in to view your balance" : "Balance unavailable"}
            </span>
            {balanceState === "error" && <button onClick={retry} className="underline" style={{ minHeight: 44 }}>Retry balance</button>}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              className="shrink-0 text-sm font-medium rounded-full transition-colors"
              style={{
                height: 44,
                padding: "0 16px",
                background: category === c.key ? "rgba(0, 47, 167, 0.15)" : "transparent",
                color: category === c.key ? "var(--color-text-main)" : "var(--color-text-muted)",
                border: category === c.key ? "1px solid #002fa7" : "1px solid var(--glass-border-soft)",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {catalogueError ? (
          <div role="status" className="py-12 text-center" style={{ color: "var(--color-text-muted)" }}>
            <p>{catalogueError === "signed-out" ? "Sign in to browse the shop." : "The shop catalogue could not load."}</p>
            <button onClick={retry} className="underline mt-3" style={{ minHeight: 44 }}>Retry shop</button>
          </div>
        ) : loading ? (
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: "var(--color-surface)" }}>
                <div style={{ aspectRatio: "1", background: "#111113", borderRadius: "16px 16px 0 0" }} />
                <div style={{ padding: 16 }}>
                  <div className="h-4 rounded mb-2" style={{ background: "var(--surface-chip)", width: "60%" }} />
                  <div className="h-3 rounded" style={{ background: "var(--surface-chip)", width: "40%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchX className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No items in this category yet.</p>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="text-left rounded-2xl transition-all hover:translate-y-[-2px]"
                style={{ background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", overflow: "hidden" }}
              >
                <div style={{ aspectRatio: "1", background: "#111113" }} className="flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-12 h-12" style={{ color: "var(--color-text-subtle)", opacity: 0.3 }} />
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  <h3 className="text-base font-semibold mb-1 line-clamp-2" style={{ color: "#f1ffff" }}>{p.name}</h3>
                  <div className="flex items-center gap-2">
                    {p.price_cad != null && <span className="text-base font-bold" style={{ color: "#f1ffff" }}>${p.price_cad.toFixed(2)}</span>}
                    {p.price_tc != null && (
                      <span className="font-mono text-sm" style={{ color: "#ffd166" }}>
                        {p.price_cad != null ? "or " : ""}{p.price_tc} 💎
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSelected(null)}>
          <div
            className="w-full rounded-2xl overflow-y-auto"
            style={{ maxWidth: 720, maxHeight: "80vh", background: "var(--color-bg-navy)", border: "1px solid rgba(0, 47, 167, 0.3)", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button onClick={() => setSelected(null)} style={{ color: "var(--color-text-muted)" }}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "1", background: "#111113" }}>
                {selected.image_url ? (
                  <img src={selected.image_url} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-16 h-16" style={{ color: "var(--color-text-subtle)", opacity: 0.3 }} />
                  </div>
                )}
              </div>
              <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text-main)" }}>{selected.name}</h2>
            <div className="flex items-center gap-3 mb-4">
              {selected.price_cad != null && <span className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>${selected.price_cad.toFixed(2)}</span>}
              {selected.price_tc != null && <span className="font-mono text-base" style={{ color: "#ffd166" }}>{selected.price_tc} 💎</span>}
            </div>
            {selected.description && <p className="text-sm mb-6" style={{ color: "var(--color-text-soft)" }}>{selected.description}</p>}
            {selected.price_tc != null && (
              <button
                onClick={() => handlePurchase(selected)}
                disabled={purchasing || balance === null || balance < (selected.price_tc ?? 0)}
                className="w-full rounded-xl text-sm font-semibold transition-all"
                style={{
                  height: 44,
                  background: balance !== null && balance >= (selected.price_tc ?? 0) ? "#002fa7" : "var(--surface-hover)",
                  color: balance !== null && balance >= (selected.price_tc ?? 0) ? "#f1ffff" : "var(--color-text-muted)",
                  opacity: purchasing ? 0.6 : 1,
                }}
              >
                {purchasing ? "Purchasing..." : balance === null ? (balanceState === "loading" ? "Loading balance…" : "Balance unavailable") : balance < (selected.price_tc ?? 0) ? "Not enough coins" : `Buy for ${selected.price_tc} TSI`}
              </button>
            )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
