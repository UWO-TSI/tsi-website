import { PresenceRequestError } from "./mobilePresence";

export interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  price_cad?: number;
  price_tc?: number;
  image_url?: string;
  category?: string;
  stock?: number;
}
export interface ShopReadTransport {
  catalogue: (signal: AbortSignal) => Promise<ShopProduct[]>;
  balance: (signal: AbortSignal) => Promise<number>;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseShopBalance(value: unknown): number {
  if (!record(value) || !amount(value.balance)) throw new Error("Invalid shop balance");
  return value.balance;
}

export function parseShopCatalogue(value: unknown): ShopProduct[] {
  if (!record(value) || !Array.isArray(value.products)) throw new Error("Invalid shop catalogue");
  return value.products.map((row: unknown) => {
    if (!record(row) || typeof row.id !== "string" || !row.id || typeof row.name !== "string" || !row.name.trim()) throw new Error("Invalid shop product");
    const product: ShopProduct = { id: row.id, name: row.name };
    for (const key of ["description", "image_url", "category"] as const) {
      if (row[key] != null) {
        if (typeof row[key] !== "string") throw new Error("Invalid shop product text");
        product[key] = row[key];
      }
    }
    for (const key of ["price_cad", "price_tc", "stock"] as const) {
      if (row[key] != null) {
        if (!amount(row[key])) throw new Error("Invalid shop product amount");
        product[key] = row[key];
      }
    }
    return product;
  });
}
async function readShop(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new PresenceRequestError(response.status);
  return response.json();
}
export const shopReadTransport: ShopReadTransport = {
  async catalogue(signal) { return parseShopCatalogue(await readShop("/api/shop", signal)); },
  async balance(signal) { return parseShopBalance(await readShop("/api/economy", signal)); },
};
