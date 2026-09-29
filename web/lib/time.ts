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
