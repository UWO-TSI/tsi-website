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
export const WREN = { slug: "wren", name: "Alice", post: "hq_lead" } as const;

/** Her lines by key (script.ts says which beat says which). David's v2 review: the lore first, for someone who's never
 * heard of the club; then the club woven in (the gatherings, GENESIS). Never a rate between gems or coins and money. */
export const WREN_LINES: Readonly<Record<string, readonly string[]>> = {
  // The lore overlay opens after these.
  welcome: [
    "[happy] There you are! Bram said you'd be up. I'm Alice. I keep HQ running, more or less.",
    "You've washed up somewhere special. Let me tell you where.",
  ],
  // Your island ID: the card opens after these.
  idAsk: [
    "[happy] Now, every islander gets an ID. Let's make yours.",
    "A few questions, then I'll print it for you.",
  ],
  idDone: [
    "[happy] There. That's you, {name}. Official.",
    "Your friend code's on it. Give it to anyone you want to find again.",
  ],
  // Money: each currency's icon pops up and flies to where it lives on your screen.
  coins: [
    "Now, money. Coins first.",
    "You earn coins fishing, selling, all sorts. Spend them on the island: tools, clothes, things for your house.",
  ],
  gems: [
    "Gems are the rare ones. You get them at the gatherings and from club goals.",
    "Trade them for rare items, or for real merch. Real shirts and stickers, shipped to your door.",
  ],
  // The gatherings' check-in code: the card opens after these.
  events: [
    "Remember those gatherings out in the world? Each one has a check-in code at the door.",
    "Scan it, and the awards and experience land on your account.",
  ],
  // The keyboard tour opens after this: each key you press brings its part of your screen in.
  tour: ["Now your keys. Press each one as it lights up, and watch your screen fill in."],
  // Esc for real. `{esc}`: the key, or the menu button on a touch screen.
  menu: [
    "Last thing, then you're free. {esc}",
  ],
  // The visit's end, Bram's tour already done: your first catch to Juno at the museum (m1). Things in HQ to look at.
  // Her look-round-HQ line (the notice board, the trophy case, the Founder's desk) is out until later (David's playtest).
  farewell: [
    "That's your menu. It's there whenever you need it.",
    "That's you registered. Bring your first catch to Juno at the museum. She'll show you round.",
    "Oh, and you'll want more than a rod. Odile has a spare net and Pim always has a shovel. Ask them.",
    "[happy] Welcome to Tethos Island, {name}.",
  ],
  // The visit's end with Bram's tour still on (HQ first): things in HQ to look at, then he's waiting outside.
  farewellTour: [
    "That's your menu. It's there whenever you need it.",
    "[happy] That's you sorted, {name}. Welcome to Tethos Island.",
    "Bram's waiting for you outside. He'll show you the rest of the island.",
    "And once you've a first catch, bring it to Juno at the museum. She'll show you round.",
  ],
};

/** `{esc}` in her lines, said with your key. */
export const escPhrase = (touch: boolean) => (touch ? "Tap the menu button." : "Press Esc.");

/** The visit as the quest tracker shows it: its title and a step per beat (script.ts ids). `{esc}`: the key. */
export const HQ_TITLE = "Register at HQ";
export const HQ_TRACKER: Readonly<Record<string, string>> = {
  report: "Report to Alice at HQ",
  lore: "Hear about Tethos Island",
  id: "Make your island ID",
  coins: "Find out about coins",
  gems: "Find out about gems",
  events: "Find out about check-ins",
  tour: "Learn the keys",
  esc: "Open the menu ({esc})",
};
export const trackerEsc = (label: string, touch: boolean) => (touch ? label.replace(" ({esc})", "") : label.replaceAll("{esc}", "Esc"));

/** The lore overlay, a page at a time over the room: the island first (the Founder, everyone welcome), then the gatherings. DRAFTS. */
export const LORE_CARD = {
  pages: [
    { title: "Tethos Island", text: "Far out past the veil, where no map reaches, the Founder found this island." },
    { title: "Open to everyone", text: "The Founder didn't keep it. The island was opened to anyone who washes ashore: to fish, dig, build a home, and find each other." },
    { title: "The gatherings", text: "Tethos also holds gatherings in person, out in the world, like GENESIS. Go to one and you bring back limited awards, and plenty of experience: they're a great way to level up." },
  ],
  next: "Next",
  done: "Got it",
} as const;

/** What flies to its place on your screen (script.ts `fly:` cards): its name and what it's for. Never a rate to real money. */
export const FLY_CARDS = {
  coins: { name: "Coins", text: "For things on the island" },
  gems: { name: "Gems", text: "For rare items and real merch" },
} as const;
export type FlyTarget = keyof typeof FLY_CARDS;

/**
 * Your island ID (the front desk): Alice asks, prints it and stamps it. Only existing profile fields, ones that mean
 * something to anyone, in the club or not (David's playtest: "ask for stuff that matters"): your world name, your
 * birthday (private), where you're from (`hometown`) and a line about you (`bio`). Your world name only.
 */
export const ID_CARD = {
  eyebrow: "HQ front desk",
  title: "Your island ID",
  island: "Tethos Island",
  kind: "Resident",
  name: "World name",
  /** Signed out (a preview): no world name. */
  noName: "Your world name",
  nameHint: "The only name anyone sees here.",
  birthday: "Birthday",
  birthdayHint: "Optional. Only HQ sees it.",
  from: "From",
  fromHint: "Optional. Where you call home.",
  fromSample: "Your hometown",
  about: "About you",
  aboutHint: "Optional. One line about you, on your profile.",
  aboutSample: "Say hi in a line",
  /** An empty row on the printed card. */
  blank: "·",
  code: "Friend code",
  /** No account to issue one for (signed out, a preview). */
  codeLater: "Issued once you're signed in",
  print: "Print my ID",
  printing: "Printing…",
  stamp: "Resident",
  done: "Done",
  /** The save didn't take: said under the card, and Done still works. */
  unsaved: "HQ couldn't save that just now. Your card's still yours.",
} as const;

/** The check-in card: where a gathering's check-in code goes (the existing flow: the door's QR, lib/portal/checkIn.ts). */
export const CHECKIN_CARD = {
  eyebrow: "Out in the world",
  title: "Gathering check-ins",
  /** `{host}` is where the QR opens (CHECK_IN_ORIGIN). */
  steps: [
    "At a Tethos gathering, find the check-in QR code by the door.",
    "Scan it with your phone. It opens {host}/student/check-in.",
    "You're checked in. Your awards and experience land on your account.",
  ],
  note: "Gatherings in person are a great way to level up.",
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
export const TOOL_LINES: Readonly<Record<string, { title: string; step: string; offer: readonly string[]; during: readonly string[]; given: string; done: string }>> = {
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
