"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Plus, Pencil, Printer } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  is_all_day: boolean | null;
  tc_reward: number | null;
  xp_reward: number | null;
  status: string;
  attendee_count?: number;
}

const typeColors: Record<string, string> = {
  club: "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10",
  team: "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10",
  bounty: "text-red-400 bg-red-400/10",
  volunteer: "text-green-400 bg-green-400/10",
  social: "text-[#a78bfa] bg-[#a78bfa]/10",
  workshop: "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10",
  meeting: "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10",
};

export default function AdminContentEventsPage() {
  const { profile, loading } = useUser();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/events?limit=100");
        if (cancelled) return;
        if (!res.ok) {
          setFetchError(`HTTP ${res.status}`);
          setEvents([]);
          return;
        }
        const json = (await res.json()) as { events?: EventRow[] };
        if (cancelled) return;
        setEvents(json.events ?? []);
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "unknown");
          setEvents([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
        Loading...
      </p>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto text-[var(--color-text-muted)]/20 mb-4"
          />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-sm font-mono text-[var(--color-text-muted)]">
            T1/T2 clearance required for content admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Admin
        </Link>
      </div>

      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Events
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {events?.length ?? 0} approved events · click an event to edit or
            print its QR check-in code.
          </p>
        </div>
        <Link
          href="/student/dashboard/admin/content/events/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={12} /> New Event
        </Link>
      </div>

      {fetchError && (
        <p className="mb-4 text-xs font-mono text-[var(--color-text-muted)]">
          Events fetch failed ({fetchError}).
        </p>
      )}

      {events === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading events...
        </p>
      ) : events.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No events to show.
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Start
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Location
                </th>
                <th className="text-right px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  XP / TC
                </th>
                <th className="text-right px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  RSVPs
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-[var(--glass-border)]/40 last:border-b-0"
                >
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {ev.title}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                        typeColors[ev.event_type] ?? typeColors.meeting
                      }`}
                    >
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                    {new Date(ev.start_time).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {ev.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <span className="text-[var(--color-accent-cyan)]">
                      {ev.xp_reward ?? 0} XP
                    </span>
                    <span className="text-[var(--color-text-muted)]"> / </span>
                    <span className="text-[var(--color-brand-yellow)]">
                      ₮{ev.tc_reward ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-text-muted)]">
                    {ev.attendee_count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                        ev.status === "approved"
                          ? "text-green-400 bg-green-400/10"
                          : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                      }`}
                    >
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/student/dashboard/admin/content/events/${ev.id}/edit`}
                        className="inline-flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-accent-cyan)] hover:underline"
                      >
                        <Pencil size={11} /> Edit
                      </Link>
                      <Link
                        href={`/student/dashboard/admin/content/events/${ev.id}/print`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-brand-yellow)] hover:underline"
                      >
                        <Printer size={11} /> Print QR
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
