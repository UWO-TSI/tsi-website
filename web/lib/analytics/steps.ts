/**
 * The one list of what the event log may hold (specs/analytics.md): the funnel's steps in order, the features, the
 * screens. The tracker (track.ts), the route (app/api/analytics/events) and the dashboard (report.ts) all read it, and
 * the table's checks only allow ids of this shape. Steps marked `tables` are also read from the game's own tables, so
 * they go back to before the log; the rest exist only from the day the log ships.
 */
type StepDef = readonly [id: string, label: string, from: "log" | "tables" | "both"];

export const STEPS = [
  ["signed_in", "Signed in", "tables"],
  ["arrival_aboard", "Opening started", "log"],
  ["arrival_creator", "Creator opened", "log"],
  ["creator", "Character made", "both"],
  ["arrival_crossing", "Boat crossing", "log"],
  ["arrival_landing", "Landed", "log"],
  ["tut_docknew", "Hopped the box", "log"],
  ["tut_dash", "Dashed", "log"],
  ["tut_hqfirst", "Walked to HQ", "log"],
  ["hq_report", "HQ: at the desk", "log"],
  ["hq_lore", "HQ: the island's story", "log"],
  ["hq_id", "HQ: island ID", "log"],
  ["hq_coins", "HQ: coins", "log"],
  ["hq_gems", "HQ: gems", "log"],
  ["hq_events", "HQ: event check-in", "log"],
  ["hq_tour", "HQ: the keys", "log"],
  ["hq_esc", "HQ: the menu", "log"],
  ["hq_done", "HQ: sent off", "log"],
  ["tut_sights", "Saw the sights", "log"],
  ["tut_wharf", "At the wharf", "log"],
  ["tut_cast", "Given the rod", "log"],
  ["first_catch", "First fish", "tables"],
  ["tut_barrel", "At the sell barrel", "log"],
  ["first_sale", "First sale", "tables"],
  ["tut_keep", "Kept the rod", "log"],
  ["arrived", "Arrival done", "both"],
  ["first_quest", "First chapter done", "tables"],
  ["day_2", "Came back day 2", "tables"],
  ["day_7", "Came back day 7", "tables"],
] as const satisfies readonly StepDef[];

export type StepId = (typeof STEPS)[number][0];
export const STEP_IDS: readonly StepId[] = STEPS.map((s) => s[0]);
export const STEP_LABEL = Object.fromEntries(STEPS.map(([id, label]) => [id, label])) as Record<StepId, string>;
/** Steps only the event log knows: their share is of the players who joined after it started. */
export const LOG_ONLY = new Set<StepId>(STEPS.filter((s) => s[2] === "log").map((s) => s[0]));
/** Steps the tab may send (the rest come from the tables). */
export const CLIENT_STEPS: readonly StepId[] = STEPS.filter((s) => s[2] !== "tables").map((s) => s[0]);
export const isClientStep = (s: string): s is StepId => (CLIENT_STEPS as readonly string[]).includes(s);

/** Features, and the route a write announces (lib/apiClient.ts API_WRITE) that counts as using it. First match wins. */
const FEATURE_ROUTES = [
  ["fishing", "Fishing", null],
  ["foraging", "Bugs, digging and foraging", null],
  ["selling", "Selling", "/api/economy/sell"],
  ["shop", "Shop", "/api/economy/buy"],
  ["daily_gift", "Daily gift", "/api/economy/daily-gift"],
  ["sushi", "Sushi", "/api/economy/sushi"],
  ["chef", "Chef orders", "/api/economy/chef"],
  ["fish_tasks", "Fishing tasks", "/api/economy/tasks"],
  ["tackle", "Tackle", "/api/economy/tackle"],
  ["wardrobe", "Wardrobe", "/api/economy/equip"],
  ["museum", "Museum", "/api/collections/museum"],
  ["cooking", "Eating", "/api/collections/eat"],
  ["derby", "Fishing derby", "/api/collections/tourney"],
  ["crafting", "Crafting", "/api/crafting/craft"],
  ["combat", "Combat", "/api/combat"],
  ["study", "Study tables", "/api/study"],
  ["volleyball", "Volleyball", "/api/volleyball"],
  ["campfire", "Campfire", "/api/world/campfire"],
  ["residents", "Talking to residents", "/api/npc"],
  ["oracle", "Oracle", "/api/oracle"],
  ["home", "Home", "/api/homes"],
  ["friends", "Friends", "/api/world/friends"],
  ["quests", "Quest chapters", "/api/progression/chapters"],
  ["digging", "Digging", null],
  ["missions", "Missions", null],
  ["chat", "World chat", null],
] as const;

export type FeatureId = (typeof FEATURE_ROUTES)[number][0];
export const FEATURES: readonly FeatureId[] = FEATURE_ROUTES.map((f) => f[0]);
const FEATURE_LABEL = Object.fromEntries(FEATURE_ROUTES.map(([id, label]) => [id, label])) as Record<string, string>;
export const featureLabel = (f: string) => FEATURE_LABEL[f] ?? f;
export function featureForPath(path: string): FeatureId | null {
  for (const [id, , route] of FEATURE_ROUTES) if (route && (path === route || path.startsWith(`${route}/`) || path.startsWith(`${route}?`))) return id;
  return null;
}

/** Where the player is: the island they're on, the room they're in, or the sheet open over it (DefaultIslandWorld). */
export const SCREENS = [
  "village", "home", "ruins", "hq", "house", "museum", "oracle", "cafe", "shop",
  "counter", "shopkeeper", "notice", "letters", "journal", "trophies", "showcase", "closet", "fitting", "path", "settings",
  "missions", "tourney", "posters", "bag", "wallet", "chest", "plaque", "sell", "monument", "vboard", "rods", "outnow",
  "tasks", "tackle", "chef", "sushi", "opening",
] as const;
export type Screen = (typeof SCREENS)[number];
