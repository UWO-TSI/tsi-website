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
import { Badge, Banner, Button, Card, Empty, List, ListRow, Loading, Sheet, Tabs, type BadgeTone } from "@/components/gui";

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

/** Order status tags: fulfilled is done, pending is waiting, anything else is plain. */
const ORDER_TONES: Record<string, BadgeTone> = {
  fulfilled: "success",
  pending: "warn",
};

/** "pending_pickup" → "Pending pickup". */
const statusLabel = (s: string) => {
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
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
      setBuyResult({ success: false, message: "You don’t have enough Gems for this." });
      setBuying(false);
      return;
    }

    // Orders, stock and coins are server-only (migrations 20260926120000/130000).
    const res = await fetch("/api/economy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purchase", item_id: buyItem.id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setBuyResult({ success: false, message: body?.error ?? "That didn’t go through. Try again." });
      setBuying(false);
      return;
    }

    setBalance((prev) => prev - buyItem.price);
    setBuyResult({ success: true, message: `${buyItem.name} is yours.` });
    setBuying(false);
    fetchData();
  };

  const filteredItems =
    category === "all" ? items : items.filter((i) => i.category === category);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <Loading label="Loading the marketplace…" />
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
                          {item.price != null && <Amount n={item.price} currency="gems" />}
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
                          {order.total_price != null && <Amount n={order.total_price} currency="gems" />}
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
              <Button size="sm" onClick={handleBuy} disabled={buying || balance < buyItem.price}>
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
                    {buyItem.price != null && <Amount n={buyItem.price} currency="gems" />}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--gui-ink-2)" }}>Your balance</span>
                <span
                  style={{
                    color: balance >= buyItem.price ? "var(--gui-ink-strong)" : "var(--gui-danger)",
                    fontWeight: 800,
                  }}
                >
                  <Amount n={balance} currency="gems" />
                </span>
              </div>
            </>
          )
        )}
      </Sheet>
    </div>
  );
}
