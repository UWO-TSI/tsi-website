"use client";

// ─── Content Loader Hooks ───────────────────────────────────────────────────
// Fetch NPC personas, shop items, and the active seasonal palette from Supabase.
// Cache for 5 minutes; fall back to bundled JSON defaults when Supabase env
// vars are missing or the query errors. Never throws to the UI.

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NPC_PERSONAS,
  DEFAULT_PALETTES,
  DEFAULT_SHOP_ITEMS,
} from "@/data/content-defaults";
import type {
  NPCPersona,
  PaletteColors,
  SeasonalPalette,
  ShopCategory,
  ShopItem,
} from "@/lib/game/contentTypes";

const FIVE_MINUTES = 5 * 60 * 1000;

const SWR_OPTS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: FIVE_MINUTES,
};

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// ─── NPCs ───────────────────────────────────────────────────────────────────

async function fetchNPCPersonas(permanentOnly: boolean): Promise<NPCPersona[]> {
  if (!hasSupabaseEnv()) return filterPermanent(DEFAULT_NPC_PERSONAS, permanentOnly);
  try {
    const supabase = createClient();
    let query = supabase
      .from("npc_personas")
      .select(
        "id, slug, display_name, sprite_url, spawn_zone, is_permanent, persona_prompt, canned_dialogue, active, created_at, updated_at",
      )
      .eq("active", true);
    if (permanentOnly) query = query.eq("is_permanent", true);
    const { data, error } = await query;
    if (error || !data) {
      console.warn("[contentLoader] npc_personas fetch failed, using defaults", error);
      return filterPermanent(DEFAULT_NPC_PERSONAS, permanentOnly);
    }
    return data as unknown as NPCPersona[];
  } catch (err) {
    console.warn("[contentLoader] npc_personas threw, using defaults", err);
    return filterPermanent(DEFAULT_NPC_PERSONAS, permanentOnly);
  }
}

function filterPermanent(rows: NPCPersona[], permanentOnly: boolean): NPCPersona[] {
  const active = rows.filter((r) => r.active);
  return permanentOnly ? active.filter((r) => r.is_permanent) : active;
}

export function useNPCPersonas(options?: { permanentOnly?: boolean }) {
  const permanentOnly = options?.permanentOnly ?? false;
  const key = `npc_personas:${permanentOnly ? "permanent" : "all"}`;
  const { data, error, isLoading } = useSWR<NPCPersona[]>(
    key,
    () => fetchNPCPersonas(permanentOnly),
    SWR_OPTS,
  );
  return {
    data: data ?? filterPermanent(DEFAULT_NPC_PERSONAS, permanentOnly),
    isLoading,
    error,
  };
}

// ─── Shop items ─────────────────────────────────────────────────────────────

async function fetchShopItems(category?: ShopCategory): Promise<ShopItem[]> {
  if (!hasSupabaseEnv()) return filterShop(DEFAULT_SHOP_ITEMS, category);
  try {
    const supabase = createClient();
    let query = supabase
      .from("shop_items")
      .select(
        "id, slug, display_name, category, sprite_url, description, tc_price, rarity, stock, active, released_at, retired_at",
      )
      .eq("active", true);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error || !data) {
      console.warn("[contentLoader] shop_items fetch failed, using defaults", error);
      return filterShop(DEFAULT_SHOP_ITEMS, category);
    }
    return data as unknown as ShopItem[];
  } catch (err) {
    console.warn("[contentLoader] shop_items threw, using defaults", err);
    return filterShop(DEFAULT_SHOP_ITEMS, category);
  }
}

function filterShop(rows: ShopItem[], category?: ShopCategory): ShopItem[] {
  const active = rows.filter((r) => r.active);
  return category ? active.filter((r) => r.category === category) : active;
}

export function useShopItems(options?: { category?: ShopCategory }) {
  const category = options?.category;
  const key = `shop_items:${category ?? "all"}`;
  const { data, error, isLoading } = useSWR<ShopItem[]>(
    key,
    () => fetchShopItems(category),
    SWR_OPTS,
  );
  return {
    data: data ?? filterShop(DEFAULT_SHOP_ITEMS, category),
    isLoading,
    error,
  };
}

// ─── Active palette ─────────────────────────────────────────────────────────

function defaultActivePalette(): SeasonalPalette {
  return DEFAULT_PALETTES.find((p) => p.active) ?? DEFAULT_PALETTES[0];
}

async function fetchActivePalette(): Promise<SeasonalPalette> {
  if (!hasSupabaseEnv()) return defaultActivePalette();
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("seasonal_palettes")
      .select(
        "id, slug, display_name, palette, active, scheduled_start, scheduled_end, created_at",
      )
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      console.warn("[contentLoader] seasonal_palettes fetch failed, using defaults", error);
      return defaultActivePalette();
    }
    const row = data as unknown as SeasonalPalette;
    // Sanity check: palette must be an object with expected keys; otherwise fall back.
    const paletteObj = row.palette as unknown as Record<string, unknown> | null;
    if (!paletteObj || typeof paletteObj !== "object" || !("sky" in paletteObj)) {
      console.warn("[contentLoader] active palette malformed, using defaults");
      return defaultActivePalette();
    }
    return row;
  } catch (err) {
    console.warn("[contentLoader] seasonal_palettes threw, using defaults", err);
    return defaultActivePalette();
  }
}

export function useActivePalette() {
  const { data, error, isLoading } = useSWR<SeasonalPalette>(
    "seasonal_palettes:active",
    fetchActivePalette,
    SWR_OPTS,
  );
  return {
    data: data ?? defaultActivePalette(),
    isLoading,
    error,
  };
}

// Helpers exported for non-hook contexts (e.g., server components / tests)
export const _fallbackActivePalette = defaultActivePalette;
export type { PaletteColors };
