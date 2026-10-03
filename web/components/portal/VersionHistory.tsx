"use client";

// ─── VersionHistory ─────────────────────────────────────────────────────────
// Shared component for /admin/content/{npcs|shop|palettes}/[id]/history pages.
// Lists the last 10 published versions of a row from `content_versions`, shows
// who/when, allows expanding the snapshot, and creates a new draft from any
// historical snapshot (rollback flow).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, History, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CONTENT_ROUTES, type VersionedTable } from "@/lib/content/types";
import { Amount } from "@/components/economy/Amount";
import { Button, Card, Empty, ErrorNote, Loading, Sheet } from "@/components/gui";
import { AdminMessage, backLinkCls } from "./ProgressionAdminShared";

type TableName = VersionedTable;

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
      router.push(`${CONTENT_ROUTES[tableName]}/${rowId}/edit`);
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
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`${CONTENT_ROUTES[tableName]}/${rowId}/edit`} className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden />
        Back to the editor
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          Version history: {displayName}
        </h1>
        <p className="text-sm text-[var(--gui-muted)] mt-1">
          The last 10 published versions. Restoring one makes a new draft from
          it, for you to check before you publish.
        </p>
      </div>

      <AdminMessage message={message} className="mb-4" />

      {error ? <ErrorNote className="mb-4">{error}</ErrorNote> : null}

      {versions === null ? (
        <Loading label="Loading the version history…" />
      ) : versions.length === 0 ? (
        error ? null : (
          <Empty icon={<History size={32} />} title="No versions yet">
            A version is kept here each time a draft is published over this one.
          </Empty>
        )
      ) : (
        <ol className="space-y-3">
          {versions.map((v) => {
            const isOpen = expanded.has(v.id);
            const author = v.published_by
              ? (authors[v.published_by] ?? "unknown")
              : "unknown";
            return (
              <Card as="li" key={v.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[15px] font-extrabold text-[var(--gui-ink-strong)]">
                      {formatRelative(v.published_at)}
                    </p>
                    <p className="text-[13px] text-[var(--gui-muted)] mt-0.5">
                      {formatWhen(v.published_at)} · by{" "}
                      <span className="font-bold text-[var(--gui-ink-2)]">
                        {author}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => toggleExpand(v.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronDown size={16} aria-hidden />
                      ) : (
                        <ChevronRight size={16} aria-hidden />
                      )}
                      {isOpen ? "Hide" : "Show"} snapshot
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmingId(v.id)}
                      disabled={restoring}
                    >
                      <RotateCcw size={16} aria-hidden /> Restore this version
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 pt-3 border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                    <SnapshotView
                      tableName={tableName}
                      data={v.snapshot_data}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </ol>
      )}

      <ConfirmModal
        open={confirmingId !== null}
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
    </div>
  );
}

// ─── SnapshotView ────────────────────────────────────────────────────────────

/** The seven original colours always; the island tints when the snapshot has them (older ones don't). */
const PALETTE_KEYS = [
  "sky",
  "grass",
  "accent",
  "fog",
  "water",
  "building_primary",
  "building_accent",
  "island_grass",
  "leaf",
];

function SnapshotView({
  tableName,
  data,
}: {
  tableName: TableName;
  data: Record<string, unknown>;
}) {
  if (tableName === "seasonal_palettes") {
    const palette = (data.palette ?? {}) as Record<string, string>;
    return (
      <dl className="space-y-2">
        <KV label="Display name" value={plain(data.display_name)} />
        <KV label="Slug" value={plain(data.slug)} />
        <KV label="Palette">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PALETTE_KEYS.filter((k, i) => i < 7 || k in palette).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="inline-block w-7 h-7 rounded-lg border-2 border-[var(--gui-paper-line)]"
                  style={{ backgroundColor: palette[k] ?? "#000" }}
                />
                <span className="text-[13px] text-[var(--gui-ink-2)]">
                  {humanize(k)}: {palette[k] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </KV>
        <KV label="Active" value={plain(data.active ?? false)} />
        <KV label="Starts" value={plain(data.scheduled_start)} />
        <KV label="Ends" value={plain(data.scheduled_end)} />
      </dl>
    );
  }

  if (tableName === "npc_personas") {
    const dialogue = Array.isArray(data.canned_dialogue)
      ? (data.canned_dialogue as unknown[]).map(String)
      : [];
    return (
      <dl className="space-y-2">
        <KV label="Slug" value={plain(data.slug)} />
        <KV label="Display name" value={plain(data.display_name)} />
        <KV label="Post" value={plain(data.post)} />
        <KV label="Tone" value={plain(data.tone)} />
        <KV label="Schedule" value={plain(data.schedule ?? {})} />
        <KV label="Bio" value={plain(data.bio)} multiline />
        <KV label="Spawn zone" value={plain(data.spawn_zone)} />
        <KV label="Permanent" value={plain(data.is_permanent ?? false)} />
        <KV label="Active" value={plain(data.active ?? false)} />
        <KV label="Sprite URL" value={plain(data.sprite_url)} />
        <KV label="Persona prompt" value={plain(data.persona_prompt)} multiline />
        <KV label={`Dialogue lines (${dialogue.length})`} multiline>
          {dialogue.length === 0 ? (
            "—"
          ) : (
            <ul className="space-y-1">
              {dialogue.map((line, i) => (
                <li
                  key={i}
                  className="pl-2.5 border-l-2 border-[var(--gui-paper-line)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </KV>
      </dl>
    );
  }

  if (tableName === "shop_items") {
    return (
      <dl className="space-y-2">
        <KV label="Slug" value={plain(data.slug)} />
        <KV label="Display name" value={plain(data.display_name)} />
        <KV label="Category" value={plain(data.category)} />
        <KV label="Rarity" value={plain(data.rarity)} />
        {typeof data.price_coins === "number" ? (
          <KV label="Price (TC)"><Amount n={data.price_coins} currency="coins" /></KV>
        ) : (
          <KV label="Price (Gems)">
            {typeof data.tc_price === "number" ? <Amount n={data.tc_price} currency="gems" /> : plain(data.tc_price)}
          </KV>
        )}
        <KV
          label="Stock"
          value={data.stock === null ? "Unlimited" : plain(data.stock)}
        />
        <KV label="Active" value={plain(data.active ?? false)} />
        <KV label="Sprite URL" value={plain(data.sprite_url)} />
        <KV label="Description" value={plain(data.description)} multiline />
        <KV label="Released" value={plain(data.released_at)} />
        <KV label="Retired" value={plain(data.retired_at)} />
      </dl>
    );
  }

  // Everything else: every column, in plain words.
  return (
    <dl className="space-y-2">
      {Object.entries(data).map(([key, v]) => {
        const amount = typeof v === "number" ? (GEM_COLUMN.test(key) ? "gems" : COIN_COLUMN.test(key) ? "coins" : null) : null;
        const text = amount ? "" : plain(v);
        return (
          <KV key={key} label={humanize(key)} value={text} multiline={!amount && text.length > 80}>
            {amount ? <Amount n={v as number} currency={amount} /> : undefined}
          </KV>
        );
      })}
    </dl>
  );
}

/** A labelled value in a snapshot; `children` for a value that isn't plain text. */
function KV({
  label,
  value,
  multiline,
  children,
}: {
  label: string;
  value?: string;
  multiline?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={multiline ? "" : "grid gap-x-4 gap-y-0.5 sm:grid-cols-[10rem_minmax(0,1fr)]"}>
      <dt className={`text-[13px] font-extrabold text-[var(--gui-ink-2)] ${multiline ? "mb-1" : "pt-px"}`}>
        {label}
      </dt>
      <dd
        className={`text-sm text-[var(--gui-ink)] ${
          multiline ? "whitespace-pre-wrap" : "break-words min-w-0"
        }`}
      >
        {children ?? value}
      </dd>
    </div>
  );
}

// ─── ConfirmModal ────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  versionPublishedAt,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  versionPublishedAt: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onCancel}
      title="Restore this version?"
      icon={<RotateCcw size={20} />}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? "Restoring…" : "Restore"}
          </Button>
        </>
      }
    >
      {open ? (
        <p className="text-[var(--gui-ink-2)]">
          This makes a new draft from the version published{" "}
          {formatRelative(versionPublishedAt)}. You can check it before you
          publish.
        </p>
      ) : null}
    </Sheet>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Gems live in the legacy tc_* columns (lib/economy.ts); play coins in *_coins. */
const GEM_COLUMN = /^tc_|_tc$/;
const COIN_COLUMN = /coins/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "building_primary" → "Building primary". */
function humanize(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A snapshot value in plain words: Yes/No, dates in Toronto time, lists and small objects inline. */
function plain(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") return ISO_TIME.test(v) ? formatWhen(v) : v;
  if (Array.isArray(v)) return v.length ? v.map(plain).join(", ") : "—";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.length ? entries.map(([k, x]) => `${k}: ${plain(x)}`).join(" · ") : "—";
  }
  return String(v);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

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
