"use client";

// ─── Content Loader Hooks ───────────────────────────────────────────────────
// Fetch NPC personas, shop items, season palettes and emotes from Supabase.
// Cache for 5 minutes; fall back to bundled JSON defaults when Supabase env
// vars are missing or the query errors. Never throws to the UI.
//
// Preview mode: when the URL has ?preview=draft-<draftId>, useNPCPersonas
// fetches the named draft row from content_drafts and overlays it on the
// residents. Falls back to live data if the draft is missing or shape-mismatched.

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_EMOTE_TYPES,
  DEFAULT_NPC_PERSONAS,
  DEFAULT_PALETTES,
  DEFAULT_SHOP_ITEMS,
} from "@/data/content-defaults";
import type {
  EmoteType,
  NPCPersona,
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
      .select("*")
      .eq("active", true);
    if (permanentOnly) query = query.eq("is_permanent", true);
    const { data, error } = await query;
    // No rows (signed out, or every resident switched off) also falls back: the world never empties (principle 2).
    if (error || !data?.length) {
      if (error) console.warn("[contentLoader] npc_personas fetch failed, using defaults", error);
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
// Stable fallbacks so memoised consumers don't recompute before the fetch lands.
const DEFAULT_PERSONAS = { all: filterPermanent(DEFAULT_NPC_PERSONAS, false), permanent: filterPermanent(DEFAULT_NPC_PERSONAS, true) };

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
    data: data ?? DEFAULT_PERSONAS[permanentOnly ? "permanent" : "all"],
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
  const { data, error, isLoading } = useSWR<ShopItem[]>(
    `shop_items:${category ?? "all"}`,
    () => fetchShopItems(category),
    SWR_OPTS,
  );
  return {
    data: data ?? filterShop(DEFAULT_SHOP_ITEMS, category),
    isLoading,
    error,
  };
}

// ─── Season rows for the member island (2026-09-24) ─────────────────────────
// The island blends all four season rows by date, so it reads them together
// regardless of which row is `active`. Missing/malformed rows fall back to
// DEFAULT_PALETTES by slug.

export const SEASON_SLUGS = ["spring", "summer", "autumn", "winter"] as const;

function defaultSeasonRows(): SeasonalPalette[] {
  return DEFAULT_PALETTES.filter((p) => (SEASON_SLUGS as readonly string[]).includes(p.slug));
}

async function fetchSeasonPalettes(): Promise<SeasonalPalette[]> {
  if (!hasSupabaseEnv()) return defaultSeasonRows();
  try {
    const { data, error } = await createClient()
      .from("seasonal_palettes")
      .select("id, slug, display_name, palette, active, scheduled_start, scheduled_end, created_at")
      .in("slug", [...SEASON_SLUGS]);
    if (error || !data) return defaultSeasonRows();
    const rows = (data as unknown as SeasonalPalette[]).filter((row) => row.palette && typeof row.palette === "object" && "sky" in row.palette);
    return defaultSeasonRows().map((fallback) => {
      const row = rows.find((r) => r.slug === fallback.slug);
      return row ? { ...row, palette: { ...fallback.palette, ...row.palette } } : fallback;
    });
  } catch {
    return defaultSeasonRows();
  }
}

export function useSeasonPalettes(): SeasonalPalette[] {
  const { data } = useSWR<SeasonalPalette[]>("seasonal_palettes:seasons", fetchSeasonPalettes, SWR_OPTS);
  return data ?? defaultSeasonRows();
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
