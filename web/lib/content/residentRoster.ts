/**
 * The proposed resident roster (specs/polish/living-village.md deliverable 7;
 * rows 85, 92, 122, 217): six service residents (the café owner, Rosa, is
 * the seventh, in the café: lib/game/cafe.ts) and four flavour villagers, the
 * seeded mayor among them, as data: each is an npc_personas row (name, post, bio, tone, dialogue, and
 * a schedule of routines and a home) plus a look on the character rig.
 *
 * Names and traits are placeholders until David's list arrives (row 217); the
 * seed migration that puts them in npc_personas waits for his approval. Until
 * then they live in the dev fallback only (lib/content/loader.ts), so the
 * live island keeps its two seeded residents. Looks are keyed by slug and
 * worn wherever that resident appears; a resident an admin adds without one
 * gets a look seeded from its slug.
 *
 * Schedules: per phase, one anchor or a routine of stops (map anchors, `bench`,
 * `home`); `home` names the building they live in (lib/game/residentRoutine.ts).
 */
import type { NPCPersona } from "./types";

type Look = Record<string, unknown>;
const look = (l: { skin: number; hair: number; eyes?: string; mouth?: string; brows?: string; extras?: string[]; bangs: string; back: string; top?: string | null; bottom?: string | null; onepiece?: string | null; shoes: string; acc?: Record<string, string>; colors?: Record<string, number> }): Look =>
  ({ eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], top: null, bottom: null, onepiece: null, acc: {}, colors: {}, ...l });

/** Authored looks by slug (character catalogue part ids, palette indices). */
export const RESIDENT_LOOKS: Record<string, Look> = {
  // The HQ lead, as the first-login greeting proposes her (lib/game/welcome.ts HQ_LEAD on main): the club crew tee, a high ponytail.
  wren: look({ skin: 3, hair: 2, eyes: "E1.4", mouth: "M2.1", extras: ["freckles"], bangs: "bangs_curtain", back: "back_high_pony", top: "top_tsi_crew", bottom: "bottom_trousers", shoes: "shoes_boots",
    acc: { bag: "acc_shoulder_bag" }, colors: { bottom_trousers: 4, shoes_boots: 5, acc_shoulder_bag: 3 } }),
  // The mayor: the club's warm historian. Grey bun, round glasses, a lavender cardigan and a long brown skirt.
  mayor: look({ skin: 2, hair: 9, eyes: "F1.2", bangs: "bangs_swept_back", back: "back_bun", top: "top_cardigan", bottom: "bottom_long_skirt", shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round", neck: "acc_scarf" }, colors: { top_cardigan: 13, bottom_long_skirt: 5, shoes_loafers: 5, acc_scarf: 4 } }),
  // Shopkeeper: deadpan, tidy. Square glasses, a sage sweater vest, charcoal trousers, work boots.
  shopkeeper: look({ skin: 8, hair: 0, brows: "brow_flat", mouth: "M2.1", bangs: "bangs_choppy", back: "back_short_spiky", top: "top_sweater_vest", bottom: "bottom_trousers", shoes: "shoes_boots",
    acc: { face: "acc_glasses_square" }, colors: { top_sweater_vest: 3, bottom_trousers: 14, shoes_boots: 5 } }),
  // Museum curator: precise and owlish. Braided crown, round glasses, a cream collar shirt over a navy pleated skirt.
  curator: look({ skin: 0, hair: 3, eyes: "E1.2", bangs: "bangs_hime", back: "back_braid_crown", top: "top_collar_shirt", bottom: "bottom_pleated_skirt", shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round" }, colors: { top_collar_shirt: 0, bottom_pleated_skirt: 12, shoes_loafers: 5 } }),
  // Wharf keeper: weathered and chatty about tides. Navy beanie, a blue striped top, yellow rain boots.
  "wharf-keeper": look({ skin: 6, hair: 9, brows: "brow_flat", extras: ["freckles"], bangs: "bangs_swept_r", back: "back_short_spiky", top: "top_stripe_ls", bottom: "bottom_trousers", shoes: "shoes_rainboots",
    acc: { head: "acc_beanie" }, colors: { top_stripe_ls: 11, bottom_trousers: 12, shoes_rainboots: 6, acc_beanie: 12 } }),
  // Oracle keeper: quiet, speaks in riddles. A lavender robe, long dark hair, sandals.
  "oracle-keeper": look({ skin: 10, hair: 0, eyes: "E5.4", bangs: "bangs_curtain_long", back: "back_long", onepiece: "onepiece_robe", shoes: "shoes_sandals",
    acc: { neck: "acc_shell_necklace" }, colors: { onepiece_robe: 13 } }),
  // Workshop crafter: a tinkerer with a cap on backwards. Wood-brown jumpsuit, backpack of tools.
  crafter: look({ skin: 4, hair: 7, extras: ["blush"], bangs: "bangs_spiky", back: "back_short_spiky", onepiece: "onepiece_jumpsuit", shoes: "shoes_boots",
    acc: { head: "acc_cap", bag: "acc_backpack" }, colors: { onepiece_jumpsuit: 4, shoes_boots: 5, acc_cap: 7 } }),
  // Flavour: an early riser who runs the beach at dawn. High ponytail, teal tee, joggers.
  juniper: look({ skin: 3, hair: 8, bangs: "bangs_wispy", back: "back_high_pony", top: "top_tee", bottom: "bottom_joggers", shoes: "shoes_sneakers",
    colors: { top_tee: 15, bottom_joggers: 14, shoes_sneakers: 1 } }),
  // Flavour: sketches the island from the benches. Straw hat, pink hoodie, a shoulder bag of pencils.
  marlo: look({ skin: 5, hair: 1, eyes: "F2.1", bangs: "bangs_bowl", back: "back_bowl", top: "top_hoodie", bottom: "bottom_shorts", shoes: "shoes_slipon",
    acc: { head: "acc_straw_hat", bag: "acc_shoulder_bag" }, colors: { top_hoodie: 9, bottom_shorts: 2 } }),
  // Flavour: the night owl who watches the stars from the lamp bench. Navy cardigan, a yellow scarf.
  nell: look({ skin: 1, hair: 4, extras: ["freckles"], bangs: "bangs_centre_split", back: "back_wavy_long", top: "top_cardigan", bottom: "bottom_long_skirt", shoes: "shoes_boots",
    acc: { neck: "acc_scarf" }, colors: { top_cardigan: 12, bottom_long_skirt: 13, acc_scarf: 6 } }),
};

const NOW = "2026-10-01T00:00:00.000Z";
const row = (r: Pick<NPCPersona, "slug" | "display_name" | "post" | "bio" | "tone" | "schedule" | "canned_dialogue">): NPCPersona => ({
  id: `proposed-${r.slug}`, sprite_url: null, spawn_zone: "courtyard", is_permanent: true, persona_prompt: null, active: true, created_at: NOW, updated_at: NOW, ...r,
});

/**
 * The proposal, as rows. The two seeded residents keep their names and lines and gain a post, a routine and a home;
 * the rest are new. Schedules use the map's anchors (plaza, path, hq, shop, cafe, oracle, museum, pond, beach, wharf).
 */
export const PROPOSED_RESIDENTS: NPCPersona[] = [
  row({ slug: "wren", display_name: "Wren", post: "hq_lead", tone: "warm",
    bio: "Keeps the clubhouse running, more or less: club goals, the notice board, everyone's first day. Meets every new member on the wharf.",
    schedule: { home: "hq", dawn: ["hq"], day: ["hq", "plaza", "path", "hq", "pond"], evening: ["plaza", "bench"], night: ["bench", "home"] },
    canned_dialogue: [
      "Morning! The notice board has something new, I think. Probably.",
      "Club goals are coming along. Every bit helps.",
      "If you need anything, I'm usually at the clubhouse. Or near it. Or looking for it.",
    ] }),
  row({ slug: "mayor", display_name: "Mayor Eliza", post: "villager", tone: "warm",
    bio: "The island's first resident and its historian. Remembers everyone's first week and will tell the club's story to anyone who sits still.",
    schedule: { home: "hq", dawn: ["home"], day: ["path", "plaza", "bench", "pond"], evening: ["plaza", "pond"], night: ["home"] },
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
    schedule: { home: "museum", dawn: ["pond"], day: ["museum", "pond", "beach"], evening: ["museum", "plaza"], night: ["home"] },
    canned_dialogue: ["Every case in there is waiting for something you'll find.", "Did you see the dragonflies by the pond? Odonata. Lovely.", "Bring me anything with wings. Or fins. Or a shell."] }),
  row({ slug: "wharf-keeper", display_name: "Bram", post: "wharf_keeper", tone: "playful",
    bio: "Minds the wharf and the boats, reads the tides off the posts and the weather off the gulls. Has a story for every knot.",
    schedule: { home: "hq", dawn: ["wharf"], day: ["wharf", "beach", "wharf", "plaza"], evening: ["wharf", "bench"], night: ["bench", "home"] },
    canned_dialogue: ["Tide's turning. You can hear it if you listen.", "The gulls are low today. Rain by supper, mark my words.", "Boat's ready whenever you want to go home."] }),
  row({ slug: "oracle-keeper", display_name: "Sable", post: "oracle_keeper", tone: "earnest",
    bio: "Keeps the Oracle temple and its crystal. Answers questions with better questions, and stays up to watch the stars from the temple steps.",
    schedule: { home: "oracle", dawn: ["oracle"], day: ["oracle", "pond", "oracle"], evening: ["oracle", "pond"], night: ["oracle", "home"] },
    canned_dialogue: ["The crystal is quiet today. It's listening.", "Which way will you grow? Ask the temple.", "Stars are just old light. So are good friends."] }),
  row({ slug: "crafter", display_name: "Pim", post: "workshop_crafter", tone: "playful",
    bio: "Tinkers at the clubhouse workbench and combs the beach for driftwood and bottles. Never without a pencil behind one ear.",
    schedule: { home: "hq", dawn: ["home"], day: ["hq", "beach", "path", "plaza"], evening: ["plaza", "hq"], night: ["home"] },
    canned_dialogue: ["Found a perfectly good plank on the beach. Perfectly good!", "Bring me wood and I'll show you a trick.", "Measure twice, glue once."] }),
  row({ slug: "juniper", display_name: "Juniper", post: "villager", tone: "playful",
    bio: "Up before the sun to run the beach and stretch on the sand. Knows every shortcut on the island.",
    schedule: { home: "hq", dawn: ["beach", "path"], day: ["pond", "plaza", "beach"], evening: ["plaza", "bench"], night: ["home"] },
    canned_dialogue: ["Morning laps! Want to race to the pier?", "Stretch first. Trust me.", "The sand's firmest right by the water."] }),
  row({ slug: "marlo", display_name: "Marlo", post: "villager", tone: "warm",
    bio: "Sketches the island from the benches, a page a day. Has drawn the clubhouse forty times and isn't happy with any of them.",
    schedule: { home: "hq", day: ["bench", "pond", "museum"], evening: ["beach", "bench"], night: ["home"] },
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
