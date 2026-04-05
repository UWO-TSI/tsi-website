"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Download,
  Zap,
  Star,
  LayoutGrid,
  List,
  Columns,
  X,
} from "lucide-react";

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

const EVENT_COLORS: Record<EventType, string> = {
  club: "var(--color-brand-blue)",
  team: "var(--color-accent-cyan)",
  bounty: "var(--color-brand-yellow)",
  volunteer: "#22c55e",
  social: "#a78bfa",
  workshop: "#f97316",
  meeting: "#71717a",
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
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
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

  /* fetch events for visible range */
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const rangeStart = new Date(currentYear, currentMonth, 1).toISOString();
    const rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    supabase
      .from("events")
      .select("id, title, type, start_time, end_time, location, description, tc_reward, xp_reward")
      .eq("status", "approved")
      .gte("start_time", rangeStart)
      .lte("start_time", rangeEnd)
      .order("start_time")
      .then(({ data }) => {
        if (!cancelled) {
          setEvents((data as CalendarEvent[]) ?? []);
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

  /* sort events by date for list view */
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [events]
  );

  /* ─── render ─── */
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Calendar
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {events.length} event{events.length !== 1 ? "s" : ""} this month
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
            {([
              { mode: "month" as ViewMode, icon: LayoutGrid, label: "Month" },
              { mode: "week" as ViewMode, icon: Columns, label: "Week" },
              { mode: "list" as ViewMode, icon: List, label: "List" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  view === mode
                    ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => setExportTooltip((v) => !v)}
              onBlur={() => setTimeout(() => setExportTooltip(false), 150)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand-blue)]/30 transition-all"
            >
              <Download size={13} />
              Export .ics
            </button>
            {exportTooltip && (
              <div className="absolute top-full mt-2 right-0 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--color-brand-yellow)] whitespace-nowrap z-10 shadow-lg">
                Coming soon
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(
          ([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: EVENT_COLORS[type] }}
              />
              <span className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                {label}
              </span>
            </div>
          )
        )}
      </div>

      <div className="flex gap-5">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Month/Week Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={view === "week" ? prevWeek : prevMonth}
                className="p-1.5 rounded hover:bg-[var(--color-bg-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-heading font-semibold text-[var(--color-text-primary)] min-w-[200px] text-center">
                {view === "week"
                  ? `${weekDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : `${MONTHS[currentMonth]} ${currentYear}`}
              </h2>
              <button
                onClick={view === "week" ? nextWeek : nextMonth}
                className="p-1.5 rounded hover:bg-[var(--color-bg-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={goToday}
              className="px-3 py-1 rounded text-xs font-mono text-[var(--color-accent-cyan)] border border-[var(--color-accent-cyan)]/20 hover:bg-[var(--color-accent-cyan)]/5 transition-all"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
                Loading events...
              </p>
            </div>
          ) : view === "month" ? (
            /* ─── Month Grid ─── */
            <div>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 border-t border-l border-[var(--glass-border)]">
                {grid.map((date, i) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${i}`}
                        className="h-24 border-r border-b border-[var(--glass-border)] bg-[var(--color-bg-main)]"
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
                      onClick={() => setSelectedDate(date)}
                      className={`h-24 border-r border-b border-[var(--glass-border)] p-1.5 text-left transition-all relative group ${
                        isCurrentMonth
                          ? "bg-[var(--color-bg-main)] hover:bg-[var(--color-bg-alt)]"
                          : "bg-[var(--color-bg-main)]/50 opacity-40"
                      } ${
                        isSelected
                          ? "bg-[var(--color-brand-blue)]/5 border-[var(--color-brand-blue)]/30"
                          : ""
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono ${
                          isToday
                            ? "bg-[var(--color-brand-blue)] text-white shadow-[0_0_12px_var(--glow-blue)]"
                            : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {/* Event dots */}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 px-0.5">
                          {dayEvents.slice(0, 4).map((ev) => (
                            <span
                              key={ev.id}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: EVENT_COLORS[ev.type] }}
                              title={ev.title}
                            />
                          ))}
                          {dayEvents.length > 4 && (
                            <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)]">
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
            /* ─── Week View ─── */
            <div>
              <div className="grid grid-cols-7 border-t border-l border-[var(--glass-border)]">
                {weekDates.map((date) => {
                  const dayEvents = eventsForDate(date);
                  const isToday = isSameDay(date, today);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[280px] border-r border-b border-[var(--glass-border)] p-2 text-left transition-all ${
                        isSelected
                          ? "bg-[var(--color-brand-blue)]/5"
                          : "bg-[var(--color-bg-main)] hover:bg-[var(--color-bg-alt)]"
                      }`}
                    >
                      <div className="text-center mb-2">
                        <div className="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase">
                          {DAYS[date.getDay()]}
                        </div>
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-mono mt-1 ${
                            isToday
                              ? "bg-[var(--color-brand-blue)] text-white shadow-[0_0_12px_var(--glow-blue)]"
                              : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="rounded px-1.5 py-1 text-[0.6rem] font-mono leading-tight truncate"
                            style={{
                              background: `color-mix(in srgb, ${EVENT_COLORS[ev.type]} 15%, transparent)`,
                              color: EVENT_COLORS[ev.type],
                              borderLeft: `2px solid ${EVENT_COLORS[ev.type]}`,
                            }}
                          >
                            {formatTime(ev.start_time)}
                            <br />
                            <span className="text-[var(--color-text-primary)] text-[0.6rem]">
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
            <div className="space-y-2">
              {sortedEvents.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarIcon
                    size={32}
                    className="mx-auto mb-3 text-[var(--color-text-muted)]"
                  />
                  <p className="font-mono text-sm text-[var(--color-text-muted)]">
                    No events this month
                  </p>
                </div>
              ) : (
                sortedEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedDate(new Date(ev.start_time))}
                    className="w-full flex items-center gap-4 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 text-left hover:border-[var(--color-brand-blue)]/30 transition-all"
                  >
                    {/* Date badge */}
                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                      <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase">
                        {new Date(ev.start_time).toLocaleDateString(undefined, {
                          month: "short",
                        })}
                      </span>
                      <span className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
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
                      <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                        <span style={{ color: EVENT_COLORS[ev.type] }}>
                          {EVENT_LABELS[ev.type]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(ev.start_time)}
                          {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={10} />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rewards */}
                    {(ev.tc_reward || ev.xp_reward) && (
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.tc_reward && (
                          <span className="flex items-center gap-0.5 text-[0.65rem] font-mono text-[var(--color-brand-yellow)]">
                            <Zap size={10} />
                            {ev.tc_reward} TC
                          </span>
                        )}
                        {ev.xp_reward && (
                          <span className="flex items-center gap-0.5 text-[0.65rem] font-mono text-[var(--color-accent-cyan)]">
                            <Star size={10} />
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

        {/* ─── Side Panel: Selected Day ─── */}
        {selectedDate && (
          <div className="w-80 shrink-0">
            <div className="sticky top-6 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
                <div>
                  <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] mt-0.5">
                    {selectedEvents.length} event
                    {selectedEvents.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 rounded hover:bg-[var(--color-bg-main)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Event list */}
              <div className="max-h-[60vh] overflow-y-auto">
                {selectedEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <CalendarIcon
                      size={24}
                      className="mx-auto mb-2 text-[var(--color-text-muted)]"
                    />
                    <p className="text-xs font-mono text-[var(--color-text-muted)]">
                      No events scheduled
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--glass-border)]">
                    {selectedEvents.map((ev) => (
                      <div key={ev.id} className="p-4 space-y-2">
                        {/* Type badge + title */}
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                            style={{ background: EVENT_COLORS[ev.type] }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--color-text-primary)]">
                              {ev.title}
                            </p>
                            <span
                              className="text-[0.6rem] font-mono uppercase tracking-wider"
                              style={{ color: EVENT_COLORS[ev.type] }}
                            >
                              {EVENT_LABELS[ev.type]}
                            </span>
                          </div>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                          <Clock size={11} />
                          {formatTime(ev.start_time)}
                          {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                        </div>

                        {/* Location */}
                        {ev.location && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                            <MapPin size={11} />
                            {ev.location}
                          </div>
                        )}

                        {/* Description */}
                        {ev.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                            {ev.description}
                          </p>
                        )}

                        {/* Rewards */}
                        {(ev.tc_reward || ev.xp_reward) && (
                          <div className="flex items-center gap-3 pt-1">
                            {ev.tc_reward && (
                              <span className="flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-brand-yellow)]">
                                <Zap size={11} />
                                +{ev.tc_reward} TC
                              </span>
                            )}
                            {ev.xp_reward && (
                              <span className="flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-accent-cyan)]">
                                <Star size={11} />
                                +{ev.xp_reward} XP
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
