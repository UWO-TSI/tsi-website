// ─── Content Pipeline Types ─────────────────────────────────────────────────
// App-level views over the Supabase content_pipeline tables (migration 014).
// These mirror the table shapes — keep in sync if the migration changes.

export type SpawnZone = "courtyard" | "shop" | "temple" | "roaming";

export type ShopCategory =
  | "avatar-outfit"
  | "avatar-effect"
  | "merch"
  | "profile-customization";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface NPCPersona {
  id: string;
  slug: string;
  display_name: string;
  sprite_url: string | null;
  spawn_zone: SpawnZone;
  is_permanent: boolean;
  persona_prompt: string | null;
  canned_dialogue: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopItem {
  id: string;
  slug: string;
  display_name: string;
  category: ShopCategory;
  sprite_url: string | null;
  description: string | null;
  tc_price: number;
  rarity: Rarity | null;
  stock: number | null;
  active: boolean;
  released_at: string;
  retired_at: string | null;
}

export interface PaletteColors {
  sky: string;
  grass: string;
  accent: string;
  fog: string;
  water: string;
  building_primary: string;
  building_accent: string;
}

export interface SeasonalPalette {
  id: string;
  slug: string;
  display_name: string;
  palette: PaletteColors;
  active: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
}

export interface EmoteType {
  id: string;
  slug: string;
  display_name: string;
  animation_key: string;
  icon_url: string | null;
  unlock_condition: string | null;
  active: boolean;
  created_at: string;
}
