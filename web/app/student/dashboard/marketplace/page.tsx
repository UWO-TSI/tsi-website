"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingBag,
  Package,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, Empty, ErrorNote, List, ListRow, Loading, Sheet, Tabs } from "@/components/gui";
import { balanceAfterPurchase, canAfford, loadMarketplace, ORDER_TONES, type MarketItem, type MarketOrder } from "@/lib/portal/marketplace";

const categories = ["all", "merch", "theme", "accessory", "special"] as const;

const MARKET_TABS: { id: "shop" | "orders"; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "orders", label: "My orders" },
];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  merch: "Merch",
  theme: "Theme",
  accessory: "Accessory",
  special: "Special",
};

/** Each category's shelf behind the item (a wash on paper; no text sits on it). */
const categoryShelves: Record<string, string> = {
  merch: "var(--gui-sage-soft)",
  theme: "color-mix(in srgb, var(--gui-rarity-epic) 22%, var(--gui-paper-hi))",
  accessory: "color-mix(in srgb, var(--gui-teal-pill) 32%, var(--gui-paper-hi))",
  special: "var(--gui-confetti) var(--gui-butter)",
};

/** "pending_pickup" → "Pending pickup". */
const statusLabel = (s: string) => {
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"ready" | "signed-out" | "error">("ready");
  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [buyItem, setBuyItem] = useState<MarketItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const m = await loadMarketplace(createClient());
      if (!m) return setState("signed-out");
      setBalance(m.balance);
      setItems(m.items);
      setOrders(m.orders);
      setState("ready");
    } catch {
      setState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBuy = async () => {
    if (!buyItem) return;
    if (!canAfford(balance, buyItem)) {
      setBuyResult({ success: false, message: "You don’t have enough Gems for this." });
      return;
    }
    setBuying(true);
    try {
      // Orders, stock and coins are server-only (migrations 20260926120000/130000).
      const res = await fetch("/api/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", item_id: buyItem.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setBuyResult({ success: false, message: body?.error ?? "That didn’t go through. Try again." });
        return;
      }
      setBalance((prev) => balanceAfterPurchase(body, prev));
      setBuyResult({ success: true, message: `${buyItem.name} is yours.` });
      fetchData();
    } catch {
      setBuyResult({ success: false, message: "That didn’t go through. Try again." });
    } finally {
      setBuying(false);
    }
  };

  const filteredItems =
    category === "all" ? items : items.filter((i) => i.category === category);

  if (loading || state !== "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        {loading ? <Loading label="Loading the marketplace…" />
          : state === "signed-out" ? <Empty icon={<ShoppingBag size={32} />} title="Sign in to shop">The marketplace opens once you’re signed in.</Empty>
          : <ErrorNote onRetry={() => { setLoading(true); fetchData(); }}>The marketplace didn’t load.</ErrorNote>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Banner title="Marketplace" icon={<ShoppingBag size={26} />} tone="butter">
          Club merch and extras, bought with your Gems.
        </Banner>

        {/* Tabs + your balance */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Tabs label="Marketplace" value={tab} onChange={setTab} tabs={MARKET_TABS} />
          {tab === "shop" && (
            <Tabs
              label="Category"
              value={category}
              onChange={setCategory}
              tabs={categories.map((c) => ({ id: c, label: CATEGORY_LABELS[c] }))}
            />
          )}
          <span
            className="ml-auto inline-flex items-center gap-2 text-sm"
            style={{
              minHeight: 40,
              padding: "6px 16px",
              borderRadius: "var(--gui-r-pill)",
              background: "var(--gui-butter)",
              color: "var(--gui-ink-strong)",
              fontWeight: 800,
              boxShadow: "var(--gui-shadow-sm)",
            }}
          >
            Balance <Amount n={balance} currency="gems" />
          </span>
        </div>

        {/* Shop Grid */}
        {tab === "shop" && (
          filteredItems.length === 0 ? (
            <Empty
              icon={<Package size={32} />}
              title={category === "all" ? "The shelves are empty" : "Nothing in this category"}
            >
              {category === "all" ? "New items go up through the year. Check back soon." : "Try another category."}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} as="article" className="flex flex-col overflow-hidden group" style={{ padding: 0 }}>
                  {/* Shelf */}
                  <div
                    className="h-32 flex items-center justify-center"
                    style={{ background: categoryShelves[item.category] ?? "var(--gui-paper-deep)" }}
                  >
                    <ShoppingBag
                      size={32}
                      className="transition-transform group-hover:scale-110"
                      style={{ color: "var(--gui-bark)" }}
                      aria-hidden
                    />
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                        {item.name}
                      </h3>
                      <Badge>{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                    </div>

                    {item.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--gui-muted)" }}>
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-auto pt-3">
                      <div className="flex items-baseline flex-wrap gap-x-2">
                        <span className="text-base" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                          <Amount n={item.price_tc} currency="gems" />
                        </span>
                        <span className="text-xs" style={{ color: "var(--gui-muted)" }}>
                          {item.stock} left
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setBuyItem(item);
                          setBuyResult(null);
                        }}
                        disabled={item.stock <= 0}
                      >
                        {item.stock <= 0 ? "Sold out" : "Buy"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Orders Tab */}
        {tab === "orders" && (
          orders.length === 0 ? (
            <Empty
              icon={<Package size={32} />}
              title="No orders yet"
              action={<Button size="sm" variant="quiet" onClick={() => setTab("shop")}>Browse the shop</Button>}
            >
              Things you buy show up here.
            </Empty>
          ) : (
            <Card style={{ padding: "6px 8px" }}>
              <List label="Your orders">
                {orders.map((order) => (
                  <ListRow
                    key={order.id}
                    icon={<Package size={24} />}
                    title={order.item?.name ?? "Unknown item"}
                    detail={<>{formatDate(order.created_at)} · Qty {order.quantity}</>}
                    value={
                      <span className="flex flex-col items-end gap-1">
                        <span style={{ color: "var(--gui-ink-strong)" }}>
                          <Amount n={order.total_tc} currency="gems" />
                        </span>
                        <Badge tone={ORDER_TONES[order.status] ?? "neutral"}>{statusLabel(order.status)}</Badge>
                      </span>
                    }
                  />
                ))}
              </List>
            </Card>
          )
        )}
      </div>

      {/* Buy Confirmation Sheet */}
      <Sheet
        open={buyItem !== null}
        onClose={() => setBuyItem(null)}
        title={buyResult ? (buyResult.success ? "It’s yours" : "That didn’t go through") : "Confirm purchase"}
        eyebrow="Marketplace"
        icon={<ShoppingBag size={22} />}
        size="sm"
        footer={buyItem && (
          buyResult ? (
            <Button size="sm" variant="quiet" onClick={() => setBuyItem(null)}>Close</Button>
          ) : (
            <>
              <Button size="sm" variant="quiet" onClick={() => setBuyItem(null)}>Cancel</Button>
              <Button size="sm" onClick={handleBuy} disabled={buying || !canAfford(balance, buyItem)}>
                {buying ? "Buying…" : "Buy it"}
              </Button>
            </>
          )
        )}
      >
        {buyItem && (
          buyResult ? (
            <div className="text-center py-2" role="status">
              {buyResult.success ? (
                <Check size={32} className="mx-auto mb-2" style={{ color: "var(--gui-success)" }} aria-hidden />
              ) : (
                <AlertTriangle size={32} className="mx-auto mb-2" style={{ color: "var(--gui-danger)" }} aria-hidden />
              )}
              <p
                className="text-sm"
                style={{ color: buyResult.success ? "var(--gui-success)" : "var(--gui-danger)", fontWeight: 800 }}
              >
                {buyResult.message}
              </p>
            </div>
          ) : (
            <>
              <div
                className="p-4 mb-4"
                style={{
                  background: "var(--gui-paper-warm)",
                  borderRadius: "var(--gui-r-card)",
                  boxShadow: "inset 0 0 0 1.5px var(--gui-paper-edge)",
                }}
              >
                <h3 className="text-base" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  {buyItem.name}
                </h3>
                {buyItem.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--gui-muted)" }}>
                    {buyItem.description}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 mt-3">
                  <Badge>{CATEGORY_LABELS[buyItem.category] ?? buyItem.category}</Badge>
                  <span className="text-lg" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                    <Amount n={buyItem.price_tc} currency="gems" />
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--gui-ink-2)" }}>Your balance</span>
                <span
                  style={{
                    color: canAfford(balance, buyItem) ? "var(--gui-ink-strong)" : "var(--gui-danger)",
                    fontWeight: 800,
                  }}
                >
                  <Amount n={balance} currency="gems" />
                </span>
              </div>
              {!canAfford(balance, buyItem) && (
                <p className="text-sm mt-2" role="status" style={{ color: "var(--gui-danger)", fontWeight: 800 }}>
                  You don’t have enough Gems for this.
                </p>
              )}
            </>
          )
        )}
      </Sheet>
    </div>
  );
}
