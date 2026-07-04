// ─── Bundled Content Defaults ───────────────────────────────────────────────
// Fallback data used when Supabase env vars are missing or queries fail.
// Must match the seed values in `web/supabase/migrations/014_content_pipeline.sql`
// so dev mode and prod render identically when Supabase is unreachable.

import type {
  EmoteType,
  NPCPersona,
  SeasonalPalette,
  ShopItem,
} from "@/lib/game/contentTypes";

const NOW = "1970-01-01T00:00:00.000Z";

export const DEFAULT_PALETTES: SeasonalPalette[] = [
  {
    id: "default-palette-fallback",
    slug: "default",
    display_name: "Default",
    palette: {
      sky: "#BFE6F0",
      grass: "#7CB342",
      accent: "#FFD166",
      fog: "#B0C4DE",
      water: "#4A90D9",
      building_primary: "#D4A574",
      building_accent: "#8B6F4E",
    },
    active: true,
    scheduled_start: null,
    scheduled_end: null,
    created_at: NOW,
  },
  {
    id: "halloween-palette-fallback",
    slug: "halloween",
    display_name: "Halloween",
    palette: {
      sky: "#2B1B3D",
      grass: "#3E2A47",
      accent: "#FF7518",
      fog: "#4A3A5C",
      water: "#1A1226",
      building_primary: "#5A2E8E",
      building_accent: "#0F0A1A",
    },
    active: false,
    scheduled_start: "2026-10-01T00:00:00Z",
    scheduled_end: "2026-11-07T23:59:59Z",
    created_at: NOW,
  },
];

export const DEFAULT_NPC_PERSONAS: NPCPersona[] = [
  {
    id: "mayor-fallback",
    slug: "mayor",
    display_name: "Mayor Eliza",
    sprite_url: "/assets/characters/npc/mayor.png",
    spawn_zone: "courtyard",
    is_permanent: true,
    persona_prompt:
      "You are Mayor Eliza, the warm and knowledgeable historian of the TSI club. You greet members with genuine warmth, remember small details, and love sharing stories about past chapters, members who have moved on, and the traditions that make TSI feel like home. You speak in a measured, welcoming cadence — never rushed, never preachy. Keep responses under 3 sentences unless asked for a story.",
    canned_dialogue: [
      "Welcome back to the courtyard. The light here changes with the season — have you noticed?",
      "Every brick in this square was laid by someone who believed in this place. You belong here too.",
      "If you ever want to hear how this all started, you know where to find me.",
    ],
    active: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "shopkeeper-fallback",
    slug: "shopkeeper",
    display_name: "Toren",
    sprite_url: "/assets/characters/npc/shopkeeper.png",
    spawn_zone: "shop",
    is_permanent: true,
    persona_prompt:
      "You are Toren, the shopkeeper. Dry, deadpan humor. You sell things to club members and take mild satisfaction in pointing out when an item is overpriced (it usually is, in your opinion). You are not rude — just unimpressed. Keep responses short, often one sentence. Occasionally drop a line about your shop, your inventory, or the absurdity of TSI coin economics.",
    canned_dialogue: [
      "Welcome. Browse if you must.",
      "Everything here is, technically, for sale. Some of it is even worth buying.",
      "The hoodie is a hoodie. It will keep you warm. That is the entire pitch.",
    ],
    active: true,
    created_at: NOW,
    updated_at: NOW,
  },
];

// Sprint E2: mirrors migration 019 seed. All 5 are always-unlocked, active.
export const DEFAULT_EMOTE_TYPES: EmoteType[] = [
  {
    id: "emote-wave-fallback",
    slug: "wave",
    display_name: "Wave",
    animation_key: "wave",
    icon_url: null,
    unlock_condition: null,
    active: true,
    created_at: NOW,
  },
  {
    id: "emote-dance-fallback",
    slug: "dance",
    display_name: "Dance",
    animation_key: "dance",
    icon_url: null,
    unlock_condition: null,
    active: true,
    created_at: NOW,
  },
  {
    id: "emote-laugh-fallback",
    slug: "laugh",
    display_name: "Laugh",
    animation_key: "laugh",
    icon_url: null,
    unlock_condition: null,
    active: true,
    created_at: NOW,
  },
  {
    id: "emote-point-fallback",
    slug: "point",
    display_name: "Point",
    animation_key: "point",
    icon_url: null,
    unlock_condition: null,
    active: true,
    created_at: NOW,
  },
  {
    id: "emote-sit-fallback",
    slug: "sit",
    display_name: "Sit",
    animation_key: "sit",
    icon_url: null,
    unlock_condition: null,
    active: true,
    created_at: NOW,
  },
];

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  {
    id: "tsi-hoodie-fallback",
    slug: "tsi-hoodie",
    display_name: "TSI Hoodie",
    category: "merch",
    sprite_url: null,
    description: "Heavyweight cotton hoodie with the TSI crest. Pickup at HQ.",
    tc_price: 1500,
    rarity: "rare",
    stock: 50,
    active: true,
    released_at: NOW,
    retired_at: null,
  },
  {
    id: "glitch-aura-fallback",
    slug: "glitch-aura",
    display_name: "Glitch Aura",
    category: "avatar-effect",
    sprite_url: null,
    description: "A flickering chromatic aberration that follows your avatar.",
    tc_price: 800,
    rarity: "epic",
    stock: null,
    active: true,
    released_at: NOW,
    retired_at: null,
  },
  {
    id: "founder-badge-fallback",
    slug: "founder-badge",
    display_name: "Founder Badge",
    category: "profile-customization",
    sprite_url: null,
    description:
      "A rare badge displayed on your profile and in the directory.",
    tc_price: 5000,
    rarity: "legendary",
    stock: 25,
    active: true,
    released_at: NOW,
    retired_at: null,
  },
];
