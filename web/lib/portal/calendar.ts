/** The calendar's reads through /api/events. */
export type EventType = "club" | "team" | "bounty" | "volunteer" | "social" | "workshop" | "meeting";
export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start_time: string;
  end_time: string | null;
  location: string | null;
  description: string | null;
  tc_reward: number | null;
  xp_reward: number | null;
}
export type CalendarView = "month" | "week" | "list";

/** The days on screen: the anchor's Sunday-to-Saturday week in the week view, else the month (local time). */
export function visibleRange(view: CalendarView, year: number, month: number, weekAnchor: Date): { from: string; to: string } {
  if (view === "week") {
    const sunday = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate() - weekAnchor.getDay());
    return { from: sunday.toISOString(), to: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 6, 23, 59, 59, 999).toISOString() };
  }
  return { from: new Date(year, month, 1).toISOString(), to: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString() };
}

/** The approved events in a range; a failed fetch throws (it is not an empty month). */
export async function fetchEvents(range: { from: string; to: string }, get: typeof fetch = fetch): Promise<CalendarEvent[]> {
  const res = await get(`/api/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=200`);
  if (!res.ok) throw new Error(`events: HTTP ${res.status}`);
  const d = await res.json();
  return ((d?.events ?? []) as (CalendarEvent & { event_type?: EventType })[]).map((e) => ({ ...e, type: e.event_type ?? e.type }));
}
