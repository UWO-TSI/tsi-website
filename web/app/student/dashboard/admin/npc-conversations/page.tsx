"use client";

// ─── NPC Conversation Moderation (D6) ──────────────────────────────────────
// T1/T2 moderation queue. Defaults to flagged-only since this is the review
// surface; can toggle off to browse all transcripts. Pagination 25/page,
// filters by NPC + user search + date range. Per-row: resolve, wipe memory.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, ArrowLeft, Flag, MessageSquare } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorNote, Loading, Select, Toggle } from "@/components/gui";

const PAGE_SIZE = 25;
const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

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
  const [wipeTarget, setWipeTarget] = useState<ConvRow | null>(null);

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

  // Asked first in the confirm dialog below (it can't be undone).
  const wipeMemory = async (npcId: string | null, userId: string | null) => {
    if (!npcId || !userId) return;
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
      <div className={PAGE}>
        <Loading label="Opening the chat log…" />
      </div>
    );
  }

  if (tier > 2) {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          Resident chats are only open to the club’s admins.
        </Empty>
      </div>
    );
  }

  const nameOf = (r: ConvRow) => ({
    npc: (r.npc_id && npcMap[r.npc_id]) || "This resident",
    user: (r.user_id && userMap[r.user_id]) || "this member",
  });

  return (
    <div className={PAGE}>
      <Link
        href="/student/dashboard/admin"
        className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to admin
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Resident chats</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">
          Chats between members and the island’s residents. Mark a flagged one resolved, or wipe what a resident remembers about someone.
        </p>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterField label="Resident">
            <Select
              className="w-full"
              value={npcFilter}
              onChange={(e) => {
                setNpcFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All residents</option>
              {npcOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.display_name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Member">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Part of their name"
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
          <Toggle
            checked={flaggedOnly}
            onChange={(on) => {
              setFlaggedOnly(on);
              setPage(0);
            }}
          >
            Flagged only
          </Toggle>
        </div>
        {filtersActive ? (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                setNpcFilter("all");
                setUserQuery("");
                setDateFrom("");
                setDateTo("");
                setFlaggedOnly(true);
                setPage(0);
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : null}
      </Card>

      {fetchError ? (
        <ErrorNote className="mb-4" onRetry={() => void load()}>
          The chats didn’t load ({fetchError}).
        </ErrorNote>
      ) : null}

      {rows === null ? (
        <Loading label="Getting the chats…" />
      ) : rows.length === 0 ? (
        fetchError ? null : (
          <Empty icon={<MessageSquare size={32} />} title={filtersActive ? "No chats match these filters" : "Nothing flagged right now"}>
            {filtersActive ? "Try other dates, or reset the filters." : "Flagged chats wait here for a look."}
          </Empty>
        )
      ) : (
        <Card style={{ padding: 0 }} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--gui-paper-warm)]">
                <Th>Time</Th>
                <Th>Member</Th>
                <Th>Resident</Th>
                <Th>Member said</Th>
                <Th>Resident replied</Th>
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
                  : `${r.user_message.slice(0, 60)}…`;
                const npcText = showNpcFull || !npcLong
                  ? r.npc_response
                  : `${r.npc_response.slice(0, 60)}…`;
                return (
                  <tr
                    key={r.id}
                    className={`border-t-2 border-dashed border-[var(--gui-paper-edge)] align-top ${
                      r.flagged ? "bg-[var(--gui-danger-soft)]" : ""
                    }`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-[var(--gui-ink-2)]">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-3 font-bold text-[var(--gui-ink)]">
                      {r.user_id ? (userMap[r.user_id] ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3 font-bold text-[var(--gui-ink)]">
                      {r.npc_id ? (npcMap[r.npc_id] ?? "—") : "—"}
                    </td>
                    <td className="max-w-[24ch] px-3 py-3 text-[var(--gui-ink)]">
                      <span>{userText}</span>
                      {userLong ? (
                        <button
                          type="button"
                          aria-expanded={!!showUserFull}
                          onClick={() =>
                            setExpanded((p) => ({
                              ...p,
                              [userKey]: !p[userKey],
                            }))
                          }
                          className="ml-2 font-bold text-[var(--gui-sage)] hover:underline"
                        >
                          {showUserFull ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </td>
                    <td className="max-w-[24ch] px-3 py-3 text-[var(--gui-ink)]">
                      <span>{npcText}</span>
                      {npcLong ? (
                        <button
                          type="button"
                          aria-expanded={!!showNpcFull}
                          onClick={() =>
                            setExpanded((p) => ({
                              ...p,
                              [npcKey]: !p[npcKey],
                            }))
                          }
                          className="ml-2 font-bold text-[var(--gui-sage)] hover:underline"
                        >
                          {showNpcFull ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {r.flagged ? (
                        <Badge tone="danger">
                          <Flag size={12} aria-hidden /> Flagged
                        </Badge>
                      ) : (
                        <span className="text-[var(--gui-ink-2)]">Not flagged</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {r.flagged ? (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => resolveRow(r.id)}
                            className="whitespace-nowrap font-bold text-[var(--gui-success)] hover:underline disabled:opacity-40 disabled:no-underline"
                          >
                            Mark resolved
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={
                            busyId === `${r.npc_id}:${r.user_id}` ||
                            !r.npc_id ||
                            !r.user_id
                          }
                          onClick={() => setWipeTarget(r)}
                          className="whitespace-nowrap font-bold text-[var(--gui-danger)] hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          Wipe memory
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--gui-muted)]">
          Page {page + 1}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={wipeTarget !== null}
        title="Wipe this memory?"
        confirmLabel="Wipe memory"
        cancelLabel="Keep it"
        danger
        onCancel={() => setWipeTarget(null)}
        onConfirm={() => {
          const target = wipeTarget;
          setWipeTarget(null);
          if (target) void wipeMemory(target.npc_id, target.user_id);
        }}
      >
        {wipeTarget && (
          <p>
            {nameOf(wipeTarget).npc} will forget everything about {nameOf(wipeTarget).user}. Next time they meet, they’ll greet each other as strangers. This can’t be undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full min-h-11 rounded-[14px_12px_14px_13px] border-2 border-[var(--gui-paper-line)] bg-[var(--gui-paper-hi)] px-3 py-2 text-sm text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)] focus:border-[var(--gui-sage)] transition-colors";

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]">
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
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-[var(--gui-ink-2)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
}
