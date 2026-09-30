/**
 * Tables the content pipeline (draft → publish, content_versions, activity
 * log) may write, and the server-side check each runs before a draft is saved.
 */
import { validateRecipeDraft } from "@/lib/crafting/recipes";
import { validateChapterDraft } from "@/lib/progression/chapters";
import { validateGoalDraft } from "@/lib/progression/goals";
import { validateResidentDraft } from "./residents";
import { CONTENT_ROUTES } from "./types";

/** The versioned tables (CONTENT_ROUTES) and the emotes, which have no history page. */
export const CONTENT_TABLES = new Set<string>([...Object.keys(CONTENT_ROUTES), "emote_types"]);

export const DRAFT_VALIDATORS: Record<string, (d: Record<string, unknown>) => string[]> = {
  npc_personas: validateResidentDraft,
  quest_chapters: validateChapterDraft,
  club_goals: validateGoalDraft,
  crafting_recipes: validateRecipeDraft,
};
