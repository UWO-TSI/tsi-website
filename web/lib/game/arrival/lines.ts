/**
 * What Bram says through the arrival and the walk-along tutorial (specs/v1-drop.md §1; the walk-along v2, playtest
 * round 1). DRAFTS for David's review: the boat lines, the walk-along's lines, hints, tracker labels and the reward's
 * words. Lore rules (specs/lore.md): the player's substrate is never named, and no codex dumps; he talks like a fisherman.
 *
 * Keys in hints are filled in from the player's own bindings; a touch screen gets its own wording without keys.
 */

/** Bram, the wharf resident (lib/content/residentRoster.ts `wharf-keeper`): his look is the roster's. */
export const BRAM = { slug: "wharf-keeper", name: "Bram", title: "Wharf keeper" } as const;

/** Aboard and in the creator, under his speech bubble. */
export const BOAT_LINES = {
  /** Pulled aboard, the world a blur. */
  aboard: ["Easy. Easy now. I've got you.", "Breathe. There you go."],
  /** As you lean over the side: the creator opens. */
  reflection: "Have a look in the water. Who's that, then?",
  /** A few choices in. */
  coming: "There. Coming back to you, is it?",
  /** At "That's me". */
  yes: "That's you. Hold on, we're going in.",
} as const;

/** The confirm pill on the water. */
export const YES_LABEL = "That's me";

/**
 * The walk-along v2 (playtest round 1, David's walk-along note), by stop id (routes/): what Bram says when you talk to
 * him there. DRAFTS for David's review. `{bag}` is filled with the player's key (touch: no key). Lines show one at a
 * time in his bubble; E (or a tap on the prompt) moves to the next.
 */
export const STOP_LINES: Readonly<Record<string, readonly string[]>> = {
  dock: ["Easy now. That's solid ground under you.", "Walk with me. Mind the crate, you'll have to hop it."],
  museum: ["This is the museum. Odile runs it.", "Rare finds go to her. She puts them on show for the whole island."],
  shop: ["The shop. Buy, sell, trade a story.", "Anything that isn't a fish, you can sell in here."],
  hq: ["HQ. Notices, mail, club news.", "Have a look at the board now and then. Things change round here."],
  cafe: ["The café. Opening soon.", "Rosa's still sweeping. Smells good already, mind."],
  beach: ["Here we are. Best spot on the island for a quiet cast.", "Here. My old rod. Go on, catch us a fish."],
  collection: ["Ha! Not bad for a first go.", "Press {bag} to see what you've collected.",
    "Fish sell at the fish market, the shack on the wharf. Rare finds go to the museum. Everything else, the shop."],
  // The new world's walk (t-short, t-sell; David's v2 review): the dock teaches the jump and the dash, HQ first, then
  // the sights from its door, the wharf's two from the quay, a first cast off the edge, the barrel, and his rod is yours.
  // Keys: `{jump}`, `{dash}`, `{bag}`.
  dockNew: ["Easy now. That's solid ground under you.", "Legs still work? Let's see. Hop that box for me: {jump} to jump."],
  hqFirst: ["This is HQ. Alice runs the place.", "She'll sign you in and show you the ropes. Go on in, I'll wait out here."],
  // *word*: a keyword, drawn with its little icon in the dialogue box (the kit's Keyword).
  sights: [
    "All signed in? Good. Let me show you round.",
    "That's the museum. Bring Odile a *fish* or a *bug* she hasn't got, and she'll put it on show.",
    "That's the café. Sit down with a book and a friend. Time spent there earns you *coins*.",
    "And that's the shop. Tools, clothes, things for your house.",
    "Right. Down to the water. Follow me.",
  ],
  wharf: [
    "Here's the wharf. My end of the island.",
    "That's the tackle shop. Rods and bait. You'll want a better rod one day.",
    "And the shipwright's. Boats, one of these days.",
    "Now, over to the edge. Let's see you fish.",
  ],
  cast: ["Right here. The water's deep off the edge.", "Borrow my rod. Cast out and wait for the float to dip."],
  barrel: ["Ha! Not bad for a first go.", "This barrel buys fish. Open it up and sell her."],
  // Straight on from the sale (an `auto` stop): he hands you his rod, the camera close on him for the last line.
  keep: [
    "[happy] Your first coins on the island. You're a natural.",
    "That's me done showing you round. Your next step's written up by the map.",
    "And you know what? Keep the rod. It's caught me plenty. Time it caught you some.",
  ],
};
/** Said as a task is done, as he sets off for the next stop (by task id). */
export const TASK_DONE_LINES: Readonly<Record<string, string>> = {
  crate: "Light on your feet. This way.",
  /** The new world's dock: the box hopped, the dash next. */
  box: "Light on your feet. Now some speed: {dash} to dash.",
  dash: "Ha! Quick, aren't you. HQ's up this way.",
  catch: "There she is!",
};
/** Said at the very end (your collection opened), with the reward: he hands you off to Alice at HQ (row 312). */
export const END_LINE = "That's the lot. Alice will want you signed in at HQ. Up the path, the big house.";
/** A route's own last word (route.ts `end`), with the reward. */
export const END_LINES: Readonly<Record<string, string>> = {
  // HQ already done (the new world): the rest is yours, and the tracker by the map has what's next.
  free: "That's the tour. The rest is yours to find. Your next step's written up top, by the map.",
  /** Nothing more: the last stop's talk said it (the hand-over cutscene). */
  none: "",
};

/** The quest tracker's title and its steps' labels (by stop id, then task id), drafts. `{bag}`: the player's key. */
export const TRACKER_TITLE = "Walk with Bram";
export const TRACKER: Readonly<Record<string, string>> = {
  dock: "Talk to Bram on the dock",
  crate: "Hop over the crate",
  museum: "Meet Bram at the museum",
  shop: "Meet Bram at the shop",
  hq: "Meet Bram at HQ",
  cafe: "Meet Bram at the café",
  beach: "Follow Bram to the beach",
  catch: "Catch a fish",
  collection: "Show Bram your catch",
  bag: "Look at your collection ({bag})",
  dockNew: "Talk to Bram on the dock",
  box: "Jump over the box ({jump})",
  dash: "Dash ({dash})",
  hqFirst: "Follow Bram to HQ",
  alice: "Sign in with Alice at HQ",
  sights: "Meet Bram outside HQ",
  wharf: "Follow Bram down the wharf",
  cast: "Follow Bram to the edge",
  barrel: "Show Bram your catch",
  sell: "Sell your fish at the barrel",
};

export interface HintKeys { move: string; jump: string; dash: string; wheel: string; bag: string; touch: boolean }
/** A stall hint (lib/game/arrival/tutorial.ts): what you're stuck on. */
export type HintKind = "follow" | "talk" | "jump" | "dash" | "rod" | "cast" | "bag" | "hq" | "sell";
export interface HintCue { kind: "hint"; hint: HintKind }

/** The gentle hint for a stall, in Bram's voice, with the player's own keys (or touch wording). */
export function hintLine(cue: HintCue, k: HintKeys): string {
  switch (cue.hint) {
    case "follow": return k.touch ? "Over here! Tap where you want to go." : `Over here! ${k.move} to walk.`;
    case "talk": return k.touch ? "Tap Talk when you're ready." : "Press E when you're ready.";
    case "jump": return k.touch ? "Tap the jump button to hop over." : `${k.jump} to hop over.`;
    case "dash": return k.touch ? "Tap the dash button to dash." : `${k.dash} to dash. Give it a go.`;
    case "rod": return k.touch ? "Open your tools and pick the rod." : `Hold ${k.wheel} and pick the rod.`;
    case "cast": return k.touch ? "Tap to cast. When the float dips, tap again." : "Click to cast. When the float dips, click again.";
    case "bag": return k.touch ? "Have a look at what you've collected. Menu, then Collection." : `Press ${k.bag} to see what you've collected.`;
    case "hq": return "Go on in. Alice is expecting you.";
    case "sell": return k.touch ? "Tap the barrel's Sell and sell your fish." : "Press E at the barrel and sell your fish.";
  }
}

/** A line or label with the player's keys filled in (touch: the key-less wording). */
export function fillKeys(text: string, k: Pick<HintKeys, "bag" | "jump" | "dash" | "touch">): string {
  if (k.touch) return text.replace("Press {bag} to see", "Open Collection to see").replace(/ \(\{\w+\}\)/g, "").replace(": {jump} to jump", "").replace(": {dash} to dash", "");
  return text.replaceAll("{bag}", k.bag).replaceAll("{jump}", k.jump).replaceAll("{dash}", k.dash);
}

/** The tutorial's reward at the end: Bram's old rod (the rod he handed you at the beach, yours to keep) and a few coins. */
export const TUTORIAL_REWARD = {
  coins: 30,
  rod: "rod_flimsy",
  title: "From Bram",
  name: "Bram's old rod",
  note: "It's yours now. And a few coins for the walk.",
} as const;
