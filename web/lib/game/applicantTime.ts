import { torontoParts } from "@/lib/time";
import { worldNow } from "./worldClock";

export type ApplicantDayPhase = "day" | "evening" | "night";
/** The applicant island's phase at world-clock time (worldClock.ts), the clock its sun follows. */
export function applicantDayPhase(date = new Date(worldNow())): ApplicantDayPhase {
  const { hour } = torontoParts(date);
  return hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
}
