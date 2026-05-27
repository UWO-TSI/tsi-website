"use client";

// ─── Content Activity Log ───────────────────────────────────────────────────
// Chronological table of content_versions rows (publish events) with filters
// for table, author, and date range. 20 per page.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 20;
const TABLE_OPTIONS = [
  { value: "all", label: "All tables" },
  { value: "npc_personas", label: "npc_personas" },
  { value: "shop_items", label: "shop_items" },
  { value: "seasonal_palettes", label: "seasonal_palettes" },
] as const;

type TableFilter = (typeof TABLE_OPTIONS)[number]["value"];

const HISTORY_ROUTE: Record<string, string> = {
  npc_personas: "/student/dashboard/admin/content/npcs",
  shop_items: "/student/dashboard/admin/content/shop",
  seasonal_palettes: "/student/dashboard/admin/content/palettes",
};

interface VersionEntry {
  id: string;
  table_name: string;
  row_id: string;
  published_at: string;
  published_by: string | null;
  snapshot_data: Record<string, unknown>;
}

interface AuthorOption {
  id: string;
  name: string;
}

export default function AdminContentLogPage() {
  const { profile, loading } = useUser();
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});
  const [authorOptions, setAuthorOptions] = useState<AuthorOption[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [tableFilter, setTableFilter] = useState<TableFilter>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      let query = supabase
        .from("content_versions")
        .select(
          "id, table_name, row_id, published_at, published_by, snapshot_data",
        )
        .order("published_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (authorFilter !== "all") {
        query = query.eq("published_by", authorFilter);
      }
      if (dateFrom) {
        query = query.gte("published_at", new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("published_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error || !data) {
        setFetchError(error?.message ?? "Failed to load activity");
        setVersions([]);
        setHasMore(false);
        return;
      }

      const rows = data as unknown as VersionEntry[];
      // We fetched PAGE_SIZE + 1 to detect "more"
      const more = rows.length > PAGE_SIZE;
      const pageRows = more ? rows.slice(0, PAGE_SIZE) : rows;
      setVersions(pageRows);
      setHasMore(more);

      // Hydrate author names for this page
      const authorIds = Array.from(
        new Set(pageRows.map((r) => r.published_by).filter(Boolean)),
      ) as string[];
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", authorIds);
        setAuthorMap((prev) => {
          const next = { ...prev };
          for (const p of profiles ?? []) {
            if (p && typeof p === "object" && "id" in p) {
              next[(p as { id: string }).id] =
                ((p as { display_name: string | null }).display_name) ??
                "unknown";
            }
          }
          return next;
        });
      }
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load activity",
      );
      setVersions([]);
      setHasMore(false);
    }
  }, [page, tableFilter, authorFilter, dateFrom, dateTo]);

  // Load distinct authors once for the dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("content_versions")
          .select("published_by")
          .not("published_by", "is", null)
          .limit(500);
        if (cancelled || !data) return;
        const ids = Array.from(
          new Set(
            (data as { published_by: string | null }[])
              .map((r) => r.published_by)
              .filter(Boolean) as string[],
          ),
        );
        if (ids.length === 0) {
          setAuthorOptions([]);
          return;
        }
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        if (cancelled) return;
        const opts: AuthorOption[] = (profiles ?? [])
          .map((p) => {
            if (!p || typeof p !== "object" || !("id" in p)) return null;
            return {
              id: (p as { id: string }).id,
              name:
                ((p as { display_name: string | null }).display_name) ??
                "unknown",
            };
          })
          .filter((x): x is AuthorOption => x !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
        setAuthorOptions(opts);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetFilters = () => {
    setTableFilter("all");
    setAuthorFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const tier = profile?.tier ?? 5;
  const filtersActive = useMemo(
    () =>
      tableFilter !== "all" ||
      authorFilter !== "all" ||
      dateFrom !== "" ||
      dateTo !== "",
    [tableFilter, authorFilter, dateFrom, dateTo],
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

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Content Activity Log
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          All admin publish events across NPCs, shop, and palettes.
        </p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterField label="Table">
            <select
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value as TableFilter);
                setPage(0);
              }}
              className={inputCls}
            >
              {TABLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Author">
            <select
              value={authorFilter}
              onChange={(e) => {
                setAuthorFilter(e.target.value);
                setPage(0);
              }}
              className={inputCls}
            >
              <option value="all">All authors</option>
              {authorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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
        </div>
        {filtersActive ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
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

      {versions === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading activity...
        </p>
      ) : versions.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No activity matches the current filters.
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <Th>Time</Th>
                <Th>Author</Th>
                <Th>Action</Th>
                <Th>Table</Th>
                <Th>Row</Th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const rowLabel = rowDisplay(v);
                const historyHref = HISTORY_ROUTE[v.table_name]
                  ? `${HISTORY_ROUTE[v.table_name]}/${v.row_id}/history`
                  : null;
                return (
                  <tr
                    key={v.id}
                    className="border-b border-[var(--glass-border)]/40 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-soft)]">
                      {formatDateTime(v.published_at)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {v.published_by
                        ? (authorMap[v.published_by] ?? "—")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded text-green-400 bg-green-400/10">
                        Published
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                      {v.table_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {historyHref ? (
                        <Link
                          href={historyHref}
                          className="text-[var(--color-accent-cyan)] hover:underline"
                        >
                          {rowLabel}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">
                          {rowLabel}
                        </span>
                      )}
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
    <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
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

function rowDisplay(v: {
  snapshot_data: Record<string, unknown>;
  row_id: string;
}): string {
  const slug = typeof v.snapshot_data?.slug === "string" ? v.snapshot_data.slug : null;
  if (slug) return slug;
  const name =
    typeof v.snapshot_data?.display_name === "string"
      ? (v.snapshot_data.display_name as string)
      : null;
  if (name) return name;
  return v.row_id.slice(0, 8);
}
