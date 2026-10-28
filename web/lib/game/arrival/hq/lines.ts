/**
 * What Alice says through the HQ visit, the visit's tracker steps and cards, and what each resident says when they hand
 * you a tool (row 312, specs/hq-onboarding.md). DRAFTS for David's review, all of them.
 *
 * Lore rules (specs/lore.md): never resolve the war, never name the player's substrate, no school or campus words.
 * The Founder's own words are David's alone: nothing here speaks for the Founder, and the plaque stays blank until he
 * writes FOUNDER_PLAQUE.
 *
 * `{name}` is your world name; `{esc}` the menu key (a touch screen gets its own wording). A line may open with a face
 * ("[happy]", lib/content/talk.ts), as the residents' do. Lines show a box at a time in the dialogue box.
 */

/** Alice, the HQ lead (lib/game/welcome.ts HQ_LEAD, residentRoster `wren`). */
import { GAME_WORLD } from "@/lib/game/world/active";

const NEW_WORLD = GAME_WORLD === "new";

export const WREN = { slug: "wren", name: "Alice", post: "hq_lead" } as const;

/** Her lines by key (script.ts says which beat says which). */
export const WREN_LINES: Readonly<Record<string, readonly string[]>> = {
  // Registering.
  welcome: [
    "[happy] There you are! Bram said you'd be up. I'm Alice. I keep HQ running, more or less.",
    "First things first: the island register. Everyone who stays signs it.",
    "Just your world name. That's the one everybody here knows you by.",
  ],
  registered: [
    "[happy] That's you on the register, {name}.",
    "Your friend code's on your card now. Give it to anyone you want to find again.",
    "And your mailbox is set up out by the plaza. Letters from HQ land there. Mostly from me, sorry in advance.",
  ],
  // The real club and its check-ins.
  club: [
    "Here's the part people miss. You're not only on the island's register. You're in the real club.",
    "Every real TSI event has a check-in code at the door. Scan it and you're checked in.",
    "That's what levels you up. Not fishing, not chores. Showing up.",
  ],
  // Lore: real life counts, then the Founder's desk.
  realLife: [
    "The island measures you by what you do out there, not in here.",
    "Come and see something. The desk by the notice board.",
  ],
  founder: [
    "That's the Founder's desk. Nobody sits there.",
    "The Founder left it for whoever came next.",
  ],
  // The Esc menu and the map. `{esc}`: the key, or the menu button on a touch screen.
  menu: [
    "Right. Practical things. {esc}",
    "That's your menu: the map, your quests and journal, your bag, friends and mail. Open the map for me.",
  ],
  map: [
    "[happy] That's the whole island. The village is open. The rest opens as the island gets to know you.",
  ],
  // The notice board and the club goals.
  board: [
    "Last thing. The notice board on the back wall. Have a read.",
  ],
  goals: [
    "Those are the club goals. The café and the museum are the club's to fund.",
    "Deliveries at the monument count, and so does showing up to real events. Everyone's bit goes in the same pot.",
  ],
  farewell: [
    NEW_WORLD ? "That's you registered. Bring your first catch to Juno at the museum. She'll show you round." : "That's you registered. Bring your first find to the museum shell, then come back and tell me.",
    "Oh, and you'll want more than a rod. Odile has a spare net and Pim always has a shovel. Ask them.",
    "[happy] Welcome to Tethos Island, {name}.",
  ],
};

/** `{esc}` in her lines, said with your key. */
export const escPhrase = (touch: boolean) => (touch ? "Tap the menu button." : "Press Esc.");

/** The visit as the quest tracker shows it: its title and a step per beat (script.ts ids). `{esc}`: the key. */
export const HQ_TITLE = "Register at HQ";
export const HQ_TRACKER: Readonly<Record<string, string>> = {
  report: "Report to Alice at HQ",
  register: "Sign the island register",
  checkin: "Find out about check-ins",
  founder: "Look at the Founder's desk",
  esc: "Open the menu ({esc})",
  map: "Open the map",
  board: "Read the notice board",
};
export const trackerEsc = (label: string, touch: boolean) => (touch ? label.replace(" ({esc})", "") : label.replaceAll("{esc}", "Esc"));

/** The register's card (the front desk): your world name to sign with, then what signing issued. */
export const REGISTER_CARD = {
  eyebrow: "HQ front desk",
  title: "The island register",
  signAs: "Sign as",
  /** Signed out (a preview): no world name to sign with. */
  noName: "Your world name",
  note: "Your world name is the only name anyone sees here.",
  sign: "Sign the register",
  signed: "Signed",
  friendCode: "Friend code",
  /** No account to issue one for (signed out, a preview). */
  friendCodeLater: "Issued once you're signed in",
  mailbox: "Mailbox",
  mailboxAt: "By the plaza",
  /** `{n}` letters waiting. */
  letters: (n: number) => (n === 1 ? "1 letter waiting" : `${n} letters waiting`),
  done: "Done",
} as const;

/** The check-in card: where a real event's check-in code goes (the existing flow: the door's QR, lib/portal/checkIn.ts). */
export const CHECKIN_CARD = {
  eyebrow: "The real club",
  title: "Real event check-ins",
  /** `{host}` is where the QR opens (CHECK_IN_ORIGIN). */
  steps: [
    "At a TSI event, find the check-in QR code by the door.",
    "Scan it with your phone. It opens {host}/student/check-in.",
    "You're checked in. Your XP and coins land in your account.",
  ],
  note: "Only real events level you up.",
  done: "Got it",
} as const;

/**
 * The Founder's plaque. ONLY DAVID WRITES THIS. While it is null the plaque is blank (in the room and on its card) and
 * nothing anywhere speaks for the Founder.
 */
export const FOUNDER_PLAQUE: string | null = null;
/** The plaque's card while it's blank: what you see, said plainly (not the Founder's words). */
export const PLAQUE_CARD = {
  eyebrow: "HQ",
  title: "The Founder's desk",
  blank: "The plaque is blank.",
  done: "Close",
} as const;

/**
 * What each tool's resident says (lib/game/arrival/hq/teachers.ts TOOL_TEACHERS): `offer` the first time you talk to
 * them (they hand it over at the end, `given` a toast), `during` while its little quest runs, `done` as the quest
 * finishes (a toast).
 * The tracker shows `title` and the quest's one step.
 */
type ToolLines = { title: string; step: string; offer: readonly string[]; during: readonly string[]; given: string; done: string };
/** The village's, as they always were: each tool's own little quest (teachers.ts toolQuest). */
const VILLAGE_TOOL_LINES: Readonly<Record<string, ToolLines>> = {
  net: {
    title: "Odile's bug net",
    step: "Catch any bug",
    offer: [
      "[happy] {name}! You're the one Bram brought in. Found anything with wings yet?",
      "No? You'll want a net. Here, my spare. It has seen a few summers.",
      "Catch any bug you like. Then have a proper look at it before you decide what it's for.",
    ],
    during: ["Any bug at all. The flowers by the pond are busy this time of day."],
    given: "Odile handed you her spare bug net.",
    done: "The bug net is yours now. Odile says keep it.",
  },
  shovel: {
    title: "Pim's shovel",
    step: "Dig up one buried thing",
    offer: [
      "[happy] A new face! Do you dig? Everybody should dig.",
      "Half this island is under the sand, and most of it is perfectly good. Perfectly good!",
      "Here, take the shovel. Dig up one thing, anything, and it's yours to keep.",
    ],
    during: ["Look for the little cracks in the ground. There's always something under there."],
    given: "Pim handed you a shovel.",
    done: "The shovel is yours now. Pim says it's perfectly good.",
  },
};

/** The new world's: the main quest's chapters (m2, m3, m6) carry on from the hand-over, so the offers say what's next. */
const NEW_WORLD_TOOL_LINES: Readonly<Record<string, ToolLines>> = {
  net: {
    title: "Odile's bug net",
    step: "Catch 3 bugs",
    offer: [
      "[happy] {name}! Found anything with wings yet?",
      "No? You'll want a net. Here, my spare. It has seen a few summers.",
      "Catch three bugs and come and show me. Then we'll talk about what they're for.",
    ],
    during: ["Bugs sit on flowers and trees. Walk up slowly and they'll stay put."],
    given: "Odile handed you her spare bug net.",
    done: "Your first bug! Odile's net is yours to keep.",
  },
  shovel: {
    title: "Pim's shovel",
    step: "Dig up 3 buried things",
    offer: [
      "[happy] A new face! Do you dig? Everybody should dig.",
      "Half this island is under the sand, and most of it is perfectly good. Perfectly good!",
      "Look for a little star of cracks, on the sand or on dirt. Dig up three things and show me.",
    ],
    during: ["Look for the little cracks in the ground. There's always something under there."],
    given: "Pim handed you a shovel.",
    done: "Your first find! Pim's shovel is yours to keep.",
  },
  pickaxe: {
    title: "Eliza's pickaxe",
    step: "Break rocks for stone and iron",
    offer: [
      "[happy] {name}. Sit a moment. Did you know the HQ's first wall came out of these rocks?",
      "I dug its foundations with this very pickaxe. It's wasted on my wall now.",
      "Take it. Bring me three stones and a bit of iron, if the rocks give you any.",
    ],
    during: ["The big rocks give stone, and iron now and then. Swing hard."],
    given: "Mayor Eliza handed you her old pickaxe.",
    done: "Your first stone! Eliza's pickaxe is yours to keep.",
  },
};

export const TOOL_LINES = NEW_WORLD ? NEW_WORLD_TOOL_LINES : VILLAGE_TOOL_LINES;
