"use client";

/**
 * The top HUD's numbers (hud-first-login §2): play coins, today's gift and XP.
 * Coins and the gift load from GET /api/economy/wallet and reload after any
 * game write (API_WRITE, debounced so a burst is one read); XP starts from the
 * island's progression read and follows kills and finished missions. Signed
 * out, coins stay null and the HUD shows no coin chip.
 */
import { useSyncExternalStore } from "react";
import { API_WRITE } from "@/lib/apiClient";
import { httpEconomyTransport } from "@/lib/wallet/transport";

export interface HudState { coins: number | null; xp: number | null; giftClaimed: boolean; day: string | null }
const EMPTY: HudState = { coins: null, xp: null, giftClaimed: true, day: null };
let state = EMPTY;
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const publish = (next: Partial<HudState>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };

export function refreshHudWallet(): Promise<void> {
  return httpEconomyTransport.wallet().then(w => publish({ coins: w.coins, giftClaimed: w.daily_claimed, day: w.day }), () => {});
}
export const setHudCoins = (coins: number) => publish({ coins });
export const setHudXp = (xp: number) => publish({ xp });
export const markGiftClaimed = (coins: number, day: string) => publish({ coins, giftClaimed: true, day });

/** A game write: kills carry the new XP total, a finished mission its award; anything may have moved coins. */
export function onApiWrite(detail: { path?: string; data?: unknown } | null | undefined): void {
  const data = (detail?.data ?? null) as Record<string, unknown> | null;
  if (detail?.path === "/api/combat/kill" && typeof data?.xp === "number") publish({ xp: data.xp });
  if (detail?.path === "/api/combat/missions/complete" && typeof data?.xp_awarded === "number" && !data.replayed && state.xp !== null) publish({ xp: state.xp + data.xp_awarded });
  clearTimeout(timer);
  timer = setTimeout(() => void refreshHudWallet(), 1500);
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!started && typeof window !== "undefined") {
    started = true;
    void refreshHudWallet();
    window.addEventListener(API_WRITE, e => onApiWrite((e as CustomEvent).detail));
    // A new Toronto day while the island is open: today's gift becomes due.
    window.addEventListener("focus", () => void refreshHudWallet());
  }
  return () => { listeners.delete(l); };
}

/**
 * Today's gift pops up once a day (hud-first-login §7): signed in, today's
 * not claimed (the server pays once per Toronto day), and not put off today
 * on this device.
 */
export function giftDue(hud: Pick<HudState, "coins" | "giftClaimed" | "day">, putOffDay: string | null): boolean {
  return hud.coins !== null && hud.day !== null && !hud.giftClaimed && putOffDay !== hud.day;
}
const GIFT_LATER = "tsi.gift.later";
export function readGiftPutOff(): string | null { try { return localStorage.getItem(GIFT_LATER); } catch { return null; } }
export function putOffGift(day: string): void { try { localStorage.setItem(GIFT_LATER, day); } catch { /* asks again next visit */ } }

export const getHud = (): HudState => state;
export function useHud(): HudState {
  return useSyncExternalStore(subscribe, getHud, () => EMPTY);
}
