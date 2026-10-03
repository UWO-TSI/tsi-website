"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  MapPin,
  Download,
  Star,
  LayoutGrid,
  List,
  Columns,
  X,
} from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Banner, Button, Empty, IconButton, Loading, Sheet, Tabs, type TabItem } from "@/components/gui";
import { useMediaQuery } from "@/lib/game/useMediaQuery";

/* ───────── types ───────── */

type EventType =
  | "club"
  | "team"
  | "bounty"
  | "volunteer"
  | "social"
  | "workshop"
  | "meeting";

interface CalendarEvent {
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

type ViewMode = "month" | "week" | "list";

/* ───────── constants ───────── */

/* Each event type's colour from the GUI sheet. Fills only (dots, bars, chip edges): the words beside them stay in ink,
   so every label is AA on paper. Tokens, not the portal's mapped ones, so the phone companion's Club tab (which
   embeds this page) draws it the same. */
const EVENT_COLORS: Record<EventType, string> = {
  club: "var(--gui-sage)",
  team: "var(--gui-teal)",
  bounty: "var(--gui-gold)",
  volunteer: "var(--gui-rarity-uncommon)",
  social: "var(--gui-rarity-epic)",
  workshop: "var(--gui-orange)",
  meeting: "var(--gui-grey)",
};

const EVENT_LABELS: Record<EventType, string> = {
  club: "Club",
  team: "Team",
  bounty: "Bounty",
  volunteer: "Volunteer",
  social: "Social",
  workshop: "Workshop",
  meeting: "Meeting",
};

const VIEW_TABS: TabItem<ViewMode>[] = [
  { id: "month", label: "Month", icon: <LayoutGrid size={14} /> },
  { id: "week", label: "Week", icon: <Columns size={14} /> },
  { id: "list", label: "List", icon: <List size={14} /> },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* The calendar's paper frame: a rounded sheet whose 1px gaps show the rule colour between the days. */
const GRID_FRAME = {
  gap: 1,
  background: "var(--gui-paper-edge)",
  border: "1.5px solid var(--gui-paper-edge)",
  borderRadius: "var(--gui-r-card)",
  boxShadow: "var(--gui-shadow-sm)",
};

/* ───────── helpers ───────── */

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return week;
}

/** A day's name for screen readers: "Friday, October 2, 3 events". */
function dayLabel(date: Date, count: number) {
  const name = date.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  return count ? `${name}, ${count} event${count !== 1 ? "s" : ""}` : name;
}

/** An event type's dot, with a faint rim so the pale colours keep their edge on cream. */
function Dot({ color, title, className = "w-2 h-2" }: { color: string; title?: string; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{ background: color, boxShadow: "inset 0 0 0 1px rgb(58 46 34 / 0.2)" }}
      title={title}
      aria-hidden
    />
  );
}

/** The chosen day's events: in the side panel on a wide screen (`inset`: padded rows), in a bottom sheet on a phone. */
function DayEvents({ events, inset }: { events: CalendarEvent[]; inset?: boolean }) {
  if (events.length === 0) return <Empty icon={<CalendarIcon size={28} />} title="Nothing on this day" />;
  return (
    <ul>
      {events.map((ev, i) => (
        <li
          key={ev.id}
          className={`space-y-2 ${inset ? "p-4" : i === 0 ? "pb-4" : "py-4"}`}
          style={i > 0 ? { borderTop: "2px dashed var(--gui-paper-edge)" } : undefined}
        >
          {/* Type dot + title */}
          <div className="flex items-start gap-2">
            <Dot color={EVENT_COLORS[ev.type]} className="w-2 h-2 mt-1.5" />
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                {ev.title}
              </p>
              <span className="text-xs" style={{ color: "var(--gui-ink-2)", fontWeight: 700 }}>
                {EVENT_LABELS[ev.type]}
              </span>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
            <Clock size={12} aria-hidden />
            {formatTime(ev.start_time)}
            {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
          </div>

          {/* Location */}
          {ev.location && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
              <MapPin size={12} aria-hidden />
              {ev.location}
            </div>
          )}

          {/* Description */}
          {ev.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--gui-ink)" }}>
              {ev.description}
            </p>
          )}

          {/* Rewards */}
          {(!!ev.tc_reward || !!ev.xp_reward) && (
            <div className="flex items-center gap-3 pt-1 text-xs" style={{ fontWeight: 800 }}>
              {!!ev.tc_reward && (
                <span style={{ color: "var(--gui-ink)" }}>
                  +<Amount n={ev.tc_reward} currency="gems" size={14} />
                </span>
              )}
              {!!ev.xp_reward && (
                <span className="flex items-center gap-1" style={{ color: "var(--gui-teal-ink)" }}>
                  <Star size={12} aria-hidden />
                  +{ev.xp_reward} XP
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ───────── component ───────── */

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [exportTooltip, setExportTooltip] = useState(false);
  // The chosen day opens beside the calendar from lg up; narrower (a phone, the companion's Club tab) it's a bottom sheet.
  const wide = useMediaQuery("(min-width: 1024px)");

  /* fetch events for visible range */
   
  /* 2026-07-22 fix: goes through /api/events instead of a direct browser
     supabase query — (a) the page no longer crashes when Supabase env vars
     are absent (createClient threw in useEffect), (b) the old query selected
     a `type` column that doesn't exist (schema column is `event_type`), so
     it silently returned zero events in prod. The API returns full rows;
     map event_type → type for the local CalendarEvent shape. */
  useEffect(() => {
    let cancelled = false;
    const rangeStart = new Date(currentYear, currentMonth, 1).toISOString();
    const rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    fetch(`/api/events?from=${encodeURIComponent(rangeStart)}&to=${encodeURIComponent(rangeEnd)}&limit=200`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        if (cancelled) return;
        const rows = (d?.events ?? []) as (CalendarEvent & { event_type?: EventType })[];
        setEvents(rows.map((e) => ({ ...e, type: e.event_type ?? e.type })));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [currentMonth, currentYear]);

  /* events for a specific date */
  const eventsForDate = useCallback(
    (date: Date) =>
      events.filter((e) => isSameDay(new Date(e.start_time), date)),
    [events]
  );

  /* navigation */
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setWeekAnchor(today);
    setSelectedDate(today);
  };

  const prevWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() - 7);
    setWeekAnchor(d);
  };
  const nextWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + 7);
    setWeekAnchor(d);
  };

  const grid = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );
  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];
  const selectedDayName = selectedDate?.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" }) ?? "";
  const selectedDayCount = selectedDate ? `${selectedEvents.length} event${selectedEvents.length !== 1 ? "s" : ""}` : undefined;

  /* sort events by date for list view */
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [events]
  );

  /* ─── render ─── */
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Banner title="Calendar" icon={<CalendarDays size={26} />} tone="coral">
          {loading
            ? "Looking up what’s on…"
            : `${events.length} event${events.length !== 1 ? "s" : ""} in ${MONTHS[currentMonth]}`}
        </Banner>

        {/* View + export */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Tabs label="Calendar view" value={view} onChange={setView} tabs={VIEW_TABS} />

          <div className="relative">
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setExportTooltip((v) => !v)}
              onBlur={() => setTimeout(() => setExportTooltip(false), 150)}
            >
              <Download className="w-4 h-4" aria-hidden />
              Export .ics
            </Button>
            <div role="status" aria-live="polite">
              {exportTooltip && (
                <div
                  className="absolute top-full mt-3 right-0 z-10 whitespace-nowrap text-sm"
                  style={{
                    padding: "6px 16px 7px",
                    borderRadius: "var(--gui-r-blob)",
                    background: "var(--gui-teal-pill)",
                    color: "var(--gui-ink-strong)",
                    fontWeight: 800,
                    boxShadow: "var(--gui-shadow-sm)",
                  }}
                >
                  Coming soon
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5" aria-label="Event types">
          {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(
            ([type, label]) => (
              <li key={type} className="flex items-center gap-1.5">
                <Dot color={EVENT_COLORS[type]} />
                <span className="text-xs" style={{ color: "var(--gui-ink-2)", fontWeight: 700 }}>
                  {label}
                </span>
              </li>
            )
          )}
        </ul>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Calendar */}
          <div className="flex-1 min-w-0">
            {/* Month/Week Navigation */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1 sm:gap-3 min-w-0">
                <IconButton
                  label={view === "week" ? "Previous week" : "Previous month"}
                  size="sm"
                  onClick={view === "week" ? prevWeek : prevMonth}
                >
                  <ChevronLeft size={18} aria-hidden />
                </IconButton>
                <h2
                  className="min-w-0 text-base sm:text-lg text-center sm:min-w-[200px]"
                  style={{ color: "var(--gui-ink-strong)", fontWeight: 800, lineHeight: 1.25 }}
                  aria-live="polite"
                >
                  {view === "week"
                    ? `${weekDates[0].toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`
                    : `${MONTHS[currentMonth]} ${currentYear}`}
                </h2>
                <IconButton
                  label={view === "week" ? "Next week" : "Next month"}
                  size="sm"
                  onClick={view === "week" ? nextWeek : nextMonth}
                >
                  <ChevronRight size={18} aria-hidden />
                </IconButton>
              </div>
              <Button size="sm" variant="quiet" onClick={goToday}>
                Today
              </Button>
            </div>

            {loading ? (
              <Loading label="Loading this month’s events…" />
            ) : view === "month" ? (
              /* ─── Month Grid ─── */
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs py-2"
                      style={{ color: "var(--gui-muted)", fontWeight: 800 }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 overflow-hidden" style={GRID_FRAME}>
                  {grid.map((date, i) => {
                    if (!date) {
                      return (
                        <div
                          key={`empty-${i}`}
                          className="h-16 sm:h-24"
                          style={{ background: "var(--gui-paper-warm)" }}
                        />
                      );
                    }
                    const dayEvents = eventsForDate(date);
                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const isCurrentMonth = isSameMonth(
                      date,
                      new Date(currentYear, currentMonth, 1)
                    );

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        aria-label={dayLabel(date, dayEvents.length)}
                        aria-pressed={!!isSelected}
                        aria-current={isToday ? "date" : undefined}
                        className={`h-16 sm:h-24 p-1 sm:p-1.5 flex flex-col items-start justify-start overflow-hidden text-left transition-colors ${
                          isCurrentMonth ? "" : "opacity-40"
                        } ${
                          isSelected
                            ? "bg-[var(--gui-butter)]"
                            : "bg-[var(--gui-paper-hi)] hover:bg-[var(--gui-paper-warm)]"
                        }`}
                      >
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0"
                          style={
                            isToday
                              ? { background: "var(--gui-sage)", color: "var(--gui-paper)", fontWeight: 800 }
                              : { color: isSelected ? "var(--gui-ink-strong)" : "var(--gui-ink-2)", fontWeight: 700 }
                          }
                        >
                          {date.getDate()}
                        </span>

                        {/* Event dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1 px-0.5">
                            {dayEvents.slice(0, 4).map((ev) => (
                              <Dot
                                key={ev.id}
                                color={EVENT_COLORS[ev.type]}
                                title={ev.title}
                                className="w-1.5 h-1.5 sm:w-2 sm:h-2"
                              />
                            ))}
                            {dayEvents.length > 4 && (
                              <span className="text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                                +{dayEvents.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : view === "week" ? (
              /* ─── Week View ─── (scrolls sideways on a phone rather than squeezing seven days) */
              <div className="overflow-x-auto pb-1">
                <div className="grid grid-cols-7 min-w-[560px] overflow-hidden" style={GRID_FRAME}>
                  {weekDates.map((date) => {
                    const dayEvents = eventsForDate(date);
                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        aria-label={dayLabel(date, dayEvents.length)}
                        aria-pressed={!!isSelected}
                        aria-current={isToday ? "date" : undefined}
                        className={`min-h-[280px] p-2 flex flex-col justify-start text-left transition-colors ${
                          isSelected
                            ? "bg-[var(--gui-butter)]"
                            : "bg-[var(--gui-paper-hi)] hover:bg-[var(--gui-paper-warm)]"
                        }`}
                      >
                        <div className="text-center mb-2 w-full">
                          <div className="text-xs" style={{ color: "var(--gui-muted)", fontWeight: 800 }}>
                            {DAYS[date.getDay()]}
                          </div>
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mt-1"
                            style={
                              isToday
                                ? { background: "var(--gui-sage)", color: "var(--gui-paper)", fontWeight: 800 }
                                : { color: "var(--gui-ink-strong)", fontWeight: 800 }
                            }
                          >
                            {date.getDate()}
                          </span>
                        </div>
                        <div className="space-y-1 w-full">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="rounded-lg px-1.5 py-1 text-xs leading-tight truncate"
                              style={{
                                background: `color-mix(in srgb, ${EVENT_COLORS[ev.type]} 18%, var(--gui-paper-hi))`,
                                borderLeft: `3px solid ${EVENT_COLORS[ev.type]}`,
                                color: "var(--gui-ink-2)",
                                fontWeight: 700,
                              }}
                            >
                              {formatTime(ev.start_time)}
                              <br />
                              <span className="text-xs" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                                {ev.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ─── List View ─── */
              <div className="space-y-2.5">
                {sortedEvents.length === 0 ? (
                  <Empty icon={<CalendarIcon size={32} />} title={`Nothing on in ${MONTHS[currentMonth]}`}>
                    New events show up here once they’re planned. Try another month.
                  </Empty>
                ) : (
                  sortedEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedDate(new Date(ev.start_time))}
                      className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left transition-transform hover:-translate-y-0.5"
                      style={{
                        background: "var(--gui-paper-hi)",
                        borderRadius: "var(--gui-r-card)",
                        boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
                      }}
                    >
                      {/* Date badge */}
                      <div className="flex flex-col items-center justify-center w-11 shrink-0">
                        <span className="text-xs" style={{ color: "var(--gui-muted)", fontWeight: 800 }}>
                          {new Date(ev.start_time).toLocaleDateString("en-CA", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-lg" style={{ color: "var(--gui-ink-strong)", fontWeight: 800, lineHeight: 1.1 }}>
                          {new Date(ev.start_time).getDate()}
                        </span>
                      </div>

                      {/* Color bar */}
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ background: EVENT_COLORS[ev.type] }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                          {ev.title}
                        </p>
                        <div
                          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs"
                          style={{ color: "var(--gui-muted)", fontWeight: 700 }}
                        >
                          <span style={{ color: "var(--gui-ink-2)" }}>
                            {EVENT_LABELS[ev.type]}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} aria-hidden />
                            {formatTime(ev.start_time)}
                            {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                          </span>
                          {ev.location && (
                            <span className="flex items-center gap-1 min-w-0">
                              <MapPin size={12} className="shrink-0" aria-hidden />
                              <span className="truncate">{ev.location}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rewards */}
                      {(!!ev.tc_reward || !!ev.xp_reward) && (
                        <div className="flex flex-col items-end gap-1 shrink-0 text-xs" style={{ fontWeight: 800 }}>
                          {!!ev.tc_reward && (
                            <span style={{ color: "var(--gui-ink)" }}>
                              <Amount n={ev.tc_reward} currency="gems" size={14} />
                            </span>
                          )}
                          {!!ev.xp_reward && (
                            <span className="flex items-center gap-1" style={{ color: "var(--gui-teal-ink)" }}>
                              <Star size={12} aria-hidden />
                              {ev.xp_reward} XP
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ─── Side Panel: Selected Day ─── (beside the calendar from lg up) */}
          {selectedDate && wide && (
            <aside className="w-80 shrink-0" aria-label="Selected day">
              <div
                className="sticky top-6 overflow-hidden"
                style={{
                  background: "var(--gui-paper-hi)",
                  borderRadius: "var(--gui-r-card)",
                  boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
                }}
              >
                {/* Panel header */}
                <div
                  className="flex items-center justify-between gap-2"
                  style={{
                    padding: "10px 10px 10px 18px",
                    background: "var(--gui-paper-warm)",
                    borderBottom: "2px dashed var(--gui-paper-edge)",
                  }}
                >
                  <div>
                    <h3 className="text-base" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                      {selectedDayName}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                      {selectedDayCount}
                    </p>
                  </div>
                  <IconButton label="Close this day" size="sm" onClick={() => setSelectedDate(null)}>
                    <X size={16} aria-hidden />
                  </IconButton>
                </div>

                {/* Event list */}
                <div className="max-h-[60vh] overflow-y-auto">
                  <DayEvents events={selectedEvents} inset />
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ─── Selected Day on a phone ─── (a bottom sheet over the calendar) */}
      <Sheet
        open={!wide && selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedDayName}
        eyebrow={selectedDayCount}
        icon={<CalendarDays size={22} />}
        size="sm"
      >
        {selectedDate && <DayEvents events={selectedEvents} />}
      </Sheet>
    </div>
  );
}
