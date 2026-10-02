/**
 * Launch species roster (ledger rows 128, 129): ~40 fish, 12 sea/shore
 * creatures, 20 bugs, 8 fruit, 15 shells/mushrooms/flowers, 5 rocks/ore.
 *
 * Seeded from what the worktree already ships: fish rarity/size come from
 * lib/game/fishing.ts (FISH), bugs/shore crabs from components/game/Critters.tsx,
 * flowers from FlowerPickFX, fruit from CollectionBook, shells from
 * public/assets/acnh/props/shell-*.glb. Species without a model yet are
 * `asset_ready: false` (listed so the journal and museum have their slots).
 * Seeded from here (lib/seedMigrations.ts: after a change run
 * scripts/gen-seeds.mjs); seedMigrations.test.ts keeps them in sync.
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
/** Every species' icon, rendered from its model (row 281, lib/icons/manifest.ts). */
const icon = (key: string) => `/assets/icons/${key}.webp`;

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
  ["shell_asari", "Asari Clam", "beach", "common", [3, 6], null, { sub: "shell", tool: "shovel", model: "/assets/acnh/props/shell-asari.glb" }],
  ["shell_scallop", "Scallop Shell", "beach", "common", [6, 12], null, { sub: "shell", model: "/assets/acnh/props/shell-scallop.glb" }],
  ["shell_turban", "Turban Shell", "beach", "uncommon", [5, 10], null, { sub: "shell", model: "/assets/acnh/props/shell-turban.glb" }],
  ["shell_whelk", "Whelk Shell", "beach", "rare", [8, 16], null, { sub: "shell", model: "/assets/acnh/props/shell-whelk.glb" }],
  ["mushroom_round", "Round Mushroom", "woods", "common", null, null, { sub: "mushroom", months: AUTUMN, assetReady: false }],
  ["mushroom_flat", "Flat Mushroom", "woods", "uncommon", null, null, { sub: "mushroom", months: AUTUMN, assetReady: false }],
  ["mushroom_skinny", "Skinny Mushroom", "woods", "rare", null, null, { sub: "mushroom", months: [11], assetReady: false }],
];

// ── Rocks and ore (5): crafting materials, struck with a tool; not donatable ──
const MINERAL_ROWS: Row[] = [
  ["rock_stone", "Stone", "rocks", "common", null, null],
  ["rock_clay", "Clay", "rocks", "common", null, null],
  ["rock_iron_nugget", "Iron Nugget", "rocks", "uncommon", null, null],
  ["rock_gold_nugget", "Gold Nugget", "rocks", "epic", null, null],
  ["rock_crystal", "Crystal", "rocks", "rare", null, null],
];

/** The launch roster, seeded by 20260926150400_collections.sql. */
export const LAUNCH_ROSTER: Species[] = [
  ...make("fish", "rod", "aquarium", FISH_ROWS, { model: null }),
  ...make("sea", "rod", "aquarium", SEA_ROWS),
  ...make("bug", "net", "insect_hall", BUG_ROWS).map((s) => (BUG_MODELLED.has(s.key) ? s : { ...s, assetReady: false })),
  ...make("fruit", "hand", null, FRUIT_ROWS).map((s) => (s.key === "apple" || s.key === "peach" ? s : { ...s, assetReady: false })),
  ...make("nature", "hand", "nature_room", NATURE_ROWS),
  ...make("mineral", "shovel", null, MINERAL_ROWS, { assetReady: false }),
];

/**
 * Limited-time catches (specs/seasonal-events.md): modelled fish that only
 * bite while their seasonal event runs (the goal's event.catches), seeded by
 * 20260929120000_seasonal_events.sql.
 */
export const EVENT_SPECIES: Species[] = make("fish", "rod", "aquarium", [
  ["fish_yellow_perch", "Yellow Perch", "river", "common", [20, 30], null, { months: [9], oneLiner: "Tourney season's favourite. Striped like the leaves." }],
  ["fish_sturgeon", "Sturgeon", "river", "legendary", [100, 200], null, { months: [9], oneLiner: "Older than the lake. Only surfaces for the tourney." }],
  ["fish_giant_trevally", "Giant Trevally", "sea", "rare", [80, 150], null, { months: [9], oneLiner: "Hits the line like it has a grudge." }],
], { model: null });

const SUMMER = [6, 7, 8, 9];
const WARM = [4, 5, 6, 7, 8, 9];
const APR_NOV = [4, 5, 6, 7, 8, 9, 10, 11];
/**
 * The reel's other catches (row 260: every fish the reel can land is on the
 * roster). Rarity, size and hours are the reel's own (FISH); months are the
 * northern-hemisphere seasons the launch fish use. Seeded with the launch
 * roster (lib/seedMigrations.ts), after the event species so no earlier
 * position moves.
 */
export const REEL_FISH: Species[] = make("fish", "rod", "aquarium", [
  // river
  ["fish_pond_smelt", "Pond Smelt", "river", "common", [6, 10], null, { months: [12, 1, 2], oneLiner: "Bites best when the water is cold enough to hurt." }],
  ["fish_guppy", "Guppy", "river", "common", [3, 5], DAY, { months: APR_NOV, oneLiner: "A splash of colour the size of a fingertip." }],
  ["fish_neon_tetra", "Neon Tetra", "river", "common", [3, 4], DAY, { months: APR_NOV, oneLiner: "Lit up blue and red like a shop sign." }],
  ["fish_angelfish", "Angelfish", "river", "uncommon", [8, 12], null, { months: [5, 6, 7, 8, 9, 10], oneLiner: "Tall, thin and very composed." }],
  ["fish_betta", "Betta", "river", "uncommon", [6, 8], DAY, { months: [5, 6, 7, 8, 9, 10], oneLiner: "Small fins, big attitude." }],
  ["fish_doctor_fish", "Doctor Fish", "river", "uncommon", [15, 25], null, { months: [5, 6, 7, 8, 9], oneLiner: "Will nibble your toes if you let it." }],
  ["fish_tilapia", "Tilapia", "river", "uncommon", [25, 40], null, { months: [6, 7, 8, 9, 10], oneLiner: "Plain, sturdy and always hungry." }],
  ["fish_soft_shelled_turtle", "Soft-shelled Turtle", "river", "uncommon", [20, 35], null, { months: [8, 9], oneLiner: "A pancake with a snorkel." }],
  ["fish_mitten_crab", "Mitten Crab", "river", "uncommon", [10, 18], null, { months: [9, 10, 11], oneLiner: "Wears fuzzy gloves all year." }],
  ["fish_piranha", "Piranha", "river", "rare", [25, 40], DAY, { months: SUMMER, oneLiner: "Mind the teeth when you unhook it." }],
  ["fish_bichir", "Bichir", "river", "rare", [40, 70], NIGHT, { months: SUMMER, oneLiner: "Armoured, ancient and in no hurry." }],
  ["fish_arowana", "Arowana", "river", "epic", [60, 90], NIGHT, { months: SUMMER, oneLiner: "Leaps out of the water for bugs." }],
  ["fish_dorado", "Dorado", "river", "epic", [70, 100], DAY, { months: SUMMER, oneLiner: "A gold streak that pulls like the current." }],
  ["fish_arapaima", "Arapaima", "river", "epic", [150, 300], EVE_NIGHT, { rainAnyHour: true, months: SUMMER, oneLiner: "Longer than the canoe. Bring a friend." }],
  ["fish_golden_arowana", "Golden Arowana", "river", "legendary", [70, 100], NIGHT, { months: SUMMER, oneLiner: "Gold scales, and it knows it." }],
  // pond
  ["fish_crayfish", "Crayfish", "pond", "common", [5, 12], null, { months: WARM, oneLiner: "Backs away from you, claws up." }],
  ["fish_pop_eyed_goldfish", "Pop-eyed Goldfish", "pond", "uncommon", [8, 12], null, { oneLiner: "Sees everything and is startled by all of it." }],
  ["fish_ranchu_goldfish", "Ranchu Goldfish", "pond", "uncommon", [10, 15], null, { oneLiner: "Round, slow and proud of its head." }],
  // sea
  ["fish_sea_butterfly", "Sea Butterfly", "sea", "common", [2, 4], null, { months: [12, 1, 2, 3], oneLiner: "A snail that learned to fly underwater." }],
  ["fish_clown_fish", "Clown Fish", "sea", "common", [8, 12], null, { months: WARM, oneLiner: "Lives in an anemone and pays no rent." }],
  ["fish_surgeonfish", "Surgeonfish", "sea", "common", [15, 25], null, { months: WARM, oneLiner: "Blue, busy and a little sharp at the tail." }],
  ["fish_dab", "Dab", "sea", "common", [25, 45], null, { months: [10, 11, 12, 1, 2, 3, 4], oneLiner: "Flat, sandy and easy to miss." }],
  ["fish_seahorse", "Seahorse", "sea", "uncommon", [3, 6], null, { months: APR_NOV, oneLiner: "Dad carries the eggs." }],
  ["fish_butterfly_fish", "Butterfly Fish", "sea", "uncommon", [10, 15], null, { months: WARM, oneLiner: "Dressed in stripes for a party." }],
  ["fish_porcupine_fish", "Porcupine Fish", "sea", "uncommon", [20, 35], null, { months: [7, 8, 9], oneLiner: "Spikes out at the first sign of trouble." }],
  ["fish_zebra_turkeyfish", "Zebra Turkeyfish", "sea", "uncommon", [25, 40], null, { months: APR_NOV, oneLiner: "Beautiful fins. Don't touch them." }],
  ["fish_suckerfish", "Suckerfish", "sea", "uncommon", [30, 60], null, { months: SUMMER, oneLiner: "Rides along with sharks for free." }],
  ["fish_ribbon_eel", "Ribbon Eel", "sea", "uncommon", [60, 100], null, { months: [6, 7, 8, 9, 10], oneLiner: "A streamer with a face." }],
  ["fish_moray_eel", "Moray Eel", "sea", "uncommon", [60, 100], null, { months: [8, 9, 10], oneLiner: "Grins at you from a crack in the rock." }],
  ["fish_barreleye", "Barreleye", "sea", "epic", [10, 15], NIGHT, { oneLiner: "You can see right through its head." }],
  ["fish_napoleonfish", "Napoleonfish", "sea", "epic", [100, 180], DAY, { months: [7, 8], oneLiner: "Wears a bump on its head like a hat." }],
  ["fish_saw_shark", "Saw Shark", "sea", "epic", [120, 200], NIGHT, { months: SUMMER, oneLiner: "Brings its own toolbox." }],
  ["fish_ocean_sunfish", "Ocean Sunfish", "sea", "epic", [150, 300], null, { months: [7, 8, 9], oneLiner: "Basks at the surface like a dropped dinner plate." }],
  ["fish_blue_marlin", "Blue Marlin", "sea", "epic", [200, 350], null, { months: [7, 8, 9, 11, 12, 1, 2, 3, 4], oneLiner: "The sword is not for show." }],
  ["fish_oarfish", "Oarfish", "sea", "epic", [300, 500], null, { months: [12, 1, 2, 3, 4, 5], oneLiner: "Long enough to need its own postcode." }],
  ["fish_great_white_shark", "Great White Shark", "sea", "epic", [300, 500], null, { months: SUMMER, oneLiner: "You're going to need a bigger pier." }],
  ["fish_whale_shark", "Whale Shark", "sea", "epic", [400, 800], null, { months: SUMMER, oneLiner: "Gentle, spotted and longer than the pier." }],
  ["fish_hammerhead_shark", "Hammerhead Shark", "sea", "legendary", [180, 350], null, { months: SUMMER, oneLiner: "Sees both sides of every argument." }],
], { model: null });

export const ROSTER: Species[] = [...LAUNCH_ROSTER, ...EVENT_SPECIES, ...REEL_FISH];

export const CATEGORIES: Category[] = ["fish", "sea", "bug", "fruit", "nature", "mineral"];
export const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
export const WING_OF: Record<Category, Wing | null> = { fish: "aquarium", sea: "aquarium", bug: "insect_hall", fruit: null, nature: "nature_room", mineral: null };
