"use client";

// ─── Content Activity Log ───────────────────────────────────────────────────
// Chronological table of content_versions rows (publish events) with filters
// for table, author, and date range. 20 per page.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileClock } from "lucide-react";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import NameReportsPanel from "@/components/portal/NameReportsPanel";
import { CONTENT_ROUTES, type VersionedTable } from "@/lib/content/types";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Select } from "@/components/gui";

const PAGE_SIZE = 20;
const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
type TableFilter = "all" | VersionedTable;
/** What each versioned table holds, in the words the admin pages use. */
const TABLE_NAMES: Record<string, string> = {
  npc_personas: "Residents",
  shop_items: "Shop items",
  seasonal_palettes: "Seasonal palettes",
  quest_chapters: "Main quest",
  club_goals: "Club goals",
  crafting_recipes: "Recipes",
};
const TABLE_OPTIONS: { value: TableFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  ...(Object.keys(CONTENT_ROUTES) as VersionedTable[]).map((t) => ({ value: t, label: TABLE_NAMES[t] ?? t })),
];

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
    setFetchError(null);
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

  const filtersActive = useMemo(
    () =>
      tableFilter !== "all" ||
      authorFilter !== "all" ||
      dateFrom !== "" ||
      dateTo !== "",
    [tableFilter, authorFilter, dateFrom, dateTo],
  );

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link
          href="/student/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to admin
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
            Content activity
          </h1>
          <p className="mt-1 text-sm text-[var(--gui-muted)]">
            Everything admins have published: residents, shop items, palettes, chapters, goals and recipes.
          </p>
        </div>

        <NameReportsPanel />

        <Card className="mb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Area">
              <Select
                className="w-full"
                value={tableFilter}
                onChange={(e) => {
                  setTableFilter(e.target.value as TableFilter);
                  setPage(0);
                }}
              >
                {TABLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Published by">
              <Select
                className="w-full"
                value={authorFilter}
                onChange={(e) => {
                  setAuthorFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Anyone</option>
                {authorOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
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
              <Button size="sm" variant="quiet" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          ) : null}
        </Card>

        {fetchError ? (
          <ErrorNote className="mb-4" onRetry={() => void load()}>
            The activity didn’t load ({fetchError}).
          </ErrorNote>
        ) : null}

        {versions === null ? (
          <Loading label="Getting the activity…" />
        ) : versions.length === 0 ? (
          fetchError ? null : (
            <Empty icon={<FileClock size={32} />} title={filtersActive ? "Nothing matches these filters" : "Nothing published yet"}>
              {filtersActive ? "Try other dates, or reset the filters." : "Each publish from the content editors shows up here."}
            </Empty>
          )
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  <Th>When</Th>
                  <Th>Published by</Th>
                  <Th>Action</Th>
                  <Th>Area</Th>
                  <Th>Item</Th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => {
                  const rowLabel = rowDisplay(v);
                  const route = (CONTENT_ROUTES as Record<string, string>)[v.table_name];
                  const historyHref = route ? `${route}/${v.row_id}/history` : null;
                  return (
                    <tr
                      key={v.id}
                      className="border-t-2 border-dashed border-[var(--gui-paper-edge)]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink-2)]">
                        {formatDateTime(v.published_at)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--gui-ink)]">
                        {v.published_by
                          ? (authorMap[v.published_by] ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="success">Published</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                        {TABLE_NAMES[v.table_name] ?? v.table_name}
                      </td>
                      <td className="px-4 py-3">
                        {historyHref ? (
                          <Link
                            href={historyHref}
                            className="font-bold text-[var(--gui-sage)] hover:underline"
                          >
                            {rowLabel}
                          </Link>
                        ) : (
                          <span className="text-[var(--gui-ink-2)]">
                            {rowLabel}
                          </span>
                        )}
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
      </div>
    </AdminGate>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full min-h-11 rounded-[14px_12px_14px_13px] border-2 border-[var(--gui-paper-line)] bg-[var(--gui-paper-hi)] px-3 py-2 text-sm text-[var(--gui-ink)] focus:border-[var(--gui-sage)] transition-colors";

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]">
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
  // uuid rows shorten; text-keyed rows (recipes) are their own name.
  return /^[0-9a-f]{8}-/.test(v.row_id) ? v.row_id.slice(0, 8) : v.row_id;
}
