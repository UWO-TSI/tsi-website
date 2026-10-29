/** Economy transport: /api/economy/* by default; in-memory for the dev harness. */
import { apiCall } from "@/lib/apiClient";
import type { ChefView, FishingTasksView, InventoryView, ShopView, SellEntry, SushiView, TackleView, WalletView } from "./service";
import type { Counter, Pulls } from "./tackle";
import type { ActiveBuff } from "./store";
import type { Reservation } from "./store";

export interface MerchView {
  gems: number;
  items: ShopView["tabs"]["merch"];
  reservations: Reservation[];
}
export interface EconomyTransport {
  wallet(): Promise<WalletView>;
  shop(): Promise<ShopView>;
  buy(itemId: string, qty: number, key: string): Promise<{ balance: number; owned: number; replayed: boolean; price_each: number; currency: string }>;
  sellable(): Promise<SellEntry[]>;
  sell(itemKey: string, qty: number, key: string): Promise<{ balance: number; remaining: number; paid: number; replayed: boolean }>;
  tasks(): Promise<FishingTasksView>;
  claimTask(task: string, period: "day" | "week", key: string): Promise<{ balance: number; paid: number; replayed: boolean }>;
  chef(): Promise<ChefView>;
  fillChef(itemKey: string, key: string): Promise<{ balance: number; remaining: number; paid: number; replayed: boolean }>;
  tackle(): Promise<TackleView>;
  roll(counter: Counter, pulls: Pulls, key: string): Promise<{ balance: number; prizes: string[]; replayed: boolean }>;
  sushi(): Promise<SushiView>;
  order(dish: string, key: string, fish?: string): Promise<{ balance: number; paid: number; buff: ActiveBuff; replayed: boolean }>;
  inventory(): Promise<InventoryView>;
  equip(itemId: string, equipped: boolean): Promise<InventoryView>;
  dailyGift(): Promise<{ coins: number; balance: number; claimed: boolean; day: string }>;
  merch(): Promise<MerchView>;
  reserve(itemId: string, key: string): Promise<{ reservation: Reservation | null; gems_balance: number; replayed: boolean }>;
  adminReservations(status?: string): Promise<Reservation[]>;
  resolve(id: string, action: "fulfil" | "cancel", note?: string): Promise<{ status: string; replayed: boolean }>;
}

const call = <T>(path: string, key: string, body?: unknown) => apiCall<T>(`/api/economy/${path}`, key, body);

export const httpEconomyTransport: EconomyTransport = {
  wallet: () => call("wallet", "wallet"),
  shop: () => call("shop", "shop"),
  buy: (item_id, qty, idempotency_key) => call("buy", "purchase", { item_id, qty, idempotency_key }),
  sellable: () => call("sell", "sellable"),
  sell: (item_key, qty, idempotency_key) => call("sell", "sale", { item_key, qty, idempotency_key }),
  tasks: () => call("tasks", "tasks"),
  claimTask: (task, period, idempotency_key) => call("tasks", "claim", { task, period, idempotency_key }),
  chef: () => call("chef", "chef"),
  fillChef: (item_key, idempotency_key) => call("chef", "fill", { item_key, idempotency_key }),
  tackle: () => call("tackle", "tackle"),
  roll: (counter, pulls, idempotency_key) => call("tackle", "roll", { counter, pulls, idempotency_key }),
  sushi: () => call("sushi", "sushi"),
  order: (dish, idempotency_key, fish) => call("sushi", "order", { dish, fish, idempotency_key }),
  inventory: () => call("inventory", "inventory"),
  equip: (item_id, equipped) => call("equip", "inventory", { item_id, equipped }),
  dailyGift: () => call("daily-gift", "gift", {}),
  merch: () => call("merch", "merch"),
  reserve: (item_id, idempotency_key) => call("merch/reserve", "reservation", { item_id, idempotency_key }),
  adminReservations: (status) => call(`admin/merch${status ? `?status=${status}` : ""}`, "reservations"),
  resolve: (id, action, note) => call(`admin/merch/${id}`, "resolution", { action, note }),
};
