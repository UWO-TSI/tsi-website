/**
 * First login (row 211, hud-first-login §6): the character creator, the
 * arrival at the wharf, the HQ lead's greeting in a dialogue box, then chapter
 * 1's objective. The boat trip itself is arrival-wharf.md's; until it lands
 * the arrival is a short dock fade.
 *
 * Who gets it: a signed-in member who hasn't started chapter 1 (the plot
 * isn't claimed) and hasn't been greeted on this device. A hired applicant whose look
 * carried over skips the creator but still arrives and is greeted.
 */
export type WelcomeStep = "wait" | "creator" | "welcome" | "none";

export function welcomeStep(s: { lookLoaded: boolean; lookSaved: boolean; signedIn: boolean; progressionLoaded: boolean; chapterFresh: boolean; welcomed: boolean }): WelcomeStep {
  if (!s.lookLoaded) return "wait";
  if (!s.lookSaved) return "creator";
  // Members only (the island needs a sign-in in production; signed-out benches skip it).
  if (s.welcomed || !s.signedIn) return "none";
  if (!s.progressionLoaded) return "wait";
  return s.chapterFresh ? "welcome" : "none";
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
    "You made it! Welcome to Tethos Island, {name}. I'm Wren. I keep the clubhouse running, more or less.",
    "Everyone who joins gets a plot of their own out past the pier. Yours is waiting. We just need to make it official.",
    "Come up to the clubhouse and claim it. It's the big house at the top of the path. I'll have the paperwork ready!",
  ],
} as const;

/** Where Wren waits: a step up the wharf from the arrival spot and to its right on screen (+x is screen left), facing it. */
export const LEAD_OFFSET: [number, number] = [-1.1, 1.7];
