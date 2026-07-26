"use client";

/**
 * Wharf Shack gear shelf (Economy v2 E4) — local-first, like coins.ts.
 *
 * Owned gear mirrors to localStorage; purchases debit the local coin
 * mirror immediately and fire-and-forget POST /api/gear (the buy_gear RPC
 * debits + appends atomically server-side once migration 024 lands).
 *
 * Gear is cosmetic flair (design principle #4): rods and tackle with
 * flavor, never a mechanic gate.
 */

import { localCoins, spendCoins } from "./coins";

export type GearDef = {
  key: string;
  name: string;
  price: number;
  emoji: string;
  desc: string;
};

export const GEAR: GearDef[] = [
  { key: "rod_cedar", name: "Cedar Rod", price: 350, emoji: "🎣", desc: "Warm-grained and dependable. Smells faintly of the forest." },
  { key: "bobber_lucky", name: "Lucky Bobber", price: 600, emoji: "🔴", desc: "A hand-painted float that's seen one too many big ones get away." },
  { key: "rod_glass", name: "Glass Rod", price: 1200, emoji: "✨", desc: "Catches the light mid-cast. The wharf's finest." },
];

const KEY = "tsi.gear.local.v1";

export function localGear(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export function ownsGear(key: string): boolean {
  return localGear().includes(key);
}

/**
 * Buy an item: local coin debit + local gear append + fire-and-forget
 * server purchase. Returns the new local coin total, or null if the
 * purchase is invalid (unknown item, already owned, not enough coins).
 */
export function buyGear(key: string): number | null {
  const item = GEAR.find((g) => g.key === key);
  if (!item || ownsGear(key)) return null;
  if (localCoins() < item.price) return null;
  const total = spendCoins(item.price, `gear_${key}`);
  if (total === null) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify([...localGear(), key]));
  } catch {
    /* private browsing */
  }
  fetch("/api/gear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: key }),
  }).catch(() => {});
  try {
    window.dispatchEvent(new CustomEvent("tsi:gear", { detail: { gear: localGear(), bought: key } }));
  } catch {
    /* SSR safety */
  }
  return total;
}
