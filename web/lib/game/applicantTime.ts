export type ApplicantDayPhase = "day" | "evening" | "night";
export function applicantDayPhase(date = new Date()): ApplicantDayPhase {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(date));
  return hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
}
