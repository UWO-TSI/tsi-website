"use client";

// ─── Guestbook Moderation (sprint E7) ──────────────────────────────────────
// T1/T2 page to hide/unhide guestbook entries. Defaults to showing only
// visible entries (hidden=false); toggle "Show hidden too" to include them.
// 25 per page with Prev/Next pagination.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, EyeOff, Eye } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 25;

interface EntryRow {
  id: string;
  user_id: string | null;
  message: string;
  hidden: boolean;
  created_at: string;
}

export default function AdminGuestbookPage() {
  const { profile, loading } = useUser();
  const [rows, setRows] = useState<EntryRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from("guestbook_entries")
        .select("id, user_id, message, hidden, created_at")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      if (!showHidden) query = query.eq("hidden", false);

      const { data, error } = await query;
      if (error || !data) {
        setFetchError(error?.message ?? "Failed to load guestbook");
        setRows([]);
        setHasMore(false);
        return;
      }
      const list = data as unknown as EntryRow[];
      const more = list.length > PAGE_SIZE;
      const pageRows = more ? list.slice(0, PAGE_SIZE) : list;
      setRows(pageRows);
      setHasMore(more);

      const userIds = Array.from(
        new Set(pageRows.map((r) => r.user_id).filter(Boolean)),
      ) as string[];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        setUserMap((prev) => {
          const next = { ...prev };
          for (const u of users ?? []) {
            const row = u as { id: string; display_name: string | null };
            next[row.id] = row.display_name ?? "unknown";
          }
          return next;
        });
      }
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load guestbook",
      );
      setRows([]);
      setHasMore(false);
    }
  }, [page, showHidden]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const toggleHidden = async (id: string, currentHidden: boolean) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/guestbook/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !currentHidden }),
      });
      if (res.ok) {
        setRows((prev) =>
          (prev ?? []).map((r) =>
            r.id === id ? { ...r, hidden: !currentHidden } : r,
          ),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const tier = profile?.tier ?? 5;

  if (loading) {
    return (
      <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
        Loading...
      </p>
    );
  }

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
            T1/T2 clearance required for moderation.
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

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Guestbook Moderation
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Hide or unhide guestbook entries.
        </p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => {
              setShowHidden(e.target.checked);
              setPage(0);
            }}
            className="w-4 h-4"
          />
          <span className="text-xs font-mono text-[var(--color-text-soft)]">
            Show hidden too
          </span>
        </label>
      </div>

      {fetchError ? (
        <p className="mb-4 p-3 rounded-md text-xs font-mono border bg-red-400/10 border-red-400/30 text-red-400">
          {fetchError}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading entries...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No guestbook entries match the current filter.
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <Th>Time</Th>
                <Th>Author</Th>
                <Th>Message</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = `${r.id}:m`;
                const long = r.message.length > 60;
                const showFull = expanded[key];
                const text = showFull || !long
                  ? r.message
                  : `${r.message.slice(0, 60)}...`;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-[var(--glass-border)]/40 last:border-b-0 ${
                      r.hidden ? "bg-yellow-400/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-mono text-[0.7rem] text-[var(--color-text-soft)] whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-primary)] text-xs">
                      {r.user_id ? (userMap[r.user_id] ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-soft)] max-w-[40ch]">
                      <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
                      {long ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((p) => ({ ...p, [key]: !p[key] }))
                          }
                          className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-accent-cyan)] hover:underline"
                        >
                          {showFull ? "less" : "more"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {r.hidden ? (
                        <span className="inline-flex items-center gap-1 text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded text-yellow-400 bg-yellow-400/10">
                          <EyeOff size={10} /> Hidden
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded text-green-400 bg-green-400/10">
                          <Eye size={10} /> Visible
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => toggleHidden(r.id, r.hidden)}
                        className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-accent-cyan)] hover:underline disabled:opacity-40"
                      >
                        {r.hidden ? "Unhide" : "Hide"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
          Page {page + 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-[0.65rem] uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-3 py-1.5 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-[0.65rem] uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
