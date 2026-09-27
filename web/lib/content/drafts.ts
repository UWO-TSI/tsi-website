/**
 * Tables the content pipeline (draft → publish, content_versions, activity
 * log) may write, and the server-side check each runs before a draft is saved.
 */
import { validateRecipeDraft } from "@/lib/crafting/recipes";
import { validateChapterDraft } from "@/lib/progression/chapters";
import { validateGoalDraft } from "@/lib/progression/goals";
import { validateResidentDraft } from "./residents";

export const CONTENT_TABLES = new Set(["npc_personas", "shop_items", "seasonal_palettes", "emote_types", "quest_chapters", "club_goals", "crafting_recipes"]);

export const DRAFT_VALIDATORS: Record<string, (d: Record<string, unknown>) => string[]> = {
  npc_personas: validateResidentDraft,
  quest_chapters: validateChapterDraft,
  club_goals: validateGoalDraft,
  crafting_recipes: validateRecipeDraft,
};
