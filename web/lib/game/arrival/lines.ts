/**
 * What Bram says through the arrival and the walk-along tutorial (specs/v1-drop.md §1). DRAFTS for David's review: the
 * tutorial's step lines are the approved ones; the boat lines, the hints and the reward's words are proposals. Lore
 * rules (specs/lore.md): the player's substrate is never named, and no codex dumps; he talks like a fisherman.
 *
 * Keys in hints are filled in from the player's own bindings ({move}, {jump}, {wheel}, {bag}); a touch screen gets its
 * own wording without keys.
 */
import type { TutorialStepId } from "./tutorial";

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

/** The tutorial's step lines (approved): said as a step starts (dock, fish, bag) or as you reach it (the street, the plaza). */
export const BRAM_LINES: Record<TutorialStepId, string | null> = {
  dock: "Easy now. Walk with me.",
  crate: null,
  fish: "Try the water.",
  bag: "Keep what you find. The museum likes fish.",
  museum: "Bring them what you find.",
  shop: "Sell, buy, trade a story.",
  hq: "Notices, mail, club news.",
  cafe: "Opening soon. Rosa's still sweeping.",
  plaza: "The island will show you the rest.",
};

/** Said by Bram as he hands the rod over (the fishing step), before the step's line. */
export const ROD_HANDOVER = "Here. My old rod.";

export interface HintKeys { move: string; jump: string; wheel: string; bag: string; touch: boolean }
/** A stall hint (lib/game/arrival/tutorial.ts): the step, and for the fishing step whether the rod is out yet. */
export interface HintCue { kind: "hint"; step: TutorialStepId; rod: boolean }

/** The gentle hint for a stall, in Bram's voice, with the player's own keys (or touch wording). */
export function hintLine(cue: HintCue, k: HintKeys): string {
  switch (cue.step) {
    case "dock": return k.touch ? "Tap where you want to go. I'll keep up." : `Use ${k.move} to walk.`;
    case "crate": return k.touch ? "Tap the jump button to hop over." : `${k.jump} to hop over.`;
    case "fish":
      if (!cue.rod) return k.touch ? "Open your tools and pick the rod." : `Hold ${k.wheel} and pick the rod.`;
      return k.touch ? "Tap to cast. When the float dips, tap again." : "Click to cast. When the float dips, click again.";
    case "bag": return k.touch ? "Have a look in your bag. Menu, then Collection." : `Press ${k.bag} to look in your bag.`;
    case "plaza": return "Nearly there. The plaza's just up here.";
    default: return "This way. Stay with me.";
  }
}

/** The tutorial's reward at the plaza: Bram's old rod (the rod he handed you, yours to keep) and a few coins. */
export const TUTORIAL_REWARD = {
  coins: 30,
  rod: "rod_flimsy",
  title: "From Bram",
  name: "Bram's old rod",
  note: "It's yours now. And a few coins for the walk.",
} as const;
