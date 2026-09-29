/**
 * Seed content for progression. Mirrors the INSERTs at the bottom of
 * supabase/migrations/20260926150200_progression.sql. Used as the fallback shape when
 * the migration is not applied (dev, previews) and by tests.
 */
import type { ClubGoal, GoalCaps, GoalEvent, GoalWeights, QuestChapter } from "./types";

// Row 181: ~30 event check-ins (30 × 500) or ~15,000 coins fills a story goal.
export const DEFAULT_WEIGHTS: GoalWeights = { coins: 1, material: 20, specimen: 100, event: 500, bounty: 750, admin: 1 };
export const DEFAULT_CAPS: GoalCaps = { member_total: 3000, delivery: 1500 };
export const DEFAULT_TARGET = 15000;
export const NO_EVENT: GoalEvent = { decor: null, tourney: false, catches: [], rewards: [], posters: [] };

/**
 * The four yearly events (rows 204, 212; specs/seasonal-events.md), seeded by
 * 20260929120000_seasonal_events.sql. Windows are Toronto wall-clock dates in
 * 2026 and repeat every year (goalCycle); admins retune them per year.
 */
const seasonal = (n: number, slug: string, title: string, summary: string, window: [string, string], accepts: ClubGoal["accepts"], event: Partial<GoalEvent>, letter: [string, string], target = DEFAULT_TARGET): ClubGoal => ({
  id: `00000000-0000-4000-8000-00000000c1${String(n).padStart(2, "0")}`, slug, title, summary, goal_type: "seasonal", target_points: target,
  weights: { ...DEFAULT_WEIGHTS }, caps: { ...DEFAULT_CAPS }, accepts, window_start: window[0], window_end: window[1], unlocks: [], monument_key: "plaza",
  completion_letter_subject: letter[0], completion_letter_body: letter[1], position: 100 + n, active: true, event: { ...NO_EVENT, ...event },
});
export const SEASONAL_GOALS: ClubGoal[] = [
  seasonal(1, "fall-fishing-tourney", "Fall fishing tourney",
    "September is tourney month. Your biggest catch goes on the board by the plaza trophy, and a few fish only bite while it runs. Bring catches and coins to the monument, and come to club events: every check-in counts extra.",
    ["2026-09-01T04:00:00.000Z", "2026-10-01T04:00:00.000Z"], ["coins", "specimen"],
    { decor: "fall-tourney", tourney: true, catches: ["fish_yellow_perch", "fish_sturgeon", "fish_giant_trevally"], rewards: ["furn-silver-hha-trophy"] },
    ["The fall tourney goal is done", "The club filled the fall tourney goal. A tourney cup is waiting in your storage, and the winners stay on the plaza trophy until the month is out."]),
  seasonal(2, "winter-lights", "Winter lights festival",
    "Lanterns go up over the plaza and the cafe starts pouring cocoa. Chip in coins and materials at the monument, and every club event you check into this month counts extra.",
    ["2026-12-01T05:00:00.000Z", "2027-01-01T05:00:00.000Z"], ["coins", "material"],
    { decor: "winter-lights", rewards: ["furn-tree-cedar-snow", "furn-lounge-tea"] },
    ["The lights stay on", "The club filled the winter lights goal. A festive fir and a cocoa set are in your storage. Happy holidays from everyone at TSI."]),
  seasonal(3, "genesis-week", "GENESIS week",
    "The showcase comes to the island: banners, a stage in the plaza and a poster for every project. Checking in at GENESIS counts the most, and deliveries at the monument help too.",
    ["2026-03-20T04:00:00.000Z", "2026-03-27T04:00:00.000Z"], ["coins", "material", "specimen"],
    { decor: "genesis", rewards: ["furn-monument-banner"] },
    ["GENESIS week, done", "The club filled the GENESIS goal. A showcase banner is in your storage for your own island."], 7500),
  seasonal(4, "spring-picnic", "Spring blossom picnic",
    "The cherry trees are out and the picnic blankets are down by the plaza. Fill the goal together and everyone gets a flower crown and a blanket of their own.",
    ["2026-04-01T04:00:00.000Z", "2026-05-01T04:00:00.000Z"], ["coins", "material"],
    { decor: "spring-picnic", rewards: ["acc-flower-crown", "furn-beach-towel"] },
    ["Picnic season", "The club filled the spring picnic goal. A flower crown is in your closet and a picnic blanket is in your storage."]),
];

export const DEFAULT_GOALS: ClubGoal[] = [
  {
    id: "00000000-0000-4000-8000-00000000c001",
    slug: "reopen-cafe",
    title: "Reopen the cafe",
    summary:
      "The old cafe by the plaza has been boarded up for years. Bring coins and building materials to the monument, and come to club events: every check-in counts extra.",
    goal_type: "story",
    target_points: DEFAULT_TARGET,
    weights: { ...DEFAULT_WEIGHTS },
    caps: { ...DEFAULT_CAPS },
    accepts: ["coins", "material"],
    window_start: null,
    window_end: null,
    unlocks: ["cafe", "study_tables"],
    monument_key: "plaza",
    completion_letter_subject: "The cafe is open",
    completion_letter_body:
      "We did it together. The boards are off the cafe and the study tables are yours. Thank you for every coin, plank and event you showed up to.",
    position: 1,
    active: true,
    event: NO_EVENT,
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    slug: "fund-museum",
    title: "Fund the museum",
    summary:
      "The museum needs funding before its doors open. Coins and donated specimens count here, and so does showing up to club events.",
    goal_type: "story",
    target_points: DEFAULT_TARGET,
    weights: { ...DEFAULT_WEIGHTS },
    caps: { ...DEFAULT_CAPS },
    accepts: ["coins", "specimen"],
    window_start: null,
    window_end: null,
    unlocks: ["museum", "woods"],
    monument_key: "plaza",
    completion_letter_subject: "The museum is open",
    completion_letter_body:
      "The museum doors are open and the woods path is clear. Every specimen you donated has a place on the shelves.",
    position: 2,
    active: true,
    event: NO_EVENT,
  },
  ...SEASONAL_GOALS,
];

export const DEFAULT_CHAPTERS: QuestChapter[] = [
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    slug: "settle-in",
    position: 1,
    title: "Settle in",
    summary: "Claim your plot, make your first catch and donate it, then report to HQ.",
    requirement: "settle_in",
    goal_slug: null,
    step_copy: {
      claim_plot: { label: "Claim your plot at HQ" },
      first_catch: { label: "Make your first catch", hint: "Any fish counts. Try the pier." },
      donate_catch: { label: "Donate your catch to the museum shell" },
      report_hq: { label: "Report back to HQ" },
    },
    unlocks_regions: ["village_core"],
    completion_letter: "Welcome to the island. The village is yours to explore.",
    // Design principle 7: onboarding is opt-in and skippable in one click for everyone.
    skippable_max_tier: 5,
    reward_coins: 100,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a2",
    slug: "reopen-cafe",
    position: 2,
    title: "Reopen the cafe",
    summary: "The whole club is reopening the cafe. Chip in at the monument and come to events.",
    requirement: "club_goal",
    goal_slug: "reopen-cafe",
    step_copy: {
      contribute: { label: "Contribute to the cafe fund", hint: "Deliveries at the plaza monument, or come to a club event." },
      goal_complete: { label: "Cafe fund reaches its target" },
    },
    unlocks_regions: ["cafe", "study_tables"],
    completion_letter: "",
    skippable_max_tier: 0,
    reward_coins: 0,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a3",
    slug: "fund-museum",
    position: 3,
    title: "Fund the museum",
    summary: "The club is funding the museum. Specimens and coins count.",
    requirement: "club_goal",
    goal_slug: "fund-museum",
    step_copy: {
      contribute: { label: "Contribute to the museum fund" },
      goal_complete: { label: "Museum fund reaches its target" },
    },
    unlocks_regions: ["museum", "woods"],
    completion_letter: "",
    skippable_max_tier: 0,
    reward_coins: 0,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a4",
    slug: "ruins-gate",
    position: 4,
    title: "Reach the ruins gate",
    summary: "Take the Oracle quiz and finish your family trial to open the ruins gate.",
    requirement: "oracle_trial",
    goal_slug: null,
    step_copy: {
      oracle_quiz: { label: "Complete the Oracle quiz" },
      family_trial: { label: "Finish the level-10 family trial" },
      enter_gate: { label: "Open the ruins gate" },
    },
    unlocks_regions: ["cliffs", "ruins_gate"],
    completion_letter: "The ruins gate is open to you. Tread carefully.",
    skippable_max_tier: 0,
    reward_coins: 300,
    active: true,
  },
];
