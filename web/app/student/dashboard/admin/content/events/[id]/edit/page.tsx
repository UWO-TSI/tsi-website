"use client";

import { use, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import EventEditor from "@/components/portal/EventEditor";

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
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setError(error?.message ?? "Event not found");
        } else {
          setRow(data as EventRow);
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

  if (error || !row) {
    return (
      <div className="text-center py-8">
        <p className="font-mono text-sm text-red-400">
          {error ?? "Event not found"}
        </p>
      </div>
    );
  }

  return <EventEditor mode="edit" rowId={id} initial={row} />;
}
