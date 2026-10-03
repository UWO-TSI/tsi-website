"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Package, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Badge, Button, Card, Empty, Field, IconButton, Loading, Select, Tabs, TextArea } from "@/components/gui";

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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
const orderStatus = (status: string) =>
  status === "fulfilled" ? <Badge tone="success">Picked up</Badge>
    : status === "pending_pickup" ? <Badge tone="warn">Waiting for pickup</Badge>
    : <Badge>{capitalize(status)}</Badge>;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
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

  return (
    <div className={PAGE}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Marketplace</h1>
          <p className="mt-1 text-sm text-[var(--gui-muted)]">
            What members can buy with Gems, and the orders to hand over.
          </p>
        </div>
        {tab === "items" && (
          <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
            <Plus size={16} aria-hidden />
            Add an item
          </Button>
        )}
      </div>
      <Tabs
        label="Marketplace"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "items", label: "Items" },
          { id: "orders", label: "Orders" },
        ]}
        className="mb-6"
      />

      {showForm && tab === "items" && (
        <Card as="section" className="mb-6" aria-label="Add an item">
          <form onSubmit={createItem} className="space-y-4">
            <Field
              label="Item name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <TextArea
              label="Description"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <Field
                label="Price in Gems"
                type="number"
                value={formData.price_tc}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price_tc: parseInt(e.target.value) || 0,
                  })
                }
              />
              <Field
                label="Stock"
                type="number"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock: parseInt(e.target.value) || 0,
                  })
                }
              />
              <label className="grid gap-2 text-base font-bold text-[var(--gui-ink)]">
                Category
                <Select
                  className="w-full"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  <option value="merch">Merch</option>
                  <option value="theme">Theme</option>
                  <option value="accessory">Accessory</option>
                  <option value="special">Special</option>
                </Select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit">
                Add item
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Loading label="Getting the marketplace…" />
      ) : tab === "items" ? (
        items.length === 0 ? (
          <Empty icon={<ShoppingBag size={32} />} title="No items yet">
            Add one and members can buy it with Gems.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} as="article">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                    {item.name}
                  </h3>
                  <IconButton
                    size="sm"
                    label={`Delete ${item.name}`}
                    onClick={() => deleteItem(item.id)}
                    style={{ color: "var(--gui-danger)" }}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
                {item.description && (
                  <p className="mb-3 text-sm text-[var(--gui-ink-2)]">
                    {item.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span className="font-extrabold text-[var(--gui-ink-strong)]">
                    <Amount n={item.price_tc} currency="gems" />
                  </span>
                  <span className="text-[var(--gui-muted)]">
                    {item.stock} in stock
                  </span>
                  <Badge>{capitalize(item.category)}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : orders.length === 0 ? (
        <Empty icon={<Package size={32} />} title="No orders yet">
          Orders show up here when members buy something.
        </Empty>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm text-[var(--gui-ink)]">
                  <b className="font-extrabold text-[var(--gui-ink-strong)]">
                    {order.user?.display_name ?? "Unknown"}
                  </b>{" "}
                  bought {order.item?.name ?? "an item that’s gone now"}
                </p>
                <p className="text-sm text-[var(--gui-muted)]">
                  <Amount n={order.total_tc} currency="gems" /> · {day(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {orderStatus(order.status)}
                {order.status === "pending_pickup" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => fulfillOrder(order.id)}
                  >
                    Mark as picked up
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
