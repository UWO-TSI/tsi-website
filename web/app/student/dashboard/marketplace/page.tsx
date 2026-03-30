"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingBag,
  Package,
  X,
  Filter,
  Check,
  AlertTriangle,
} from "lucide-react";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  stock: number;
  image_url: string | null;
  status: string;
}

interface Order {
  id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  item: { name: string; category: string } | null;
}

const categories = ["all", "merch", "theme", "accessory", "special"] as const;

const categoryGradients: Record<string, string> = {
  merch: "from-[var(--color-brand-blue)] to-indigo-800",
  theme: "from-purple-600 to-fuchsia-700",
  accessory: "from-[var(--color-accent-cyan)] to-teal-700",
  special: "from-[var(--color-brand-yellow)] to-amber-700",
};

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [buyItem, setBuyItem] = useState<MarketplaceItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: itemsData }, { data: ordersData }] = await Promise.all([
      supabase.from("profiles").select("tethos_coins").eq("id", user.id).single(),
      supabase.from("marketplace_items").select("*").eq("status", "available").order("name"),
      supabase
        .from("marketplace_orders")
        .select("id, item_id, quantity, total_price, status, created_at, item:marketplace_items(name, category)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setBalance(profile?.tethos_coins ?? 0);
    setItems((itemsData as MarketplaceItem[]) ?? []);
    setOrders(
      (ordersData ?? []).map((o) => ({
        ...o,
        item: o.item as unknown as { name: string; category: string } | null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBuy = async () => {
    if (!buyItem) return;
    setBuying(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBuying(false);
      return;
    }

    if (balance < buyItem.price) {
      setBuyResult({ success: false, message: "Insufficient Tethos Coins." });
      setBuying(false);
      return;
    }

    const { error: orderError } = await supabase.from("marketplace_orders").insert({
      user_id: user.id,
      item_id: buyItem.id,
      quantity: 1,
      total_price: buyItem.price,
    });

    if (orderError) {
      setBuyResult({ success: false, message: "Order failed. Try again." });
      setBuying(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ tethos_coins: balance - buyItem.price })
      .eq("id", user.id);

    setBalance((prev) => prev - buyItem.price);
    setBuyResult({ success: true, message: `Acquired ${buyItem.name}!` });
    setBuying(false);
    fetchData();
  };

  const filteredItems =
    category === "all" ? items : items.filter((i) => i.category === category);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading marketplace...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Marketplace
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            Spend your hard-earned Tethos Coins
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--color-bg-alt)] border border-[var(--color-brand-yellow)]/30 rounded-lg px-4 py-2">
          <span className="text-lg font-heading font-bold text-[var(--color-brand-yellow)]">
            {balance.toLocaleString()} &#x20AE;
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
          {(["shop", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-all ${
                tab === t
                  ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t === "shop" ? "Shop" : "My Orders"}
            </button>
          ))}
        </div>

        {tab === "shop" && (
          <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
            <Filter size={12} className="text-[var(--color-text-muted)] ml-2" />
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all capitalize ${
                  category === c
                    ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shop Grid */}
      {tab === "shop" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_0_12px_rgba(0,47,167,0.1)] transition-all group"
            >
              {/* Image / Gradient Placeholder */}
              <div
                className={`h-36 bg-gradient-to-br ${
                  categoryGradients[item.category] ?? "from-gray-700 to-gray-900"
                } flex items-center justify-center`}
              >
                <ShoppingBag
                  size={32}
                  className="text-white/30 group-hover:text-white/50 transition-colors"
                />
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
                    {item.name}
                  </h3>
                  <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase bg-[var(--color-bg-main)] px-1.5 py-0.5 rounded shrink-0">
                    {item.category}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-base font-heading font-bold text-[var(--color-brand-yellow)]">
                      {item.price} &#x20AE;
                    </span>
                    <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] ml-2">
                      {item.stock} left
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setBuyItem(item);
                      setBuyResult(null);
                    }}
                    disabled={item.stock <= 0}
                    className="px-3 py-1.5 text-xs font-mono bg-[var(--color-brand-blue)] text-white rounded hover:bg-[var(--color-brand-blue)]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {item.stock <= 0 ? "Sold Out" : "Buy"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Package size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                No items in this category.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                No orders yet. Start shopping!
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
                    {order.item?.name ?? "Unknown Item"}
                  </p>
                  <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)] mt-0.5">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    &middot; Qty: {order.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-heading font-bold text-[var(--color-brand-yellow)]">
                    {order.total_price} &#x20AE;
                  </span>
                  <span
                    className={`text-[0.6rem] font-mono px-2 py-0.5 rounded uppercase ${
                      order.status === "fulfilled"
                        ? "bg-green-500/10 text-green-400"
                        : order.status === "pending"
                        ? "bg-[var(--color-brand-yellow)]/10 text-[var(--color-brand-yellow)]"
                        : "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Buy Confirmation Modal */}
      {buyItem && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setBuyItem(null)}
        >
          <div
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[var(--glass-border)] flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                Confirm Purchase
              </h2>
              <button
                onClick={() => setBuyItem(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {buyResult ? (
                <div className="text-center py-4">
                  {buyResult.success ? (
                    <Check size={32} className="text-green-400 mx-auto mb-2" />
                  ) : (
                    <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
                  )}
                  <p
                    className={`font-mono text-sm ${
                      buyResult.success ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {buyResult.message}
                  </p>
                  <button
                    onClick={() => setBuyItem(null)}
                    className="mt-4 px-4 py-2 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-[var(--color-bg-main)] rounded-md p-4 mb-4">
                    <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
                      {buyItem.name}
                    </h3>
                    {buyItem.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {buyItem.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase">
                        {buyItem.category}
                      </span>
                      <span className="text-lg font-heading font-bold text-[var(--color-brand-yellow)]">
                        {buyItem.price} &#x20AE;
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm font-mono mb-4">
                    <span className="text-[var(--color-text-muted)]">Your Balance</span>
                    <span
                      className={
                        balance >= buyItem.price
                          ? "text-[var(--color-text-primary)]"
                          : "text-red-400"
                      }
                    >
                      {balance} &#x20AE;
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBuyItem(null)}
                      className="flex-1 py-2 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border)] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBuy}
                      disabled={buying || balance < buyItem.price}
                      className="flex-1 py-2 text-sm font-mono bg-[var(--color-brand-blue)] text-white rounded-md hover:bg-[var(--color-brand-blue)]/80 transition-colors disabled:opacity-40"
                    >
                      {buying ? "Processing..." : "Confirm"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
