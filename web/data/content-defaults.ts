// ─── Bundled Content Defaults ───────────────────────────────────────────────
// Fallback data used when Supabase env vars are missing or queries fail.
// Must match the seed values in `web/supabase/migrations/014_content_pipeline.sql`
// so dev mode and prod render identically when Supabase is unreachable.

import type {
  NPCPersona,
  SeasonalPalette,
} from "@/lib/content/types";
import { RESIDENT_TALK } from "@/lib/content/residentRoster";

const NOW = "1970-01-01T00:00:00.000Z";

export const DEFAULT_PALETTES: SeasonalPalette[] = [
  {
    id: "default-palette-fallback",
    slug: "default",
    display_name: "Default",
    palette: {
      sky: "#BFE9FA",
      grass: "#84CB47",
      accent: "#FFD166",
      fog: "#CDEBF7",
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
  // Seasonal set (wake 64, specs/seasonal-palettes.md): the monthly-cadence
  // palettes per principle #8. An admin flips the season by activating the
  // matching seasonal_palettes row — these are the fallback/seed values.
  // The member island (DefaultIslandWorld) blends all four season rows by
  // date (lib/game/season.ts) and reads `island_grass` / `leaf`. Those were
  // derived from ACNH's own seasonal ramps (FldUnit mGrass_Grd, PltTreeOak
  // mPltTreeOakLeafColor_Grd): hue and saturation from the ramp's spring /
  // late-October rows, lightness from our calibrated summer tint. Winter
  // ground is the snow cover, not a tint. Admins retune these rows.
  {
    id: "autumn-palette-fallback",
    slug: "autumn",
    display_name: "Autumn Harvest",
    palette: {
      sky: "#D8E4EE",
      grass: "#9FA23F",
      accent: "#E07B39",
      fog: "#E4D9BF",
      water: "#4E7FA8",
      building_primary: "#C08A52",
      building_accent: "#7A5230",
      island_grass: "#A4A046",
      leaf: "#FF9A3C",
    },
    active: false,
    scheduled_start: "2026-09-15T00:00:00Z",
    scheduled_end: "2026-11-30T23:59:59Z",
    created_at: NOW,
  },
  {
    id: "winter-palette-fallback",
    slug: "winter",
    display_name: "Winter Frost",
    palette: {
      sky: "#C7D8E8",
      grass: "#E8EEF2",
      accent: "#E86A6A",
      fog: "#DCE8F2",
      water: "#3A5F80",
      building_primary: "#B9C4CE",
      building_accent: "#6E7E8A",
      island_grass: "#C9D6CB",
      leaf: "#E6ECEF",
    },
    active: false,
    scheduled_start: "2026-12-01T00:00:00Z",
    scheduled_end: "2027-02-28T23:59:59Z",
    created_at: NOW,
  },
  {
    id: "spring-palette-fallback",
    slug: "spring",
    display_name: "Spring Sakura",
    palette: {
      sky: "#CFE8F7",
      grass: "#8FD16A",
      accent: "#F5A9C4",
      fog: "#EBD9E4",
      water: "#5A9FD4",
      building_primary: "#D9B08C",
      building_accent: "#8B6F5E",
      island_grass: "#A9C271",
      leaf: "#BCC97D",
    },
    active: false,
    scheduled_start: "2027-03-15T00:00:00Z",
    scheduled_end: "2027-05-15T23:59:59Z",
    created_at: NOW,
  },
  {
    // Summer is the calibrated baseline shipped with the applicant island look.
    id: "summer-palette-fallback",
    slug: "summer",
    display_name: "Summer Green",
    palette: {
      sky: "#BFE9FA",
      grass: "#84CB47",
      accent: "#FFD166",
      fog: "#CDEBF7",
      water: "#398D9F",
      building_primary: "#D4A574",
      building_accent: "#8B6F4E",
      island_grass: "#91B47F",
      leaf: "#9BC87E",
    },
    active: false,
    scheduled_start: "2027-06-21T00:00:00Z",
    scheduled_end: "2027-09-21T23:59:59Z",
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
    schedule: { day: "path" },
    is_permanent: true,
    persona_prompt:
      "You are Mayor Eliza, the warm and knowledgeable historian of the TSI club. You greet members with genuine warmth, remember small details, and love sharing stories about past chapters, members who have moved on, and the traditions that make TSI feel like home. You speak in a measured, welcoming cadence — never rushed, never preachy. Keep responses under 3 sentences unless asked for a story.",
    canned_dialogue: [
      "Welcome back to the courtyard. The light here changes with the season — have you noticed?",
      "Every brick in this square was laid by someone who believed in this place. You belong here too.",
      "If you ever want to hear how this all started, you know where to find me.",
    ],
    talk: RESIDENT_TALK.mayor,
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
    post: "shopkeeper",
    schedule: { day: "shop" },
    is_permanent: true,
    persona_prompt:
      "You are Toren, the shopkeeper. Dry, deadpan humor. You sell things to club members and take mild satisfaction in pointing out when an item is overpriced (it usually is, in your opinion). You are not rude — just unimpressed. Keep responses short, often one sentence. Occasionally drop a line about your shop, your inventory, or the absurdity of TSI coin economics.",
    canned_dialogue: [
      "Welcome. Browse if you must.",
      "Everything here is, technically, for sale. Some of it is even worth buying.",
      "The hoodie is a hoodie. It will keep you warm. That is the entire pitch.",
    ],
    talk: RESIDENT_TALK.shopkeeper,
    active: true,
    created_at: NOW,
    updated_at: NOW,
  },
];
