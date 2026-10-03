/**
 * The toast when a study session settles (cafe-polish §5): a finished session,
 * leaving early and timing out each read differently. Coins only, in the
 * play currency; never a money rate.
 */
import { COINS } from "@/lib/economy";
import type { SessionView } from "./rules";

const min = (n: number) => `${n} focus ${n === 1 ? "minute" : "minutes"}`;

/** Toast copy for an ended session, or null when there is nothing to tell (stood up before starting a timer). */
export function settlementToast(s: Pick<SessionView, "end_reason" | "coins_paid" | "coins_pending" | "minutes_completed" | "blocks_completed" | "settings">): { text: string; coins: number } | null {
  const coins = s.coins_paid ?? s.coins_pending;
  if (!s.settings && !coins) return null;
  // "TC" in words (the naming pass, menus §4): a toast's icon slot carries the coin (StudyHud), never an emoji in the text.
  const paid = `+${coins} ${COINS.name}`;
  if (s.end_reason === "finished") return { coins, text: `Session complete! ${paid} for ${min(s.minutes_completed)}${s.blocks_completed > 1 ? ` across ${s.blocks_completed} blocks` : ""}.` };
  if (!coins) return { coins, text: "You left before a focus minute finished. Nothing banked this time." };
  if (s.end_reason === "timeout") return { coins, text: `Away for 5 minutes, so the session ended. ${paid} for ${min(s.minutes_completed)}.` };
  return { coins, text: `You left early and kept ${min(s.minutes_completed)}. ${paid}` };
}
