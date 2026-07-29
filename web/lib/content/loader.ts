"use client";

// ─── Content Loader Hooks ───────────────────────────────────────────────────
// Fetch NPC personas, shop items, and the active seasonal palette from Supabase.
// Cache for 5 minutes; fall back to bundled JSON defaults when Supabase env
// vars are missing or the query errors. Never throws to the UI.
//
// Preview mode: when the URL has ?preview=draft-<draftId>, the hooks fetch
// the named draft row from content_drafts and overlay it on the matching
// table. Falls back to live data if the draft is missing or shape-mismatched.

import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { getLabPalette, labSubscribe } from "@/lib/game/devLab";

const getNullLabPalette = () => null;
import {
  DEFAULT_EMOTE_TYPES,
  DEFAULT_NPC_PERSONAS,
  DEFAULT_PALETTES,
  DEFAULT_SHOP_ITEMS,
} from "@/data/content-defaults";
import type {
  EmoteType,
  NPCPersona,
  PaletteColors,
  SeasonalPalette,
  ShopCategory,
  ShopItem,
} from "@/lib/content/types";

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

// ─── Preview-mode helpers ───────────────────────────────────────────────────

function getPreviewDraftId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const match = params.get("preview")?.match(/^draft-(.+)$/);
  return match?.[1] ?? null;
}

async function fetchDraftData(
  draftId: string,
  expectedTable: string,
): Promise<Record<string, unknown> | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("content_drafts")
      .select("table_name, draft_data, status")
      .eq("id", draftId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.table_name !== expectedTable) return null;
    if (data.status !== "draft") return null;
    const draft = data.draft_data;
    if (!draft || typeof draft !== "object") return null;
    return draft as Record<string, unknown>;
  } catch {
    return null;
  }
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

function applyNPCDraft(rows: NPCPersona[], draft: Record<string, unknown>): NPCPersona[] {
  if (!draft || typeof draft !== "object" || !("slug" in draft)) return rows;
  const slug = draft.slug as string;
  const idx = rows.findIndex((r) => r.slug === slug);
  if (idx === -1) {
    const synthetic = {
      id: `preview-${slug}`,
      slug,
      display_name: (draft.display_name as string) ?? slug,
      sprite_url: (draft.sprite_url as string | null) ?? null,
      spawn_zone: (draft.spawn_zone as NPCPersona["spawn_zone"]) ?? "courtyard",
      is_permanent: Boolean(draft.is_permanent),
      persona_prompt: (draft.persona_prompt as string | null) ?? null,
      canned_dialogue: (draft.canned_dialogue as string[]) ?? [],
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as NPCPersona;
    return [...rows, synthetic];
  }
  const merged = { ...rows[idx], ...draft } as NPCPersona;
  const next = rows.slice();
  next[idx] = merged;
  return next;
}

export function useNPCPersonas(options?: {
  permanentOnly?: boolean;
  previewDraftId?: string | null;
}) {
  const permanentOnly = options?.permanentOnly ?? false;
  const previewId = options?.previewDraftId ?? getPreviewDraftId();
  const key = `npc_personas:${permanentOnly ? "permanent" : "all"}:${previewId ?? "live"}`;
  const { data, error, isLoading } = useSWR<NPCPersona[]>(
    key,
    async () => {
      const live = await fetchNPCPersonas(permanentOnly);
      if (!previewId) return live;
      const draft = await fetchDraftData(previewId, "npc_personas");
      return draft ? applyNPCDraft(live, draft) : live;
    },
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

function applyShopDraft(rows: ShopItem[], draft: Record<string, unknown>): ShopItem[] {
  if (!draft || typeof draft !== "object" || !("slug" in draft)) return rows;
  const slug = draft.slug as string;
  const idx = rows.findIndex((r) => r.slug === slug);
  if (idx === -1) {
    const synthetic = {
      id: `preview-${slug}`,
      slug,
      display_name: (draft.display_name as string) ?? slug,
      category: (draft.category as ShopCategory) ?? "merch",
      sprite_url: (draft.sprite_url as string | null) ?? null,
      description: (draft.description as string | null) ?? null,
      tc_price: Number(draft.tc_price ?? 0),
      rarity: (draft.rarity as ShopItem["rarity"]) ?? null,
      stock: (draft.stock as number | null) ?? null,
      active: true,
      released_at: new Date().toISOString(),
      retired_at: null,
    } as ShopItem;
    return [...rows, synthetic];
  }
  const merged = { ...rows[idx], ...draft } as ShopItem;
  const next = rows.slice();
  next[idx] = merged;
  return next;
}

export function useShopItems(options?: {
  category?: ShopCategory;
  previewDraftId?: string | null;
}) {
  const category = options?.category;
  const previewId = options?.previewDraftId ?? getPreviewDraftId();
  const key = `shop_items:${category ?? "all"}:${previewId ?? "live"}`;
  const { data, error, isLoading } = useSWR<ShopItem[]>(
    key,
    async () => {
      const live = await fetchShopItems(category);
      if (!previewId) return live;
      const draft = await fetchDraftData(previewId, "shop_items");
      return draft ? applyShopDraft(live, draft) : live;
    },
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

function applyPaletteDraft(
  live: SeasonalPalette,
  draft: Record<string, unknown>,
): SeasonalPalette {
  const paletteDraft = draft.palette as Record<string, unknown> | undefined;
  if (!paletteDraft || typeof paletteDraft !== "object" || !("sky" in paletteDraft)) {
    return live;
  }
  return {
    ...live,
    slug: (draft.slug as string) ?? live.slug,
    display_name: (draft.display_name as string) ?? live.display_name,
    palette: paletteDraft as unknown as PaletteColors,
  };
}

export function useActivePalette(options?: { previewDraftId?: string | null }) {
  const previewId = options?.previewDraftId ?? getPreviewDraftId();
  const key = `seasonal_palettes:active:${previewId ?? "live"}`;
  const { data, error, isLoading } = useSWR<SeasonalPalette>(
    key,
    async () => {
      const live = await fetchActivePalette();
      if (!previewId) return live;
      const draft = await fetchDraftData(previewId, "seasonal_palettes");
      return draft ? applyPaletteDraft(live, draft) : live;
    },
    SWR_OPTS,
  );
  // /lab/world palette bench: a dev-only override painted over whatever the
  // live/preview palette resolved to. getLabPalette is null always in prod.
  const labPalette = useSyncExternalStore(labSubscribe, getLabPalette, getNullLabPalette);
  const resolved = data ?? defaultActivePalette();
  return {
    data: labPalette ? { ...resolved, palette: labPalette } : resolved,
    isLoading,
    error,
  };
}

// ─── Emote types (sprint E2) ────────────────────────────────────────────────

async function fetchEmoteTypes(): Promise<EmoteType[]> {
  if (!hasSupabaseEnv()) return DEFAULT_EMOTE_TYPES;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("emote_types")
      .select(
        "id, slug, display_name, animation_key, icon_url, unlock_condition, active, created_at",
      )
      .eq("active", true);
    if (error || !data) {
      console.warn("[contentLoader] emote_types fetch failed, using defaults", error);
      return DEFAULT_EMOTE_TYPES;
    }
    return data as unknown as EmoteType[];
  } catch (err) {
    console.warn("[contentLoader] emote_types threw, using defaults", err);
    return DEFAULT_EMOTE_TYPES;
  }
}

export function useEmoteTypes() {
  const { data, error, isLoading } = useSWR<EmoteType[]>(
    "emote_types:active",
    fetchEmoteTypes,
    SWR_OPTS,
  );
  return {
    data: data ?? DEFAULT_EMOTE_TYPES,
    isLoading,
    error,
  };
}

// Helpers exported for non-hook contexts (e.g., server components / tests)
export const _fallbackActivePalette = defaultActivePalette;
export { getPreviewDraftId };
export type { PaletteColors };
