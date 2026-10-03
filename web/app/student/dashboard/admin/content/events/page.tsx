"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, ArrowLeft, CalendarDays, Plus, Pencil, Printer } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { Amount } from "@/components/economy/Amount";
import { Badge, Card, Empty, ErrorNote, Loading, type BadgeTone } from "@/components/gui";
import { buttonLinkCls } from "@/components/portal/ProgressionAdminShared";

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

const typeTones: Record<string, BadgeTone> = {
  club: "sage",
  team: "info",
  bounty: "gold",
  volunteer: "success",
  social: "neutral",
  workshop: "info",
  meeting: "neutral",
};

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

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
      <div className={PAGE}>
        <Loading label="Opening the events…" />
      </div>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          Event admin is only open to the club’s admins.
        </Empty>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <Link href="/student/dashboard/admin" className={BACK}>
        <ArrowLeft size={16} aria-hidden />
        Back to admin
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
            Events
          </h1>
          <p className="mt-1 text-sm text-[var(--gui-muted)]">
            {events?.length ?? 0} approved events. Edit one, or print its QR
            code for check-in at the door.
          </p>
        </div>
        <Link
          href="/student/dashboard/admin/content/events/new"
          className={BUTTON_LINK}
          data-size="sm"
        >
          <Plus size={16} aria-hidden /> New event
        </Link>
      </div>

      {fetchError && (
        <ErrorNote className="mb-4">
          The events didn’t load ({fetchError}).
        </ErrorNote>
      )}

      {events === null ? (
        <Loading label="Getting the events…" />
      ) : events.length === 0 ? (
        fetchError ? null : (
          <Empty icon={<CalendarDays size={32} />} title="No events yet">
            Make one and it shows up here, ready to print its QR code.
          </Empty>
        )
      ) : (
        <Card style={{ padding: 0 }} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--gui-paper-warm)]">
                <th className={`${TH} text-left`}>Event</th>
                <th className={`${TH} text-left`}>Type</th>
                <th className={`${TH} text-left`}>Starts</th>
                <th className={`${TH} text-left`}>Where</th>
                <th className={`${TH} text-right`}>Rewards</th>
                <th className={`${TH} text-right`}>RSVPs</th>
                <th className={`${TH} text-left`}>Status</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-t-2 border-dashed border-[var(--gui-paper-edge)]"
                >
                  <td className="px-4 py-3 font-extrabold text-[var(--gui-ink-strong)]">
                    {ev.title}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={typeTones[ev.event_type] ?? "neutral"}>
                      {capitalize(ev.event_type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink-2)]">
                    {when(ev.start_time)}
                  </td>
                  <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                    {ev.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-[var(--gui-ink)]">
                    {ev.xp_reward ?? 0} XP · <Amount n={ev.tc_reward ?? 0} currency="gems" />
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--gui-ink-2)]">
                    {ev.attendee_count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ev.status === "approved" ? "success" : "neutral"}>
                      {capitalize(ev.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3 whitespace-nowrap">
                      <Link
                        href={`/student/dashboard/admin/content/events/${ev.id}/edit`}
                        className="inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"
                      >
                        <Pencil size={14} aria-hidden /> Edit
                      </Link>
                      <Link
                        href={`/student/dashboard/admin/content/events/${ev.id}/print`}
                        target="_blank"
                        className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"
                      >
                        <Printer size={14} aria-hidden /> Print QR
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
