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
  /** At Yes. */
  yes: "That's you. Hold on, we're going in.",
} as const;

/** The "Yes" pill on the water. */
export const YES_LABEL = "Yes";

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
};
/** Said as a task is done, as he sets off for the next stop (by task id). */
export const TASK_DONE_LINES: Readonly<Record<string, string>> = {
  crate: "Light on your feet. This way.",
  catch: "There she is!",
};
/** Said at the very end (your collection opened), with the reward: he hands you off to Wren at HQ (row 312). */
export const END_LINE = "That's the lot. Wren will want you signed in at HQ. Up the path, the big house.";

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
};

export interface HintKeys { move: string; jump: string; wheel: string; bag: string; touch: boolean }
/** A stall hint (lib/game/arrival/tutorial.ts): what you're stuck on. */
export type HintKind = "follow" | "talk" | "jump" | "rod" | "cast" | "bag";
export interface HintCue { kind: "hint"; hint: HintKind }

/** The gentle hint for a stall, in Bram's voice, with the player's own keys (or touch wording). */
export function hintLine(cue: HintCue, k: HintKeys): string {
  switch (cue.hint) {
    case "follow": return k.touch ? "Over here! Tap where you want to go." : `Over here! ${k.move} to walk.`;
    case "talk": return k.touch ? "Tap Talk when you're ready." : "Press E when you're ready.";
    case "jump": return k.touch ? "Tap the jump button to hop over." : `${k.jump} to hop over.`;
    case "rod": return k.touch ? "Open your tools and pick the rod." : `Hold ${k.wheel} and pick the rod.`;
    case "cast": return k.touch ? "Tap to cast. When the float dips, tap again." : "Click to cast. When the float dips, click again.";
    case "bag": return k.touch ? "Have a look at what you've collected. Menu, then Collection." : `Press ${k.bag} to see what you've collected.`;
  }
}

/** A line or label with the player's keys filled in (touch: the key-less wording). */
export function fillKeys(text: string, k: Pick<HintKeys, "bag" | "touch">): string {
  return k.touch ? text.replace("Press {bag} to see", "Open Collection to see").replace(" ({bag})", "") : text.replaceAll("{bag}", k.bag);
}

/** The tutorial's reward at the end: Bram's old rod (the rod he handed you at the beach, yours to keep) and a few coins. */
export const TUTORIAL_REWARD = {
  coins: 30,
  rod: "rod_flimsy",
  title: "From Bram",
  name: "Bram's old rod",
  note: "It's yours now. And a few coins for the walk.",
} as const;
