"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Package } from "lucide-react";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_tc: number;
  stock: number;
  category: string;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  quantity: number;
  total_tc: number;
  status: string;
  created_at: string;
  user: { display_name: string } | null;
  item: { name: string } | null;
}

export default function AdminMarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"items" | "orders">("items");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_tc: 100,
    stock: 10,
    category: "merch",
  });

  async function fetchData() {
    const supabase = createClient();
    const [{ data: itemsData }, { data: ordersData }] = await Promise.all([
      supabase
        .from("marketplace_items")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("marketplace_orders")
        .select(
          "*, user:profiles!user_id(display_name), item:marketplace_items!item_id(name)"
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setItems((itemsData as MarketplaceItem[]) ?? []);
    setOrders((ordersData as unknown as Order[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("marketplace_items").insert({
      ...formData,
      status: "available",
    });
    setShowForm(false);
    setFormData({
      name: "",
      description: "",
      price_tc: 100,
      stock: 10,
      category: "merch",
    });
    fetchData();
  }

  async function deleteItem(id: string) {
    const supabase = createClient();
    await supabase.from("marketplace_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function fulfillOrder(id: string) {
    const supabase = createClient();
    await supabase
      .from("marketplace_orders")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("id", id);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "fulfilled" } : o))
    );
  }

  const inputClass =
    "w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] transition-all";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Marketplace Admin
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
            {(["items", "orders"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  tab === t
                    ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {tab === "items" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-blue)] text-white font-mono text-sm rounded-md"
            >
              <Plus size={16} />
              Add Item
            </button>
          )}
        </div>
      </div>

      {showForm && tab === "items" && (
        <form
          onSubmit={createItem}
          className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5 mb-6 space-y-3"
        >
          <input
            className={inputClass}
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="Item name"
            required
          />
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Description"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                ₮ Price:
              </span>
              <input
                type="number"
                className={inputClass + " w-24"}
                value={formData.price_tc}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price_tc: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                Stock:
              </span>
              <input
                type="number"
                className={inputClass + " w-20"}
                value={formData.stock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <select
              className={inputClass + " w-auto"}
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              <option value="merch">Merch</option>
              <option value="theme">Theme</option>
              <option value="accessory">Accessory</option>
              <option value="special">Special</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-brand-blue)] text-white font-mono text-sm rounded-md"
            >
              Add Item
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading...
        </p>
      ) : tab === "items" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {item.name}
                </h3>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                {item.description}
              </p>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-[var(--color-brand-yellow)]">
                  ₮{item.price_tc}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  Stock: {item.stock}
                </span>
                <span className="text-[var(--color-accent-cyan)]">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {order.user?.display_name ?? "Unknown"} →{" "}
                  {order.item?.name ?? "Unknown item"}
                </p>
                <p className="text-xs font-mono text-[var(--color-text-muted)]">
                  ₮{order.total_tc} ·{" "}
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                    order.status === "fulfilled"
                      ? "text-green-400 bg-green-400/10"
                      : "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10"
                  }`}
                >
                  {order.status}
                </span>
                {order.status === "pending_pickup" && (
                  <button
                    onClick={() => fulfillOrder(order.id)}
                    className="px-3 py-1 text-[0.65rem] font-mono text-[var(--color-accent-cyan)] border border-[var(--color-accent-cyan)]/30 rounded hover:bg-[var(--color-accent-cyan)]/10 transition-all"
                  >
                    Mark Fulfilled
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
