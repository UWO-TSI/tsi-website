import { torontoParts } from "@/lib/time";

export type ApplicantDayPhase = "day" | "evening" | "night";
export function applicantDayPhase(date = new Date()): ApplicantDayPhase {
  const { hour } = torontoParts(date);
  return hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
}
