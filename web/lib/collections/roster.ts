/**
 * Launch species roster (ledger rows 128, 129): ~40 fish, 12 sea/shore
 * creatures, 20 bugs, 8 fruit, 15 shells/mushrooms/flowers, 5 rocks/ore.
 *
 * Seeded from what the worktree already ships: fish rarity/size come from
 * lib/game/fishing.ts (FISH), bugs/shore crabs from components/game/Critters.tsx,
 * flowers from FlowerPickFX, fruit from CollectionBook, shells from
 * public/assets/acnh/props/shell-*.glb. Species without a model yet are
 * `asset_ready: false` (listed so the journal and museum have their slots).
 * Mirrored into supabase/migrations/20260926150400_collections.sql by
 * scripts/gen-seeds.mjs; collections.test.ts keeps them in sync.
 *
 * Hours are local island time, [start, end) wrapping past midnight; null = all
 * day. Months 1-12 (northern hemisphere, Ontario); [] = all year. `weather` []
 * = any. `rainAnyHour`: also out in the rain outside its hours.
 */
export type Category = "fish" | "sea" | "bug" | "fruit" | "nature" | "mineral";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Biome = "river" | "pond" | "cliff_pool" | "sea" | "beach" | "flowers" | "trees" | "ground" | "water_edge" | "bush" | "woods" | "rocks";
export type Tool = "rod" | "net" | "hand" | "shovel";
export type Wing = "aquarium" | "insect_hall" | "nature_room";

export interface Species {
  key: string;
  category: Category;
  sub: string | null;
  name: string;
  biome: Biome;
  tool: Tool;
  rarity: Rarity;
  size: [number, number] | null;
  hours: [number, number] | null;
  rainAnyHour: boolean;
  weather: ("clear" | "cloudy" | "rain" | "snow")[];
  months: number[];
  oneLiner: string;
  icon: string | null;
  model: string | null;
  assetReady: boolean;
  donatable: boolean;
  wing: Wing | null;
  position: number;
}

const DAY: [number, number] = [6, 18];
const NIGHT: [number, number] = [20, 4];
const MIDDAY: [number, number] = [9, 16];
const EVE_NIGHT: [number, number] = [16, 9];
const LATE: [number, number] = [21, 4];
const AUTUMN = [9, 10, 11];
const SPRING_AUTUMN = [3, 4, 5, 6, 9, 10, 11];

type Row = [key: string, name: string, biome: Biome, rarity: Rarity, size: [number, number] | null, hours: [number, number] | null, extra?: Partial<Species>];
let pos = 0;
const icon = (key: string) => `/assets/acnh/icons/${key}.png`;

function make(category: Category, tool: Tool, wing: Wing | null, rows: Row[], defaults: Partial<Species> = {}): Species[] {
  return rows.map(([key, name, biome, rarity, size, hours, extra]) => ({
    key, category, sub: null, name, biome, tool, rarity, size, hours, rainAnyHour: false, weather: [], months: [],
    oneLiner: "", icon: icon(key), model: null, assetReady: true, donatable: wing !== null, wing, position: ++pos,
    ...defaults, ...extra,
  }));
}

// ── Fish (40): trimmed from the 81 modelled species to a biome/rarity spread ──
const FISH_ROWS: Row[] = [
  // river
  ["fish_dace", "Dace", "river", "common", [10, 18], null, { oneLiner: "A dependable little river fish." }],
  ["fish_pale_chub", "Pale Chub", "river", "common", [8, 14], DAY, { oneLiner: "Pale, quick and everywhere in daylight." }],
  ["fish_loach", "Loach", "river", "common", [12, 20], null, { months: [3, 4, 5], oneLiner: "Whiskers first, then the rest of it." }],
  ["fish_freshwater_goby", "Freshwater Goby", "river", "common", [10, 15], NIGHT, { oneLiner: "Comes out when the lamps come on." }],
  ["fish_sweetfish", "Sweetfish", "river", "uncommon", [18, 30], null, { months: [7, 8, 9], oneLiner: "Smells faintly of melon. Really." }],
  ["fish_salmon", "Salmon", "river", "uncommon", [50, 80], null, { months: AUTUMN, oneLiner: "Headed upstream, like the rest of us in October." }],
  ["fish_rainbow_trout", "Rainbow Trout", "river", "uncommon", [30, 50], [5, 19], { months: SPRING_AUTUMN, oneLiner: "Every colour, all at once." }],
  ["fish_yamame_trout", "Yamame Trout", "river", "uncommon", [20, 35], null, { months: SPRING_AUTUMN, oneLiner: "Spotted along the flanks like river pebbles." }],
  ["fish_black_bass", "Black Bass", "river", "rare", [30, 55], null, { oneLiner: "Put up a real fight." }],
  ["fish_pike", "Pike", "river", "rare", [50, 90], null, { months: [9, 10, 11, 12], oneLiner: "All teeth and patience." }],
  ["fish_snakehead", "Snakehead", "river", "rare", [40, 90], MIDDAY, { oneLiner: "Breathes air when it feels like it." }],
  ["fish_catfish", "Catfish", "river", "epic", [50, 110], NIGHT, { rainAnyHour: true, oneLiner: "Whiskers the size of a bookmark." }],
  ["fish_king_salmon", "King Salmon", "river", "epic", [70, 120], null, { months: [9], oneLiner: "The heaviest thing in the river in September." }],
  // pond
  ["fish_bitterling", "Bitterling", "pond", "common", [5, 10], null, { months: [11, 12, 1, 2, 3], oneLiner: "Small and a little shiny." }],
  ["fish_killifish", "Killifish", "pond", "common", [3, 5], [6, 20], { months: [4, 5, 6, 7, 8], oneLiner: "Tiny, but it counts." }],
  ["fish_tadpole", "Tadpole", "pond", "common", [3, 5], null, { months: [3, 4, 5, 6, 7], oneLiner: "Will be a frog by next month." }],
  ["fish_frog", "Frog", "pond", "common", [5, 10], null, { months: [5, 6, 7, 8], oneLiner: "Not technically a fish. Donate it anyway." }],
  ["fish_crucian_carp", "Crucian Carp", "pond", "uncommon", [15, 30], null, { oneLiner: "A pond regular." }],
  ["fish_goldfish", "Goldfish", "pond", "uncommon", [8, 15], null, { oneLiner: "Someone's old pet, living its best life." }],
  ["fish_carp", "Carp", "pond", "uncommon", [35, 70], null, { oneLiner: "Big, calm, unbothered." }],
  ["fish_bluegill", "Bluegill", "pond", "uncommon", [12, 22], MIDDAY, { oneLiner: "Blue cheeks, bright afternoons." }],
  ["fish_snapping_turtle", "Snapping Turtle", "pond", "rare", [20, 35], NIGHT, { months: [4, 5, 6, 7, 8, 9, 10], oneLiner: "Keep fingers clear." }],
  ["fish_golden_koi", "Golden Koi", "pond", "legendary", [60, 95], null, { oneLiner: "The pond's quiet celebrity." }],
  // cliff pools
  ["fish_char", "Char", "cliff_pool", "rare", [40, 60], null, { months: SPRING_AUTUMN, oneLiner: "Cold water, clear head." }],
  ["fish_gar", "Gar", "cliff_pool", "epic", [90, 150], EVE_NIGHT, { rainAnyHour: true, months: [6, 7, 8, 9], oneLiner: "Older than the dinosaurs, and looks it." }],
  ["fish_golden_trout", "Golden Trout", "cliff_pool", "legendary", [40, 60], null, { months: [3, 4, 5, 9, 10, 11], oneLiner: "Glows like the last hour of daylight." }],
  ["fish_stringfish", "Stringfish", "cliff_pool", "legendary", [80, 130], LATE, { rainAnyHour: true, months: [12, 1, 2, 3], oneLiner: "Long, pale and very rare." }],
  // sea (beach and pier)
  ["fish_anchovy", "Anchovy", "sea", "common", [10, 15], DAY, { oneLiner: "Comes in a crowd." }],
  ["fish_horse_mackerel", "Horse Mackerel", "sea", "common", [20, 40], null, { oneLiner: "The pier's bread and butter." }],
  ["fish_sea_bass", "Sea Bass", "sea", "common", [50, 90], null, { oneLiner: "No, it's at least a C+." }],
  ["fish_squid", "Squid", "sea", "common", [20, 40], null, { months: [12, 1, 2, 3, 4, 5, 6, 7, 8], oneLiner: "Eight arms, zero regrets." }],
  ["fish_olive_flounder", "Olive Flounder", "sea", "uncommon", [40, 80], null, { oneLiner: "Both eyes on one side, always watching." }],
  ["fish_red_snapper", "Red Snapper", "sea", "uncommon", [30, 60], null, { oneLiner: "The colour of a good sunset." }],
  ["fish_blowfish", "Blowfish", "sea", "uncommon", [20, 40], NIGHT, { months: [11, 12, 1, 2], oneLiner: "Please don't squeeze it." }],
  ["fish_barred_knifejaw", "Barred Knifejaw", "sea", "uncommon", [30, 50], null, { months: [3, 4, 5, 6, 7, 8, 9, 10, 11], oneLiner: "Striped like a club hoodie." }],
  ["fish_ray", "Ray", "sea", "rare", [100, 200], DAY, { months: [8, 9, 10, 11], oneLiner: "Glides like it has somewhere to be." }],
  ["fish_mahi_mahi", "Mahi-mahi", "sea", "rare", [80, 140], null, { months: [6, 7, 8, 9], oneLiner: "So good they named it twice." }],
  ["fish_football_fish", "Football Fish", "sea", "rare", [30, 60], NIGHT, { months: [11, 12, 1, 2, 3], oneLiner: "Brings its own lamp." }],
  ["fish_tuna", "Tuna", "sea", "epic", [150, 250], null, { months: [11, 12, 1, 2, 3, 4], oneLiner: "Built like a torpedo." }],
  ["fish_coelacanth", "Coelacanth", "sea", "legendary", [120, 180], NIGHT, { weather: ["rain"], oneLiner: "A living fossil that only shows up on rainy nights." }],
];

// ── Sea and shore creatures (12): pulled up at sea spots / found on the beach ──
const SEA_ROWS: Row[] = [
  ["sea_scallop", "Scallop", "sea", "common", [8, 14], null],
  ["sea_sweet_shrimp", "Sweet Shrimp", "sea", "common", [5, 9], EVE_NIGHT],
  ["sea_sea_star", "Sea Star", "sea", "common", [8, 15], null],
  ["sea_barnacle", "Acorn Barnacle", "sea", "common", [2, 4], null],
  ["sea_dungeness_crab", "Dungeness Crab", "sea", "uncommon", [15, 25], null],
  ["sea_garden_eel", "Garden Eel", "sea", "uncommon", [30, 40], DAY],
  ["sea_firefly_squid", "Firefly Squid", "sea", "uncommon", [5, 8], LATE],
  ["sea_abalone", "Abalone", "sea", "rare", [12, 20], EVE_NIGHT],
  ["sea_pearl_oyster", "Pearl Oyster", "sea", "rare", [7, 12], null],
  ["sea_giant_isopod", "Giant Isopod", "sea", "epic", [20, 40], NIGHT],
  ["shore_gazami_crab", "Gazami Crab", "beach", "common", [10, 20], DAY, { tool: "hand" }],
  ["shore_hermit_crab", "Hermit Crab", "beach", "common", [3, 8], null, { tool: "hand" }],
];

// ── Bugs (20): 13 with models in Critters.tsx, 7 roster-only ──
const BUG_ROWS: Row[] = [
  ["bug_common_butterfly", "Common Butterfly", "flowers", "common", null, DAY, { months: [4, 5, 6, 7, 8, 9] }],
  ["bug_agrias_butterfly", "Agrias Butterfly", "flowers", "rare", null, DAY, { months: [5, 6, 7, 8] }],
  ["bug_emperor_butterfly", "Emperor Butterfly", "flowers", "rare", null, [17, 4]],
  ["bug_monarch_butterfly", "Monarch Butterfly", "flowers", "uncommon", null, DAY, { months: [8, 9, 10] }],
  ["bug_tiger_butterfly", "Tiger Butterfly", "flowers", "common", null, DAY, { months: [5, 6, 7, 8] }],
  ["bug_peacock_butterfly", "Peacock Butterfly", "flowers", "uncommon", null, NIGHT],
  ["bug_darner_dragonfly", "Darner Dragonfly", "water_edge", "uncommon", null, DAY, { months: [6, 7, 8, 9] }],
  ["bug_red_dragonfly", "Red Dragonfly", "water_edge", "common", null, DAY, { months: [9, 10] }],
  ["bug_ladybug", "Ladybug", "flowers", "common", null, DAY, { months: [4, 5, 6, 10] }],
  ["bug_brown_cicada", "Brown Cicada", "trees", "uncommon", null, DAY, { months: [7, 8] }],
  ["bug_firefly", "Firefly", "water_edge", "uncommon", null, [19, 4], { months: [6, 7] }],
  ["bug_mantis", "Mantis", "flowers", "rare", null, DAY, { months: [8, 9, 10, 11] }],
  ["bug_grasshopper", "Grasshopper", "ground", "common", null, DAY, { months: [7, 8, 9] }],
  ["bug_honeybee", "Honeybee", "flowers", "common", null, DAY, { months: [3, 4, 5, 6, 7] }],
  ["bug_stag_beetle", "Stag Beetle", "trees", "rare", null, [17, 8], { months: [7, 8] }],
  ["bug_rhinoceros_beetle", "Rhinoceros Beetle", "trees", "epic", null, [23, 8], { months: [7, 8] }],
  ["bug_walking_stick", "Walking Stick", "trees", "uncommon", null, [4, 19], { months: [7, 8, 9, 10, 11] }],
  ["bug_snail", "Snail", "ground", "common", null, null, { weather: ["rain"] }],
  ["bug_cricket", "Cricket", "ground", "common", null, [17, 8], { months: [9, 10, 11] }],
  ["bug_bagworm", "Bagworm", "trees", "common", null, null, { months: [1, 2, 3, 11, 12] }],
];
const BUG_MODELLED = new Set(BUG_ROWS.slice(0, 13).map((r) => r[0]));

// ── Fruit (8): not donatable; apple/peach have icons ──
const FRUIT_ROWS: Row[] = [
  ["apple", "Apple", "trees", "common", null, null],
  ["peach", "Peach", "trees", "common", null, null],
  ["fruit_pear", "Pear", "trees", "common", null, null, { months: [8, 9, 10] }],
  ["fruit_orange", "Orange", "trees", "common", null, null],
  ["fruit_cherry", "Cherry", "trees", "uncommon", null, null, { months: [6, 7] }],
  ["fruit_coconut", "Coconut", "beach", "uncommon", null, null],
  ["fruit_blackberry", "Blackberry", "bush", "common", null, null, { months: [7, 8, 9] }],
  ["fruit_blueberry", "Blueberry", "bush", "common", null, null, { months: [7, 8] }],
];

// ── Nature room (15): 8 flowers (picked in-world), 4 shells (models), 3 mushrooms ──
const NATURE_ROWS: Row[] = [
  ["flower_cosmos", "Pink Cosmos", "flowers", "common", null, null, { sub: "flower", months: [6, 7, 8, 9, 10] }],
  ["flower_lily", "White Lily", "flowers", "common", null, null, { sub: "flower", months: [5, 6, 7, 8] }],
  ["flower_hyacinth", "Blue Hyacinth", "flowers", "uncommon", null, null, { sub: "flower", months: [3, 4, 5] }],
  ["flower_mum", "Yellow Mum", "flowers", "common", null, null, { sub: "flower", months: [9, 10, 11] }],
  ["flower_rose", "Red Rose", "flowers", "uncommon", null, null, { sub: "flower", months: [5, 6, 7, 8, 9] }],
  ["flower_tulip", "Orange Tulip", "flowers", "common", null, null, { sub: "flower", months: [4, 5] }],
  ["flower_pansy", "Purple Pansy", "flowers", "common", null, null, { sub: "flower", months: [3, 4, 5, 9, 10] }],
  ["flower_windflower", "Windflower", "flowers", "rare", null, null, { sub: "flower", months: [3, 4, 10, 11] }],
  ["shell_asari", "Asari Clam", "beach", "common", [3, 6], null, { sub: "shell", tool: "shovel", icon: null, model: "/assets/acnh/props/shell-asari.glb" }],
  ["shell_scallop", "Scallop Shell", "beach", "common", [6, 12], null, { sub: "shell", icon: null, model: "/assets/acnh/props/shell-scallop.glb" }],
  ["shell_turban", "Turban Shell", "beach", "uncommon", [5, 10], null, { sub: "shell", icon: null, model: "/assets/acnh/props/shell-turban.glb" }],
  ["shell_whelk", "Whelk Shell", "beach", "rare", [8, 16], null, { sub: "shell", icon: null, model: "/assets/acnh/props/shell-whelk.glb" }],
  ["mushroom_round", "Round Mushroom", "woods", "common", null, null, { sub: "mushroom", months: AUTUMN, icon: null, assetReady: false }],
  ["mushroom_flat", "Flat Mushroom", "woods", "uncommon", null, null, { sub: "mushroom", months: AUTUMN, icon: null, assetReady: false }],
  ["mushroom_skinny", "Skinny Mushroom", "woods", "rare", null, null, { sub: "mushroom", months: [11], icon: null, assetReady: false }],
];

// ── Rocks and ore (5): crafting materials, struck with a tool; not donatable ──
const MINERAL_ROWS: Row[] = [
  ["rock_stone", "Stone", "rocks", "common", null, null],
  ["rock_clay", "Clay", "rocks", "common", null, null],
  ["rock_iron_nugget", "Iron Nugget", "rocks", "uncommon", null, null],
  ["rock_gold_nugget", "Gold Nugget", "rocks", "epic", null, null],
  ["rock_crystal", "Crystal", "rocks", "rare", null, null],
];

export const ROSTER: Species[] = [
  ...make("fish", "rod", "aquarium", FISH_ROWS, { model: null }),
  ...make("sea", "rod", "aquarium", SEA_ROWS),
  ...make("bug", "net", "insect_hall", BUG_ROWS).map((s) => (BUG_MODELLED.has(s.key) ? s : { ...s, icon: null, assetReady: false })),
  ...make("fruit", "hand", null, FRUIT_ROWS).map((s) => (s.key === "apple" || s.key === "peach" ? s : { ...s, icon: null, assetReady: false })),
  ...make("nature", "hand", "nature_room", NATURE_ROWS),
  ...make("mineral", "shovel", null, MINERAL_ROWS, { icon: null, assetReady: false }),
];

export const CATEGORIES: Category[] = ["fish", "sea", "bug", "fruit", "nature", "mineral"];
export const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
export const WING_OF: Record<Category, Wing | null> = { fish: "aquarium", sea: "aquarium", bug: "insect_hall", fruit: null, nature: "nature_room", mineral: null };
