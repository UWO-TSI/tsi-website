/**
 * First login (row 211; specs/v1-drop.md §1): the arrival, once per account. Bram's boat, your reflection in
 * the water as the creator, the golden-hour crossing and the walk-along tutorial (components/game/arrival), then
 * chapter 1's objective.
 *
 * Who gets it: a signed-in member whose account hasn't arrived (lib/game/arrival/arrivalFlag.ts) and who hasn't started
 * chapter 1 (the plot isn't claimed). A hired applicant whose look carried over still arrives and sees it in the
 * water. Anyone else without a look gets the plain creator. `replay` (dev, `?arrival=1`) plays it regardless.
 */
export type WelcomeStep = "wait" | "creator" | "arrival" | "none";

export function welcomeStep(s: { lookLoaded: boolean; lookSaved: boolean; signedIn: boolean; progressionLoaded: boolean; chapterFresh: boolean;
  /** The account's arrival flag: null while it loads (or signed out). */
  arrived: boolean | null; replay?: boolean }): WelcomeStep {
  if (!s.lookLoaded) return "wait";
  if (s.replay) return "arrival";
  // Members only (the island needs a sign-in in production; signed-out benches skip it).
  if (s.signedIn) {
    if (!s.progressionLoaded || s.arrived === null) return "wait";
    if (!s.arrived && s.chapterFresh) return "arrival";
  }
  return s.lookSaved ? "none" : "creator";
}

const WELCOMED = "tsi.welcomed.v1";
type Store = Pick<Storage, "getItem" | "setItem"> | null;
const local = (): Store => { try { return window.localStorage; } catch { return null; } };
export function readWelcomed(storage: Store = local()): boolean {
  try { return storage?.getItem(WELCOMED) === "1"; } catch { return false; }
}
export function markWelcomed(storage: Store = local()): void {
  try { storage?.setItem(WELCOMED, "1"); } catch { /* greeted again next visit */ }
}

/**
 * The HQ lead (resident roster, row 217): a proposal until David's list lands
 * (specs/polish/hud-first-login-questions.md). Shared rig, fixed look; meets
 * you on the wharf on your first day.
 */
export const HQ_LEAD = {
  name: "Wren",
  post: "HQ lead",
  look: {
    skin: 3, hair: 2, eyes: "E1.4", mouth: "M2.1", brows: "brow_soft", extras: ["freckles"],
    bangs: "bangs_curtain", back: "back_high_pony", top: "top_tsi_crew", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_boots",
    acc: { bag: "acc_shoulder_bag" }, colors: { bottom_trousers: 4, shoes_boots: 5, acc_shoulder_bag: 3 },
  },
  /** The greeting, one box each; `{name}` is the member's island name. */
  lines: [
    "You made it! Welcome to Tethos Island, {name}. I'm Wren. I keep HQ running, more or less.",
    "Everyone who joins gets a plot of their own out past the pier. Yours is waiting. We just need to make it official.",
    "Come up to HQ and claim it. It's the big house at the top of the path. I'll have the paperwork ready!",
  ],
} as const;
