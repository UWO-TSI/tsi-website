"use client";

// ─── NPC Conversation Moderation (D6) ──────────────────────────────────────
// T1/T2 moderation queue. Defaults to flagged-only since this is the review
// surface; can toggle off to browse all transcripts. Pagination 25/page,
// filters by NPC + user search + date range. Per-row: resolve, wipe memory.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Flag } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 25;

interface ConvRow {
  id: string;
  npc_id: string | null;
  user_id: string | null;
  user_message: string;
  npc_response: string;
  flagged: boolean;
  created_at: string;
}

interface NPCOption {
  id: string;
  display_name: string;
}

export default function AdminNPCConversationsPage() {
  const { profile, loading } = useUser();
  const [rows, setRows] = useState<ConvRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [npcOptions, setNpcOptions] = useState<NPCOption[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [npcMap, setNpcMap] = useState<Record<string, string>>({});

  const [npcFilter, setNpcFilter] = useState<string>("all");
  const [userQuery, setUserQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(true);

  // Load NPC dropdown options once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("npc_personas")
          .select("id, display_name")
          .eq("active", true)
          .order("display_name");
        if (cancelled || !data) return;
        setNpcOptions(data as unknown as NPCOption[]);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const supabase = createClient();

      // Resolve user_id filter from display_name query (loose match).
      let userIdMatches: string[] | null = null;
      if (userQuery.trim()) {
        const { data: matches } = await supabase
          .from("profiles")
          .select("id")
          .ilike("display_name", `%${userQuery.trim()}%`)
          .limit(100);
        userIdMatches =
          (matches ?? []).map((m) => (m as { id: string }).id);
        if (userIdMatches.length === 0) {
          setRows([]);
          setHasMore(false);
          return;
        }
      }

      let query = supabase
        .from("npc_conversations")
        .select(
          "id, npc_id, user_id, user_message, npc_response, flagged, created_at",
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      if (flaggedOnly) query = query.eq("flagged", true);
      if (npcFilter !== "all") query = query.eq("npc_id", npcFilter);
      if (userIdMatches) query = query.in("user_id", userIdMatches);
      if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error || !data) {
        setFetchError(error?.message ?? "Failed to load conversations");
        setRows([]);
        setHasMore(false);
        return;
      }
      const list = data as unknown as ConvRow[];
      const more = list.length > PAGE_SIZE;
      const pageRows = more ? list.slice(0, PAGE_SIZE) : list;
      setRows(pageRows);
      setHasMore(more);

      // Hydrate user + NPC names for this page.
      const userIds = Array.from(
        new Set(pageRows.map((r) => r.user_id).filter(Boolean)),
      ) as string[];
      const npcIds = Array.from(
        new Set(pageRows.map((r) => r.npc_id).filter(Boolean)),
      ) as string[];
      const [{ data: users }, { data: npcs }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, display_name").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
        npcIds.length
          ? supabase.from("npc_personas").select("id, display_name").in("id", npcIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      ]);
      setUserMap((prev) => {
        const next = { ...prev };
        for (const u of users ?? []) {
          const row = u as { id: string; display_name: string | null };
          next[row.id] = row.display_name ?? "unknown";
        }
        return next;
      });
      setNpcMap((prev) => {
        const next = { ...prev };
        for (const n of npcs ?? []) {
          const row = n as { id: string; display_name: string | null };
          next[row.id] = row.display_name ?? "unknown";
        }
        return next;
      });
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load conversations",
      );
      setRows([]);
      setHasMore(false);
    }
  }, [page, npcFilter, userQuery, dateFrom, dateTo, flaggedOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resolveRow = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/npc/conversations/${id}/resolve`, {
        method: "POST",
      });
      if (res.ok) {
        setRows((prev) =>
          (prev ?? []).map((r) => (r.id === id ? { ...r, flagged: false } : r)),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const wipeMemory = async (npcId: string | null, userId: string | null) => {
    if (!npcId || !userId) return;
    if (
      !confirm(
        "Wipe this user's memory of this NPC? They will greet each other as strangers next time. This cannot be undone.",
      )
    )
      return;
    setBusyId(`${npcId}:${userId}`);
    try {
      await fetch("/api/npc/memories/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc_id: npcId, user_id: userId }),
      });
    } finally {
      setBusyId(null);
    }
  };

  const tier = profile?.tier ?? 5;

  const filtersActive = useMemo(
    () =>
      npcFilter !== "all" ||
      userQuery !== "" ||
      dateFrom !== "" ||
      dateTo !== "" ||
      flaggedOnly !== true,
    [npcFilter, userQuery, dateFrom, dateTo, flaggedOnly],
  );

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
          NPC Conversation Moderation
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Review flagged NPC conversations; resolve, wipe memory, or delete.
        </p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <FilterField label="NPC">
            <select
              value={npcFilter}
              onChange={(e) => {
                setNpcFilter(e.target.value);
                setPage(0);
              }}
              className={inputCls}
            >
              <option value="all">All NPCs</option>
              {npcOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.display_name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="User name">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setPage(0);
              }}
              placeholder="display_name..."
              className={inputCls}
            />
          </FilterField>
          <FilterField label="From">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              className={inputCls}
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className={inputCls}
            />
          </FilterField>
          <FilterField label="Flagged only">
            <label className="inline-flex items-center gap-2 h-[38px]">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => {
                  setFlaggedOnly(e.target.checked);
                  setPage(0);
                }}
                className="w-4 h-4"
              />
              <span className="text-xs font-mono text-[var(--color-text-soft)]">
                Show flagged only
              </span>
            </label>
          </FilterField>
        </div>
        {filtersActive ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setNpcFilter("all");
                setUserQuery("");
                setDateFrom("");
                setDateTo("");
                setFlaggedOnly(true);
                setPage(0);
              }}
              className="text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors"
            >
              Reset filters
            </button>
          </div>
        ) : null}
      </div>

      {fetchError ? (
        <p className="mb-4 p-3 rounded-md text-xs font-mono border bg-red-400/10 border-red-400/30 text-red-400">
          {fetchError}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading conversations...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No conversations match the current filters.
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <Th>Time</Th>
                <Th>User</Th>
                <Th>NPC</Th>
                <Th>User message</Th>
                <Th>NPC response</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const userKey = `${r.id}:u`;
                const npcKey = `${r.id}:n`;
                const userLong = r.user_message.length > 60;
                const npcLong = r.npc_response.length > 60;
                const showUserFull = expanded[userKey];
                const showNpcFull = expanded[npcKey];
                const userText = showUserFull || !userLong
                  ? r.user_message
                  : `${r.user_message.slice(0, 60)}...`;
                const npcText = showNpcFull || !npcLong
                  ? r.npc_response
                  : `${r.npc_response.slice(0, 60)}...`;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-[var(--glass-border)]/40 last:border-b-0 ${
                      r.flagged ? "bg-red-400/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-mono text-[0.7rem] text-[var(--color-text-soft)] whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-primary)] text-xs">
                      {r.user_id ? (userMap[r.user_id] ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-primary)] text-xs">
                      {r.npc_id ? (npcMap[r.npc_id] ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-soft)] max-w-[20ch]">
                      <span>{userText}</span>
                      {userLong ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((p) => ({
                              ...p,
                              [userKey]: !p[userKey],
                            }))
                          }
                          className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-accent-cyan)] hover:underline"
                        >
                          {showUserFull ? "less" : "more"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-soft)] max-w-[20ch]">
                      <span>{npcText}</span>
                      {npcLong ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((p) => ({
                              ...p,
                              [npcKey]: !p[npcKey],
                            }))
                          }
                          className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-accent-cyan)] hover:underline"
                        >
                          {showNpcFull ? "less" : "more"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {r.flagged ? (
                        <span className="inline-flex items-center gap-1 text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded text-red-400 bg-red-400/10">
                          <Flag size={10} /> Flagged
                        </span>
                      ) : (
                        <span className="text-[0.6rem] font-mono uppercase text-[var(--color-text-muted)]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1.5 items-start">
                        {r.flagged ? (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => resolveRow(r.id)}
                            className="text-[0.6rem] font-mono uppercase tracking-wider text-green-400 hover:underline disabled:opacity-40"
                          >
                            Mark Resolved
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={
                            busyId === `${r.npc_id}:${r.user_id}` ||
                            !r.npc_id ||
                            !r.user_id
                          }
                          onClick={() => wipeMemory(r.npc_id, r.user_id)}
                          className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-accent-cyan)] hover:underline disabled:opacity-40"
                        >
                          Wipe Memory
                        </button>
                      </div>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent-cyan)] transition-colors";

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {children}
    </div>
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
