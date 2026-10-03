"use client";

import { use, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import EventEditor from "@/components/portal/EventEditor";
import { Empty, ErrorNote, Loading } from "@/components/gui";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  is_irl: boolean | null;
  xp_reward: number | null;
  tc_reward: number | null;
  qr_check_in_code: string | null;
}

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, loading } = useUser();
  const [row, setRow] = useState<EventRow | null>(null);
  const [rowLoading, setRowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        // The check-in code isn't readable with a member's key; the T1/T2 route hands it over.
        const [{ data, error }, code] = await Promise.all([
          supabase
            .from("events")
            .select("id, title, description, event_type, start_time, end_time, location, capacity, is_irl, xp_reward, tc_reward")
            .eq("id", id)
            .single(),
          fetch(`/api/events/${id}/check-in`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (cancelled) return;
        if (error || !data) {
          setError(error?.message ?? "Event not found");
        } else {
          setRow({ ...data, qr_check_in_code: code?.code ?? null } as EventRow);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load event");
        }
      } finally {
        if (!cancelled) setRowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || rowLoading) {
    return (
      <div className={PAGE}>
        <Loading label="Opening the event…" />
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

  if (error || !row) {
    return (
      <div className={PAGE}>
        <ErrorNote>This event didn’t load ({error ?? "Event not found"}).</ErrorNote>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <EventEditor mode="edit" rowId={id} initial={row} />
    </div>
  );
}
