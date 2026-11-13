"use client";

/**
 * The meal you ate at the sushi bar, while it lasts (member_buffs, read with GET /api/economy/sushi): the HUD's faint buff
 * and the rod's stats in the reel (rods.ts withMeal). Read when first watched, again after an order or a chef's fill, and
 * gone at its `until`. Signed out it stays null.
 */
import { useSyncExternalStore } from "react";
import { API_WRITE } from "@/lib/apiClient";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import type { ActiveBuff } from "@/lib/wallet/store";

let meal: ActiveBuff | null = null;
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setMeal(next: ActiveBuff | null) {
  clearTimeout(timer);
  const left = next ? new Date(next.until).getTime() - Date.now() : 0;
  meal = left > 0 ? next : null;
  if (meal) timer = setTimeout(() => setMeal(null), Math.min(left, 2 ** 31 - 1));
  listeners.forEach(l => l());
}
const read = () => httpEconomyTransport.sushi().then(v => setMeal(v.buff), () => {});
const MEAL_WRITES = ["/api/economy/sushi", "/api/economy/chef"];

function subscribe(l: () => void) {
  listeners.add(l);
  if (!started && typeof window !== "undefined") {
    started = true;
    void read();
    window.addEventListener(API_WRITE, e => { if (MEAL_WRITES.includes((e as CustomEvent<{ path?: string }>).detail?.path ?? "")) void read(); });
  }
  return () => { listeners.delete(l); };
}
export function useMeal(): ActiveBuff | null {
  return useSyncExternalStore(subscribe, () => meal, () => null);
}
