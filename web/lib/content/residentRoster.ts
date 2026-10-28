/**
 * The proposed resident roster (specs/polish/living-village.md deliverable 7;
 * rows 85, 92, 122, 217): six service residents (the café owner, Rosa, is
 * the seventh, in the café: lib/game/cafe.ts) and four flavour villagers, the
 * seeded mayor among them, as data: each is an npc_personas row (name, post, bio, tone, dialogue, and
 * a schedule of routines and a home) plus a look on the character rig.
 *
 * David approved seeding them (2026-10-17, "Seed the full roster"): the rows are
 * 20261017020000_resident_roster.sql, generated from PROPOSED_RESIDENTS
 * (lib/content/residentSeed.ts; later changes through gen-seeds). The dev
 * fallback (lib/content/loader.ts) still carries them. Looks are keyed by slug and
 * worn wherever that resident appears; a resident an admin adds without one
 * gets a look seeded from its slug.
 *
 * Schedules: per phase, one anchor or a routine of stops (map anchors, `bench`,
 * `home`); `home` names the building they live in (lib/game/residentRoutine.ts).
 * Nights (principle 2, the village never empties): three stay out where it's lit
 * (Alice on the HQ porch and the lamp bench, Bram at the wharf lanterns, Nell on
 * the lamp bench and the beach); the rest linger a stop or two and go in at
 * different times, so the village thins out rather than emptying at once.
 *
 * Lines may open with a time tag (`@morning`, lib/content/talk.ts): a greeting
 * is said only at its time of day.
 */
import type { NPCPersona } from "./types";
import { GAME_WORLD, type GameWorld } from "@/lib/game/world/active";

type Look = Record<string, unknown>;
const look = (l: { skin: number; hair: number; eyes?: string; mouth?: string; extras?: string[]; bangs?: string; back: string; top?: string | null; bottom?: string | null; onepiece?: string | null; shoes: string; acc?: Record<string, string>; colors?: Record<string, number> }): Look =>
  ({ eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", top: null, bottom: null, onepiece: null, acc: {}, colors: {}, ...l });

/** Authored looks by slug (character catalogue part ids, palette indices). */
export const RESIDENT_LOOKS: Record<string, Look> = {
  // The HQ lead, as the first-login greeting proposes her (lib/game/welcome.ts HQ_LEAD on main): the club crew tee, a ponytail (head-roblox: one of David's whole hairstyles).
  wren: look({ skin: 3, hair: 2, eyes: "mochi", mouth: "open_smile", extras: ["freckles"], back: "hair_wispy_ponytail", top: "top_tsi_crew", bottom: "bottom_trousers", shoes: "shoes_boots",
    acc: { bag: "acc_shoulder_bag" }, colors: { bottom_trousers: 4, shoes_boots: 5, acc_shoulder_bag: 3 } }),
  // The mayor: the club's warm historian. A grey ponytail (round 3: the low pony was removed), round glasses, a lavender
  // cardigan and a long brown skirt.
  mayor: look({ skin: 2, hair: 9, eyes: "F1.2", back: "hair_wispy_ponytail", top: "top_cardigan", bottom: "bottom_long_skirt", shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round" }, colors: { top_cardigan: 13, bottom_long_skirt: 5, shoes_loafers: 5 } }),
  // Shopkeeper: deadpan, tidy. Square glasses, a sage sweater vest, charcoal trousers, work boots.
  shopkeeper: look({ skin: 8, hair: 0, mouth: "tiny_smirk", back: "hair_messy_boy", top: "top_sweater_vest", bottom: "bottom_trousers", shoes: "shoes_boots",
    acc: { face: "acc_glasses_square" }, colors: { top_sweater_vest: 3, bottom_trousers: 14, shoes_boots: 5 } }),
  // Museum curator: precise and owlish. Braided crown, round glasses, a cream collar shirt over a navy pleated skirt.
  curator: look({ skin: 0, hair: 3, eyes: "bean", back: "hair_hime_short", top: "top_collar_shirt", bottom: "bottom_pleated_skirt", shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round" }, colors: { top_collar_shirt: 0, bottom_pleated_skirt: 12, shoes_loafers: 5 } }),
  // Wharf keeper: weathered and chatty about tides. Navy cap, a blue striped top, yellow rain boots.
  "wharf-keeper": look({ skin: 6, hair: 9, extras: ["freckles"], back: "hair_swept_fringe", top: "top_stripe_ls", bottom: "bottom_trousers", shoes: "shoes_rainboots",
    acc: { head: "acc_cap" }, colors: { top_stripe_ls: 11, bottom_trousers: 12, shoes_rainboots: 6, acc_cap: 12 } }),
  // Oracle keeper: quiet, speaks in riddles. A lavender kimono, long dark hair, sandals.
  "oracle-keeper": look({ skin: 9, hair: 0, eyes: "half_lid", back: "hair_long_scruffy", onepiece: "outfit_koi_kimono", shoes: "shoes_sandals",
    acc: { neck: "acc_shell_necklace" }, colors: { outfit_koi_kimono: 13 } }),
  // Workshop crafter: a tinkerer with a cap on backwards. Wood-brown overalls over a cream tee, backpack of tools.
  crafter: look({ skin: 4, hair: 7, extras: ["blush"], back: "hair_anime_spikes", top: "top_tee", bottom: "bottom_overall_shorts", shoes: "shoes_boots",
    acc: { head: "acc_cap", bag: "acc_backpack" }, colors: { bottom_overall_shorts: 4, shoes_boots: 5, acc_cap: 7 } }),
  // The museum's guide (m1): takes your first catch and shows you round. Warm and quick; a sea-green collar shirt, a long
  // navy skirt, a shell necklace from the beach.
  docent: look({ skin: 7, hair: 4, eyes: "mochi", mouth: "open_smile", back: "hair_swept_fringe", top: "top_collar_shirt", bottom: "bottom_long_skirt", shoes: "shoes_loafers",
    acc: { neck: "acc_shell_necklace" }, colors: { top_collar_shirt: 15, bottom_long_skirt: 12, shoes_loafers: 5 } }),
  // Flavour: an early riser who runs the beach at dawn. High ponytail, teal tee, joggers.
  juniper: look({ skin: 3, hair: 8, back: "hair_long_pigtails", top: "top_tee", bottom: "bottom_joggers", shoes: "shoes_sneakers",
    colors: { top_tee: 15, bottom_joggers: 14, shoes_sneakers: 1 } }),
  // Flavour: sketches the island from the benches. Straw hat, pink hoodie, a shoulder bag of pencils.
  marlo: look({ skin: 5, hair: 1, eyes: "chill", back: "hair_bowl_cut", top: "top_hoodie", bottom: "bottom_shorts", shoes: "shoes_slipon",
    acc: { head: "acc_straw_hat", bag: "acc_shoulder_bag" }, colors: { top_hoodie: 9, bottom_shorts: 2 } }),
  // Flavour: the night owl who watches the stars from the lamp bench. Navy cardigan, a long lavender skirt.
  nell: look({ skin: 1, hair: 4, extras: ["freckles"], back: "hair_windy_bob", top: "top_cardigan", bottom: "bottom_long_skirt", shoes: "shoes_boots",
    colors: { top_cardigan: 12, bottom_long_skirt: 13 } }),
};

/**
 * What each one says when you walk up and talk to them (specs/polish/reachability.md deliverable 1, row 123): two or
 * three conversations each, a box per line, "[happy]" and the like for the face they make (lib/content/talk.ts). In
 * their own tone (row 218); proposals for David's review (row 217, specs/polish/reachability-questions.md). The two
 * seeded residents' are also seeded into npc_personas.talk (20261003161600_resident_talk), where admins edit them.
 */
export const RESIDENT_TALK: Record<string, string[][]> = {
  wren: [
    ["[happy] {name}! Good timing.", "I just pinned something new on the notice board. Or I meant to. It's in one of these pockets.", "Club goals are coming along, by the way. Everything you chip in shows on the monument."],
    ["If you ever lose track of what's next, your Journal has it.", "[surprised] Oh! And check the mailbox. Letters from HQ go there. I write most of them. Sorry about the handwriting."],
    ["[sleepy] I was up early sorting the volunteer sign-ups.", "[happy] Worth it, though. Somebody's always building something here."],
  ],
  mayor: [
    ["[happy] Ah, {name}. Stay a while, if you like.", "This island started as one bench and an argument about where HQ should go.", "We were all wrong, of course. It went exactly where it needed to be."],
    ["Every club goal you finish, the island remembers.", "[happy] The club monument grows a little each time. I check on it every morning."],
    ["The light here changes with the seasons. Have you noticed?", "[surprised] Autumn's my favourite. The whole path goes gold."],
  ],
  shopkeeper: [
    ["Welcome. Browse if you must.", "I keep the shelves in order of usefulness. Nobody has ever noticed.", "[sad] I've started to take it personally."],
    ["Selling your catches? The rarer ones fetch more.", "That isn't me being generous. It's the rules.", "[happy] I'm a little generous."],
    ["[sleepy] Inventory day. I counted the hoodies twice.", "There are the same number of hoodies. There are always the same number of hoodies."],
  ],
  curator: [
    ["[happy] {name}! Found anything with wings lately?", "The museum's cases are waiting. The first of every find you bring me goes on show.", "With a label. I write very good labels."],
    ["Did you see the dragonflies by the pond? Odonata. Lovely things.", "[surprised] They can fly backwards, you know. I think about that a lot."],
    ["If you catch something you've never seen before, bring it to me before you sell it.", "Once it's in a case, it belongs to the whole club."],
  ],
  "wharf-keeper": [
    ["Tide's turning. You can hear it if you listen.", "[happy] And the gulls are flying low. Rain by supper, mark my words."],
    ["Boat's ready whenever you want to go home.", "Your island's out past the pier. Small, but the sunsets are all yours."],
    ["[surprised] Caught anything big yet?", "Best fishing's off the end of the wharf at dawn. Don't tell anyone I told you."],
  ],
  "oracle-keeper": [
    ["The crystal is quiet today. It's listening.", "What would you ask it, if you knew it would answer?"],
    ["Which way will you grow, {name}? The temple can help you see it.", "[happy] Not decide. Only see. The deciding is yours."],
    ["Stars are just old light. So are good friends.", "[sleepy] I was up late on the temple steps again. Clear skies."],
  ],
  crafter: [
    ["[happy] Found a perfectly good plank on the beach. Perfectly good!", "Bring me some wood and I'll show you a trick at the workbench."],
    ["Measure twice, glue once. That's the whole secret.", "[surprised] Well. Most of it. The rest is snacks."],
    ["Bottles wash up on the beach sometimes.", "Some have notes in them. Some have recipes. Keep your eyes open."],
  ],
  docent: [
    ["[happy] Welcome to the museum! Fish in the aquarium, bugs in the insect hall, buried finds in the nature room.", "The first of each kind anyone brings goes on show. Odile writes the labels."],
    ["The club's filling the halls together. When they're full, the doors open properly.", "[happy] I'll be here. I'm always here. I like it here."],
  ],
  juniper: [
    ["@morning [happy] Morning laps! Want to race to the pier?", "Kidding. Mostly. Stretch first, trust me."],
    ["The sand's firmest right by the water.", "[happy] Best place on the island for a sprint. Try it!"],
    ["[sleepy] I've been up since dawn. Is it lunch yet?", "No? Then one more lap."],
  ],
  marlo: [
    ["[happy] Hold still, you're in the shot.", "Kidding. Mostly. You do make a good shape for a sketch."],
    ["I've drawn HQ forty times now.", "[sad] I'm not happy with any of them. That roof has a mind of its own."],
    ["The pond looks different every hour.", "I'm out of the green pencil again. If you find one, it's mine."],
  ],
  nell: [
    ["I named a star after the founders. The bright one over HQ, once it's dark.", "[happy] The fainter ones are for everyone who joined after. There's room for plenty more."],
    ["[sleepy] Mornings are a rumour. I'm told they're nice.", "The island's best after dark anyway. The fireflies come out by the water."],
    ["If you can't sleep, come and find me at the lamp bench.", "I'll show you the constellation that looks like a fishing rod."],
  ],
};

const NOW = "2026-10-01T00:00:00.000Z";
const row = (r: Pick<NPCPersona, "slug" | "display_name" | "post" | "bio" | "tone" | "schedule" | "canned_dialogue">): NPCPersona => ({
  id: `proposed-${r.slug}`, sprite_url: null, spawn_zone: "courtyard", is_permanent: true, persona_prompt: null, active: true, created_at: NOW, updated_at: NOW,
  talk: RESIDENT_TALK[r.slug], ...r,
});

/**
 * The proposal, as rows. The two seeded residents keep their names and lines and gain a post, a routine and a home;
 * the rest are new. Schedules use the map's anchors (plaza, path, hq, shop, cafe, oracle, museum, pond, beach, wharf).
 */
export const PROPOSED_RESIDENTS: NPCPersona[] = [
  row({ slug: "wren", display_name: "Alice", post: "hq_lead", tone: "warm",
    bio: "Keeps HQ running, more or less: club goals, the notice board, everyone's first day. Meets every new member on the wharf.",
    schedule: { home: "hq", dawn: ["hq"], day: ["hq", "plaza", "path", "hq", "pond"], evening: ["plaza", "bench"], night: ["hq", "bench", "hq"] },
    canned_dialogue: [
      "@morning Morning! The notice board has something new, I think. Probably.",
      "Club goals are coming along. Every bit helps.",
      "If you need anything, I'm usually at HQ. Or near it. Or looking for it.",
    ] }),
  row({ slug: "mayor", display_name: "Mayor Eliza", post: "villager", tone: "warm",
    bio: "The island's first resident and its historian. Remembers everyone's first week and will tell the club's story to anyone who sits still.",
    schedule: { home: "hq", dawn: ["home"], day: ["path", "plaza", "bench", "pond"], evening: ["plaza", "pond"], night: ["plaza", "home"] },
    canned_dialogue: [
      "Welcome back. The light here changes with the season, have you noticed?",
      "Every board on that clubhouse was put up by someone who believed in this place.",
      "If you ever want to hear how this all started, you know where to find me.",
    ] }),
  row({ slug: "shopkeeper", display_name: "Toren", post: "shopkeeper", tone: "dry",
    bio: "Keeps the shop, counts everything twice and finds most prices too high. Secretly restocks the things people like.",
    schedule: { home: "shop", dawn: ["shop"], day: ["shop", "plaza", "shop", "pond"], evening: ["shop", "pond"], night: ["home"] },
    canned_dialogue: ["Welcome. Browse if you must.", "Everything here is, technically, for sale.", "The hoodie is a hoodie. It will keep you warm. That is the entire pitch."] }),
  row({ slug: "curator", display_name: "Odile", post: "museum_curator", tone: "earnest",
    bio: "The museum's curator, labelling the empty cases until the club fills them. Knows the Latin name of every bug and says it anyway.",
    schedule: { home: "museum", dawn: ["pond"], day: ["museum", "pond", "beach"], evening: ["museum", "plaza"], night: ["museum", "home"] },
    canned_dialogue: ["Every case in there is waiting for something you'll find.", "Did you see the dragonflies by the pond? Odonata. Lovely.", "Bring me anything with wings. Or fins. Or a shell."] }),
  row({ slug: "docent", display_name: "Juno", post: "museum_guide", tone: "warm",
    bio: "The museum's guide. Keeps the door, shows everyone round, and takes each new member's first catch for the halls.",
    schedule: { home: "museum", dawn: ["museum"], day: ["museum"], evening: ["museum"], night: ["museum", "home"] },
    canned_dialogue: ["Welcome to the museum!", "The first of each kind goes on show.", "Bring me your first catch!"] }),
  row({ slug: "wharf-keeper", display_name: "Bram", post: "wharf_keeper", tone: "playful",
    bio: "Minds the wharf and the boats, reads the tides off the posts and the weather off the gulls. Has a story for every knot.",
    schedule: { home: "hq", dawn: ["wharf"], day: ["wharf", "beach", "wharf", "plaza"], evening: ["wharf", "bench"], night: ["wharf", "beach", "wharf"] },
    canned_dialogue: ["Tide's turning. You can hear it if you listen.", "The gulls are low today. Rain by supper, mark my words.", "Boat's ready whenever you want to go home."] }),
  row({ slug: "oracle-keeper", display_name: "Sable", post: "oracle_keeper", tone: "earnest",
    bio: "Keeps the Oracle temple and its crystal. Answers questions with better questions, and stays up to watch the stars from the temple steps.",
    schedule: { home: "oracle", dawn: ["oracle"], day: ["oracle", "pond", "oracle"], evening: ["oracle", "pond"], night: ["oracle", "home"] },
    canned_dialogue: ["The crystal is quiet today. It's listening.", "Which way will you grow? Ask the temple.", "Stars are just old light. So are good friends."] }),
  row({ slug: "crafter", display_name: "Pim", post: "workshop_crafter", tone: "playful",
    bio: "Tinkers at the HQ workbench and combs the beach for driftwood and bottles. Never without a pencil behind one ear.",
    schedule: { home: "hq", dawn: ["home"], day: ["hq", "beach", "path", "plaza"], evening: ["plaza", "hq"], night: ["hq", "plaza", "home"] },
    canned_dialogue: ["Found a perfectly good plank on the beach. Perfectly good!", "Bring me wood and I'll show you a trick.", "Measure twice, glue once."] }),
  row({ slug: "juniper", display_name: "Juniper", post: "villager", tone: "playful",
    bio: "Up before the sun to run the beach and stretch on the sand. Knows every shortcut on the island.",
    schedule: { home: "hq", dawn: ["beach", "path"], day: ["pond", "plaza", "beach"], evening: ["plaza", "beach"], night: ["beach", "home"] },
    canned_dialogue: ["@morning Morning laps! Want to race to the pier?", "Stretch first. Trust me.", "The sand's firmest right by the water."] }),
  row({ slug: "marlo", display_name: "Marlo", post: "villager", tone: "warm",
    bio: "Sketches the island from the benches, a page a day. Has drawn HQ forty times and isn't happy with any of them.",
    schedule: { home: "hq", day: ["bench", "pond", "museum"], evening: ["beach", "bench"], night: ["pond", "plaza", "home"] },
    canned_dialogue: ["Hold still, you're in the shot. Kidding. Mostly.", "The pond looks different every hour.", "I'm out of the green pencil again."] }),
  row({ slug: "nell", display_name: "Nell", post: "villager", tone: "warm",
    bio: "A night owl who sleeps in, then watches the stars from the bench under the lamp. Names the constellations after club members.",
    schedule: { home: "hq", dawn: ["home"], day: ["home", "plaza", "oracle"], evening: ["beach", "bench"], night: ["bench", "beach", "bench"] },
    canned_dialogue: ["See that one? I named it after the founders.", "The fireflies came out early tonight.", "Mornings are a rumour."] }),
];

/** Where the fallback gets its residents: in dev, the proposal over the seeded rows (by slug); in production, the seeded rows. */
export function withProposed(seeded: readonly NPCPersona[]): NPCPersona[] {
  const proposed = new Map(PROPOSED_RESIDENTS.map(r => [r.slug, r]));
  return [...seeded.map(r => proposed.get(r.slug) ? { ...r, ...proposed.get(r.slug)!, id: r.id } : r), ...PROPOSED_RESIDENTS.filter(r => !seeded.some(s => s.slug === r.slug))];
}

/** Residents only the new world has (the village plays as it always did): Juno, its museum guide (m1). */
export const NEW_WORLD_ONLY: ReadonlySet<string> = new Set(["docent"]);

/**
 * x-lines (specs/launch/v1-gameplay.md): on the new world, lines that send you to something closed (the boat home, the
 * temple) say something about what's open instead. Swapped in code, line by line, so the village's (and anything an
 * admin rewrote) stay as they are.
 */
export const NEW_WORLD_LINE_SWAPS: Readonly<Record<string, string>> = {
  "Boat's ready whenever you want to go home.": "The barrel on the dock buys whatever you catch. Fair prices. I check the scales myself.",
  "Your island's out past the pier. Small, but the sunsets are all yours.": "[happy] Want a better rod one day? I might have a challenge for you.",
  "Which way will you grow, {name}? The temple can help you see it.": "Which way will you grow, {name}? Nobody can tell you yet. Not even me.",
  "[happy] Not decide. Only see. The deciding is yours.": "[happy] Keep doing what you love here. It shows, in time.",
  "Which way will you grow? Ask the temple.": "Which way will you grow? Time will show it.",
};
/** A resident as the new world has them: their lines with NEW_WORLD_LINE_SWAPS applied. */
export function newWorldPersona<P extends Pick<NPCPersona, "talk" | "canned_dialogue">>(p: P): P {
  const swap = (line: string) => NEW_WORLD_LINE_SWAPS[line] ?? line;
  return { ...p, canned_dialogue: p.canned_dialogue?.map(swap) ?? p.canned_dialogue, talk: p.talk?.map(c => c.map(swap)) ?? p.talk };
}
/** The residents this world has (lib/content/loader.ts useNPCPersonas): the new world's with Juno and its swapped lines; the village's as they always were. */
export const residentsHere = <P extends Pick<NPCPersona, "slug" | "talk" | "canned_dialogue">>(personas: readonly P[], world: GameWorld = GAME_WORLD): P[] =>
  world === "new" ? personas.map(newWorldPersona) : personas.filter(p => !NEW_WORLD_ONLY.has(p.slug));
