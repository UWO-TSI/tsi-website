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

/** Her lines by key (script.ts says which beat says which). */
export const WREN_LINES: Readonly<Record<string, readonly string[]>> = {
  // The lore overlay opens after these.
  welcome: [
    "[happy] There you are! Bram said you'd be up. I'm Alice. I keep HQ running, more or less.",
    "Before anything else, let me show you where you've washed up.",
  ],
  // Registering.
  register: [
    "[happy] Right. First things first: the island register. Everyone who stays signs it.",
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
    "The best way to earn coins, gems and experience is being part of TSI and coming to our events.",
    "Every event has a check-in code at the door. Scan it and it all lands in your account.",
  ],
  // Coins and gems for real merch.
  merch: [
    "[happy] And here's the good bit. What you earn isn't stuck on the island.",
    "Save it up and trade it for real TSI merch at the shop. Shirts, stickers, the lot.",
  ],
  // The UI tour overlay opens after this.
  tour: [
    "Now, the practical bit. Let me show you where everything is.",
  ],
  // Esc for real. `{esc}`: the key, or the menu button on a touch screen.
  menu: [
    "Last thing, then you're free. {esc}",
  ],
  // The visit's end, Bram's tour already done (the village's order): your first catch to Juno at the museum (m1).
  farewell: [
    "That's your menu: the map, your quests, your bag and collection, friends and mail.",
    "That's you registered. Bring your first catch to Juno at the museum. She'll show you round.",
    "Oh, and you'll want more than a rod. Odile has a spare net and Pim always has a shovel. Ask them.",
    "[happy] Welcome to Tethos Island, {name}.",
  ],
  // The visit's end with Bram's tour still on (HQ first): he's waiting outside.
  farewellTour: [
    "That's your menu: the map, your quests, your bag and collection, friends and mail.",
    "[happy] That's you registered, {name}. Welcome to Tethos Island.",
    "Bram's waiting for you outside. He'll show you the rest of the village.",
    "And once you've a first catch, bring it to Juno at the museum. She'll show you round.",
  ],
};

/** `{esc}` in her lines, said with your key. */
export const escPhrase = (touch: boolean) => (touch ? "Tap the menu button." : "Press Esc.");

/** The visit as the quest tracker shows it: its title and a step per beat (script.ts ids). `{esc}`: the key. */
export const HQ_TITLE = "Register at HQ";
export const HQ_TRACKER: Readonly<Record<string, string>> = {
  report: "Report to Alice at HQ",
  lore: "Hear about Tethos",
  register: "Sign the island register",
  checkin: "Find out about check-ins",
  merch: "Find out about real merch",
  tour: "Learn the buttons",
  esc: "Open the menu ({esc})",
};
export const trackerEsc = (label: string, touch: boolean) => (touch ? label.replace(" ({esc})", "") : label.replaceAll("{esc}", "Esc"));

/** The lore overlay (t-hq): a page at a time, over the room. DRAFTS. Tethos as it really is; the island's own lore stays light. */
export const LORE_CARD = {
  pages: [
    { title: "Tethos", text: "Tethos is a tech nonprofit: people who build real things together, and look out for each other while they do it." },
    { title: "The island", text: "Between events, this island is how its members stay connected. Fish, dig, decorate, study at the café, and find each other again." },
    { title: "What counts", text: "The island measures you by what you do out there, not in here. Real events, real projects, real people." },
  ],
  next: "Next",
  done: "Got it",
} as const;

/** The coins-and-merch card (t-hq): what each currency is for and how it's earned. Never a rate to real money. DRAFTS. */
export const MERCH_CARD = {
  eyebrow: "The real club",
  title: "Earn it, wear it",
  rows: [
    { icon: "coins", name: "Coins", text: "From events, and from what you catch and sell. Spend them at the shop." },
    { icon: "gems", name: "Gems", text: "Rarer. From events and club goals. They reserve real TSI merch." },
    { icon: "xp", name: "Experience", text: "Only from real events. It's what levels you up." },
  ],
  note: "Reserve merch in the shop, and the club hands it to you in person.",
  done: "Nice",
} as const;

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
