"use client";

// ─── VersionHistory ─────────────────────────────────────────────────────────
// Shared component for /admin/content/{npcs|shop|palettes}/[id]/history pages.
// Lists the last 10 published versions of a row from `content_versions`, shows
// who/when, allows expanding the snapshot, and creates a new draft from any
// historical snapshot (rollback flow).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TableName = "npc_personas" | "shop_items" | "seasonal_palettes";

interface VersionRow {
  id: string;
  table_name: string;
  row_id: string;
  snapshot_data: Record<string, unknown>;
  published_by: string | null;
  published_at: string;
}

interface AuthorMap {
  [userId: string]: string;
}

interface VersionHistoryProps {
  tableName: TableName;
  rowId: string;
  displayName: string;
}

const EDITOR_ROUTE: Record<TableName, string> = {
  npc_personas: "/student/dashboard/admin/content/npcs",
  shop_items: "/student/dashboard/admin/content/shop",
  seasonal_palettes: "/student/dashboard/admin/content/palettes",
};

export default function VersionHistory({
  tableName,
  rowId,
  displayName,
}: VersionHistoryProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from("content_versions")
        .select(
          "id, table_name, row_id, snapshot_data, published_by, published_at",
        )
        .eq("table_name", tableName)
        .eq("row_id", rowId)
        .order("published_at", { ascending: false })
        .limit(10);

      if (fetchErr || !data) {
        setError(fetchErr?.message ?? "Failed to load versions");
        setVersions([]);
        return;
      }

      const rows = data as unknown as VersionRow[];
      setVersions(rows);

      const ids = Array.from(
        new Set(rows.map((r) => r.published_by).filter(Boolean)),
      ) as string[];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        const map: AuthorMap = {};
        for (const p of profiles ?? []) {
          if (p && typeof p === "object" && "id" in p && "display_name" in p) {
            map[(p as { id: string }).id] =
              (p as { display_name: string | null }).display_name ?? "unknown";
          }
        }
        setAuthors(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
      setVersions([]);
    }
  }, [tableName, rowId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRestore = async (version: VersionRow) => {
    if (restoring) return;
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/content/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_name: tableName,
          row_id: rowId,
          draft_data: version.snapshot_data,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMessage({ kind: "err", text: body.error ?? "Restore failed" });
        setConfirmingId(null);
        return;
      }
      router.push(`${EDITOR_ROUTE[tableName]}/${rowId}/edit`);
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Restore failed",
      });
      setConfirmingId(null);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <Link
          href={`${EDITOR_ROUTE[tableName]}/${rowId}/edit`}
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to editor
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Version History — {displayName}
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Last 10 published versions. Restore to create a new draft from any
          snapshot.
        </p>
      </div>

      {message ? (
        <div
          className={`mb-4 p-3 rounded-md text-xs font-mono border ${
            message.kind === "ok"
              ? "bg-green-400/10 border-green-400/30 text-green-400"
              : "bg-red-400/10 border-red-400/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {error ? (
        <p className="font-mono text-sm text-red-400 mb-4">{error}</p>
      ) : null}

      {versions === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading versions...
        </p>
      ) : versions.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No version history yet. Snapshots are created when a draft is
          published over this row.
        </p>
      ) : (
        <ol className="space-y-3">
          {versions.map((v) => {
            const isOpen = expanded.has(v.id);
            const author = v.published_by
              ? (authors[v.published_by] ?? "unknown")
              : "unknown";
            return (
              <li
                key={v.id}
                className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-mono text-[var(--color-text-primary)]">
                      {formatRelative(v.published_at)}
                    </p>
                    <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] mt-0.5">
                      {new Date(v.published_at).toLocaleString()} · by{" "}
                      <span className="text-[var(--color-text-soft)]">
                        {author}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(v.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-[0.65rem] uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      {isOpen ? "Hide" : "Show"} snapshot
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(v.id)}
                      disabled={restoring}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-[0.65rem] uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      <RotateCcw size={12} /> Restore this version
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)]/40">
                    <SnapshotView
                      tableName={tableName}
                      data={v.snapshot_data}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {confirmingId ? (
        <ConfirmModal
          versionPublishedAt={
            versions?.find((v) => v.id === confirmingId)?.published_at ?? ""
          }
          busy={restoring}
          onCancel={() => setConfirmingId(null)}
          onConfirm={() => {
            const v = versions?.find((x) => x.id === confirmingId);
            if (v) handleRestore(v);
          }}
        />
      ) : null}
    </div>
  );
}

// ─── SnapshotView ────────────────────────────────────────────────────────────

function SnapshotView({
  tableName,
  data,
}: {
  tableName: TableName;
  data: Record<string, unknown>;
}) {
  if (tableName === "seasonal_palettes") {
    const palette = (data.palette ?? {}) as Record<string, string>;
    const swatchKeys = [
      "sky",
      "grass",
      "accent",
      "fog",
      "water",
      "building_primary",
      "building_accent",
    ];
    return (
      <div className="space-y-3">
        <KV label="display_name" value={String(data.display_name ?? "—")} />
        <KV label="slug" value={String(data.slug ?? "—")} />
        <div>
          <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            palette
          </p>
          <div className="flex flex-wrap gap-2">
            {swatchKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="inline-block w-6 h-6 rounded border border-[var(--glass-border)]"
                  style={{ backgroundColor: palette[k] ?? "#000" }}
                />
                <span className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                  {k}: {palette[k] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <KV label="active" value={String(data.active ?? false)} />
        <KV
          label="scheduled_start"
          value={data.scheduled_start ? String(data.scheduled_start) : "—"}
        />
        <KV
          label="scheduled_end"
          value={data.scheduled_end ? String(data.scheduled_end) : "—"}
        />
      </div>
    );
  }

  if (tableName === "npc_personas") {
    const dialogue = Array.isArray(data.canned_dialogue)
      ? (data.canned_dialogue as unknown[]).map(String)
      : [];
    return (
      <div className="space-y-2">
        <KV label="slug" value={String(data.slug ?? "—")} />
        <KV label="display_name" value={String(data.display_name ?? "—")} />
        <KV label="spawn_zone" value={String(data.spawn_zone ?? "—")} />
        <KV label="is_permanent" value={String(data.is_permanent ?? false)} />
        <KV label="active" value={String(data.active ?? false)} />
        <KV
          label="sprite_url"
          value={data.sprite_url ? String(data.sprite_url) : "—"}
        />
        <KV
          label="persona_prompt"
          value={data.persona_prompt ? String(data.persona_prompt) : "—"}
          multiline
        />
        <div>
          <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            canned_dialogue ({dialogue.length})
          </p>
          {dialogue.length === 0 ? (
            <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]/60">
              —
            </p>
          ) : (
            <ul className="space-y-1">
              {dialogue.map((line, i) => (
                <li
                  key={i}
                  className="text-[0.7rem] font-mono text-[var(--color-text-soft)] pl-2 border-l border-[var(--glass-border)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (tableName === "shop_items") {
    return (
      <div className="space-y-2">
        <KV label="slug" value={String(data.slug ?? "—")} />
        <KV label="display_name" value={String(data.display_name ?? "—")} />
        <KV label="category" value={String(data.category ?? "—")} />
        <KV label="rarity" value={String(data.rarity ?? "—")} />
        <KV label="tc_price" value={String(data.tc_price ?? "—")} />
        <KV
          label="stock"
          value={data.stock === null ? "unlimited" : String(data.stock ?? "—")}
        />
        <KV label="active" value={String(data.active ?? false)} />
        <KV
          label="sprite_url"
          value={data.sprite_url ? String(data.sprite_url) : "—"}
        />
        <KV
          label="description"
          value={data.description ? String(data.description) : "—"}
          multiline
        />
        <KV
          label="released_at"
          value={data.released_at ? String(data.released_at) : "—"}
        />
        <KV
          label="retired_at"
          value={data.retired_at ? String(data.retired_at) : "—"}
        />
      </div>
    );
  }

  // Fallback: raw JSON
  return (
    <pre className="text-[0.65rem] font-mono text-[var(--color-text-soft)] whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function KV({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "" : "flex items-start gap-3"}>
      <p
        className={`text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] ${
          multiline ? "mb-1" : "min-w-[8rem] pt-0.5"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-[0.7rem] font-mono text-[var(--color-text-soft)] ${
          multiline ? "whitespace-pre-wrap" : "flex-1 break-all"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── ConfirmModal ────────────────────────────────────────────────────────────

function ConfirmModal({
  versionPublishedAt,
  busy,
  onCancel,
  onConfirm,
}: {
  versionPublishedAt: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
          Restore this version?
        </h2>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mb-5">
          Restore to version published {formatRelative(versionPublishedAt)}?
          This will create a new draft you can review before publishing.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-xs uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {busy ? "Restoring..." : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
}
