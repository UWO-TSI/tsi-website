"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

interface Event {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  location: string | null;
}

const typeLabels: Record<string, string> = {
  club: "Club",
  team: "Team",
  bounty: "Bounty",
  volunteer: "Volunteer",
  social: "Social",
  workshop: "Workshop",
  meeting: "Meeting",
};

export default function CalendarWidget({ events }: { events: Event[] }) {
  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Upcoming Events
        </h3>
        <Link
          href="/student/dashboard/calendar"
          className="text-xs font-mono text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors"
        >
          Full Calendar
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-4">
          <Calendar
            size={24}
            className="mx-auto text-[var(--color-text-muted)]/30 mb-2"
          />
          <p className="text-xs font-mono text-[var(--color-text-muted)]">
            No upcoming events
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 group"
            >
              <div className="text-center shrink-0 w-10">
                <div className="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase">
                  {new Date(event.start_time)
                    .toLocaleDateString("en-US", { month: "short" })
                    .toUpperCase()}
                </div>
                <div className="text-lg font-mono font-bold text-[var(--color-text-primary)] leading-tight">
                  {new Date(event.start_time).getDate()}
                </div>
              </div>
              <div className="flex-1 min-w-0 border-l border-[var(--glass-border)] pl-3">
                <p className="text-sm text-[var(--color-text-primary)] truncate">
                  {event.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[0.6rem] font-mono text-[var(--color-accent-cyan)] uppercase">
                    {typeLabels[event.event_type] ?? event.event_type}
                  </span>
                  <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                    {formatTime(event.start_time)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
