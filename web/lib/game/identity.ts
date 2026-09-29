/**
 * The island's view of the signed-in member (rows 222, 223, 220, 206):
 * world name (never the real name), member badge, Oracle family, and account
 * settings. Reads GET /api/identity/me; settings save through
 * POST /api/identity/settings. Signed out, settings still work for this
 * browser (localStorage) and the nameplate falls back to "You".
 */
import { useSyncExternalStore } from "react";
import { applySettings, DEFAULT_SETTINGS, mergeSettings, readSettings, type AccountSettings } from "@/lib/identity/settings";
import type { Family } from "@/lib/oracle/engine";
import { isFamily } from "./oracle/family";
import { installOracleDemo } from "./oracle/demo";

export interface WorldIdentity { display_name: string; member: boolean; family: Family | null; settings: AccountSettings; signedIn: boolean; /** Family aura shown on the player (this device; default on). */ aura: boolean }
const LOCAL_SETTINGS = "tsi.settings.v1";
const localSettings = (): AccountSettings => {
  try { return readSettings(JSON.parse(localStorage.getItem(LOCAL_SETTINGS) ?? "null")); } catch { return DEFAULT_SETTINGS; }
};
const AURA_KEY = "tsi.aura.v1";
const localAura = (): boolean => { try { return localStorage.getItem(AURA_KEY) !== "off"; } catch { return true; } };
export const FALLBACK_IDENTITY: WorldIdentity = { display_name: "You", member: false, family: null, settings: DEFAULT_SETTINGS, signedIn: false, aura: true };

/** Shape of GET /api/identity/me → identity. */
export function parseIdentity(body: unknown, fallbackSettings: AccountSettings = DEFAULT_SETTINGS): WorldIdentity | null {
  const id = (body as { identity?: Record<string, unknown> } | null)?.identity;
  if (!id) return null;
  const name = typeof id.world_name === "string" && id.world_name.trim() ? id.world_name.trim().slice(0, 24) : "You";
  return { display_name: name, member: id.badge === "member", family: isFamily(id.family) ? id.family : null, settings: id.settings ? readSettings(id.settings) : fallbackSettings, signedIn: true, aura: true };
}

let snapshot: WorldIdentity = FALLBACK_IDENTITY;
let loaded = false;
const listeners = new Set<() => void>();
const publish = (next: WorldIdentity) => {
  snapshot = next;
  if (typeof document !== "undefined") applySettings(next.settings);
  for (const l of listeners) l();
};

export async function refreshIdentity(): Promise<void> {
  const local = localSettings();
  try {
    const res = await fetch("/api/identity/me");
    const parsed = res.ok ? parseIdentity(await res.json(), local) : null;
    publish({ ...(parsed ?? { ...FALLBACK_IDENTITY, settings: local }), aura: localAura() });
  } catch { publish({ ...FALLBACK_IDENTITY, settings: local, aura: localAura() }); }
}

/** Partial settings update: validated with the systems rules, saved to the account, cached locally. */
export async function saveSettings(patch: Partial<AccountSettings>): Promise<string | null> {
  const merged = mergeSettings(snapshot.settings, patch);
  if (!merged.ok) return merged.error;
  publish({ ...snapshot, settings: merged.settings });
  try { localStorage.setItem(LOCAL_SETTINGS, JSON.stringify(merged.settings)); } catch { /* session only */ }
  if (!snapshot.signedIn) return null;
  try {
    const res = await fetch("/api/identity/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return body?.error ?? "Couldn't save to your account; kept on this device.";
    publish({ ...snapshot, settings: readSettings(body.settings) });
  } catch { return "Couldn't save to your account; kept on this device."; }
  return null;
}

export function setFamily(family: Family): void { publish({ ...snapshot, family }); }
export function setAuraVisible(on: boolean): void {
  try { localStorage.setItem(AURA_KEY, on ? "on" : "off"); } catch { /* session only */ }
  publish({ ...snapshot, aura: on });
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!loaded) { loaded = true; installOracleDemo(); void refreshIdentity(); }
  return () => { listeners.delete(l); };
}
export function useWorldIdentity(): WorldIdentity {
  return useSyncExternalStore(subscribe, () => snapshot, () => FALLBACK_IDENTITY);
}

export function keyLabel(key: string): string {
  return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
}
