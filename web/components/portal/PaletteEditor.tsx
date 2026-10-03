"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SeasonalPalette, PaletteColors } from "@/lib/content/types";

// ─── PaletteEditor ──────────────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Mirrors NPCEditor /
// ShopEditor: renders all seasonal_palette fields, validates client-side,
// then drives the B3 draft/publish API.
//
// `mode = "new"` — slug uniqueness enforced; row_id sent as null.
// `mode = "edit"` — initial row + id loaded by the page wrapper; slug
//                   uniqueness skips the current slug.
//
// The `palette` column is JSONB on Supabase, so the draft_data payload nests
// the 7 hex strings under a `palette` key.

const SLUG_REGEX = /^[a-z0-9-]+$/;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const COLOR_KEYS: (keyof PaletteColors)[] = [
  "sky",
  "grass",
  "accent",
  "fog",
  "water",
  "building_primary",
  "building_accent",
  // Member island seasonal tints (ground over grass texture, oak foliage).
  "island_grass",
  "leaf",
];

const DEFAULT_COLORS: PaletteColors = {
  sky: "#BFE6F0",
  grass: "#7CB342",
  accent: "#FFD166",
  fog: "#B0C4DE",
  water: "#4A90D9",
  building_primary: "#D4A574",
  building_accent: "#8B6F4E",
  island_grass: "#91B47F",
  leaf: "#9BC87E",
};

interface FormState {
  slug: string;
  display_name: string;
  colors: PaletteColors;
  scheduled_start: string;
  scheduled_end: string;
}

interface PaletteEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<SeasonalPalette> | null;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDatetime(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toFormState(row: Partial<SeasonalPalette> | null | undefined): FormState {
  if (!row) {
    return {
      slug: "",
      display_name: "",
      colors: { ...DEFAULT_COLORS },
      scheduled_start: "",
      scheduled_end: "",
    };
  }
  const palette = (row.palette ?? {}) as Partial<PaletteColors>;
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    colors: {
      sky: palette.sky ?? DEFAULT_COLORS.sky,
      grass: palette.grass ?? DEFAULT_COLORS.grass,
      accent: palette.accent ?? DEFAULT_COLORS.accent,
      fog: palette.fog ?? DEFAULT_COLORS.fog,
      water: palette.water ?? DEFAULT_COLORS.water,
      building_primary:
        palette.building_primary ?? DEFAULT_COLORS.building_primary,
      building_accent:
        palette.building_accent ?? DEFAULT_COLORS.building_accent,
      island_grass: palette.island_grass ?? DEFAULT_COLORS.island_grass,
      leaf: palette.leaf ?? DEFAULT_COLORS.leaf,
    },
    scheduled_start: toLocalDatetime(row.scheduled_start ?? null),
    scheduled_end: toLocalDatetime(row.scheduled_end ?? null),
  };
}

export default function PaletteEditor({
  mode,
  rowId,
  initial,
}: PaletteEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  // Load existing slugs once (live table + outstanding drafts). Skip own slug
  // in edit mode so user can save without bumping the slug each time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: rows }, { data: drafts }] = await Promise.all([
          supabase.from("seasonal_palettes").select("slug, id"),
          supabase
            .from("content_drafts")
            .select("draft_data, row_id")
            .eq("table_name", "seasonal_palettes")
            .eq("status", "draft"),
        ]);
        if (cancelled) return;
        const slugs = new Set<string>();
        for (const r of rows ?? []) {
          if (mode === "edit" && rowId === r.id) continue;
          if (r.slug) slugs.add(r.slug);
        }
        for (const d of drafts ?? []) {
          const data = d.draft_data as { slug?: string } | null;
          if (!data?.slug) continue;
          if (mode === "edit" && d.row_id === rowId) continue;
          slugs.add(data.slug);
        }
        setExistingSlugs(slugs);
      } catch {
        // Silent — uniqueness check will fall back to server.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, rowId]);

  const errors = useMemo(() => validate(form, existingSlugs), [form, existingSlugs]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateColor = (key: keyof PaletteColors, value: string) => {
    setForm((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const handleSaveDraft = async () => {
    if (hasErrors || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const payload = {
        table_name: "seasonal_palettes",
        row_id: mode === "edit" ? rowId : null,
        draft_data: {
          slug: form.slug.trim(),
          display_name: form.display_name.trim(),
          palette: { ...form.colors },
          scheduled_start: fromLocalDatetime(form.scheduled_start),
          scheduled_end: fromLocalDatetime(form.scheduled_end),
        },
      };
      const res = await fetch("/api/content/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMessage({ kind: "err", text: body.error ?? "Save failed" });
        return;
      }
      setDraftId(body.draft.id as string);
      setMessage({ kind: "ok", text: "Draft saved." });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    if (!draftId || busy) return;
    setBusy("publish");
    setMessage(null);
    try {
      const res = await fetch(`/api/content/drafts/${draftId}/publish`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMessage({ kind: "err", text: body.error ?? "Publish failed" });
        return;
      }
      router.push("/student/dashboard/admin/content/palettes");
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Publish failed",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    if (!draftId || busy) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Discard this draft? Unsaved changes will be lost.",
      );
      if (!ok) return;
    }
    setBusy("discard");
    setMessage(null);
    try {
      const res = await fetch(`/api/content/drafts/${draftId}/discard`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMessage({ kind: "err", text: body.error ?? "Discard failed" });
        return;
      }
      setDraftId(null);
      setMessage({ kind: "ok", text: "Draft discarded." });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Discard failed",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin/content/palettes"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Palettes
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new"
            ? "New Palette"
            : `Edit: ${initial?.display_name ?? "Palette"}`}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Drafts stay invisible to members until published.
        </p>
      </div>

      {message ? (
        <div
          className={`mb-4 p-3 rounded-md text-xs border ${
            message.kind === "ok"
              ? "bg-[var(--gui-success-soft)] border-[var(--gui-success)]/30 text-[var(--gui-success)]"
              : "bg-[var(--gui-danger-soft)] border-[var(--gui-danger)]/30 text-[var(--gui-danger)]"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <Field
          label="Slug"
          hint="kebab-case identifier, e.g. autumn-2026"
          error={errors.slug}
        >
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputCls}
            placeholder="autumn-2026"
            spellCheck={false}
          />
        </Field>

        <Field label="Display Name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Autumn 2026"
          />
        </Field>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Colors
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COLOR_KEYS.map((key) => (
              <ColorRow
                key={key}
                label={key}
                value={form.colors[key] ?? ""}
                onChange={(v) => updateColor(key, v)}
              />
            ))}
          </div>
          {errors.colors ? (
            <p className="mt-2 text-xs text-[var(--gui-danger)]">
              {errors.colors}
            </p>
          ) : null}

          {/* Swatch row preview */}
          <div className="mt-4 p-3 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Preview
            </p>
            <div className="flex flex-wrap gap-3">
              {COLOR_KEYS.map((key) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 h-6 rounded border border-[var(--glass-border)]"
                    style={{ backgroundColor: form.colors[key] }}
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Field
          label="Scheduled Start"
          hint="Optional. Informational — activation is manual via the listing."
        >
          <input
            type="datetime-local"
            value={form.scheduled_start}
            onChange={(e) => update("scheduled_start", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Scheduled End"
          hint="Optional. Must be after Scheduled Start if both are set."
          error={errors.scheduled_end}
        >
          <input
            type="datetime-local"
            value={form.scheduled_end}
            onChange={(e) => update("scheduled_end", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={hasErrors || busy !== null}
          className={primaryBtnCls}
        >
          {busy === "save" ? "Saving..." : "Save as draft"}
        </button>

        {draftId ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={busy !== null}
            className={publishBtnCls}
          >
            {busy === "publish" ? "Publishing..." : "Publish"}
          </button>
        ) : null}

        {draftId ? (
          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy !== null}
            className={dangerBtnCls}
          >
            {busy === "discard" ? "Discarding..." : "Discard draft"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validate(
  form: FormState,
  existingSlugs: Set<string>,
): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  const slug = form.slug.trim();
  if (!slug) {
    errors.slug = "Slug is required";
  } else if (!SLUG_REGEX.test(slug)) {
    errors.slug = "Use lowercase letters, numbers, and dashes only";
  } else if (existingSlugs.has(slug)) {
    errors.slug = "Slug already in use";
  }

  const name = form.display_name.trim();
  if (!name) {
    errors.display_name = "Display name is required";
  } else if (name.length > 80) {
    errors.display_name = "Keep under 80 characters";
  }

  for (const key of COLOR_KEYS) {
    if (!HEX_REGEX.test(form.colors[key] ?? "")) {
      errors.colors = `Invalid hex for ${key}`;
      break;
    }
  }

  if (form.scheduled_start && form.scheduled_end) {
    const start = new Date(form.scheduled_start).getTime();
    const end = new Date(form.scheduled_end).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      errors.scheduled_end = "End must be after start";
    }
  }

  return errors;
}

// ─── Sub-components / classes ───────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-cyan)] transition-colors";

const primaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";

const publishBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";

const dangerBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 border border-[var(--gui-danger)]/30 text-[var(--gui-danger)] text-xs uppercase tracking-wider rounded-md hover:bg-[var(--gui-danger-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]/70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-[var(--gui-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded cursor-pointer bg-transparent border border-[var(--glass-border)]"
        aria-label={`${label} color`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-xs text-[var(--color-text-primary)] truncate">
          {value.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
