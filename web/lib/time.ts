/** The club's clock: wall-clock parts in America/Toronto, from one shared formatter. */
const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function torontoParts(date = new Date()) {
  const p: Record<string, string> = {};
  for (const { type, value } of FMT.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute),
    /** 0 = Monday … 6 = Sunday. */
    weekday: WEEKDAYS.indexOf(p.weekday),
    /** "YYYY-MM-DD" */
    date: `${p.year}-${p.month}-${p.day}`,
    /** "YYYY-MM-DDTHH" */
    hourKey: `${p.year}-${p.month}-${p.day}T${p.hour}`,
  };
}

/** The instant a Toronto wall clock shows `hour` (0-24) on the Toronto day `day` ("YYYY-MM-DD"). */
export function torontoInstant(day: string, hour: number): Date {
  const [y, m, d] = day.split("-").map(Number), wall = Date.UTC(y, m - 1, d) + Math.round(hour * 60) * 60_000;
  const guess = new Date(wall + 5 * 3_600_000), t = torontoParts(guess); // EST; EDT shows an hour later
  return new Date(guess.getTime() + wall - Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute));
}
