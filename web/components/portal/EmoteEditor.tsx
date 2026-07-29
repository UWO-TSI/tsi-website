"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EmoteType } from "@/lib/content/types";
import ImageUploadButton from "@/components/portal/ImageUploadButton";

// ─── EmoteEditor (sprint E8) ────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Mirrors the C1
// NPCEditor draft/preview/publish flow.

const SLUG_REGEX = /^[a-z0-9-]+$/;

interface FormState {
  slug: string;
  display_name: string;
  animation_key: string;
  icon_url: string;
  unlock_condition: string;
  active: boolean;
}

interface EmoteEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<EmoteType> | null;
}

const EMPTY_FORM: FormState = {
  slug: "",
  display_name: "",
  animation_key: "",
  icon_url: "",
  unlock_condition: "",
  active: true,
};

function toFormState(row: Partial<EmoteType> | null | undefined): FormState {
  if (!row) return { ...EMPTY_FORM };
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    animation_key: row.animation_key ?? "",
    icon_url: row.icon_url ?? "",
    unlock_condition: row.unlock_condition ?? "",
    active: row.active ?? true,
  };
}

export default function EmoteEditor({ mode, rowId, initial }: EmoteEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  // Load existing slugs (live rows + outstanding drafts), skipping own.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: rows }, { data: drafts }] = await Promise.all([
          supabase.from("emote_types").select("slug, id"),
          supabase
            .from("content_drafts")
            .select("draft_data, row_id")
            .eq("table_name", "emote_types")
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
        // Silent — uniqueness will fall back to server.
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

  const handleSaveDraft = async () => {
    if (hasErrors || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const payload = {
        table_name: "emote_types",
        row_id: mode === "edit" ? rowId : null,
        draft_data: {
          slug: form.slug.trim(),
          display_name: form.display_name.trim(),
          animation_key: form.animation_key.trim() || form.slug.trim(),
          icon_url: form.icon_url.trim() || null,
          unlock_condition: form.unlock_condition.trim() || null,
          active: form.active,
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
      router.push("/student/dashboard/admin/content/emotes");
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

  const previewHref = draftId
    ? `/student/dashboard?preview=draft-${draftId}`
    : null;

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin/content/emotes"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Emotes
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new" ? "New Emote" : `Edit: ${initial?.display_name ?? "Emote"}`}
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Drafts stay invisible to members until published.
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

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <Field
          label="Slug"
          hint="kebab-case identifier, e.g. wave or dance"
          error={errors.slug}
        >
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputCls}
            placeholder="wave"
            spellCheck={false}
          />
        </Field>

        <Field label="Display Name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Wave"
          />
        </Field>

        <Field
          label="Animation Key"
          hint="Free-form; convention: same as slug (e.g. 'wave', 'dance'). Drives the client animation."
          error={errors.animation_key}
        >
          <input
            type="text"
            value={form.animation_key}
            onChange={(e) => update("animation_key", e.target.value)}
            className={inputCls}
            placeholder="wave"
            spellCheck={false}
          />
        </Field>

        <Field label="Icon URL" hint="Optional. Paste a URL or upload an image (≤ 5MB).">
          <input
            type="text"
            value={form.icon_url}
            onChange={(e) => update("icon_url", e.target.value)}
            className={inputCls}
            placeholder="https://..."
            spellCheck={false}
          />
          <ImageUploadButton onUpload={(url) => update("icon_url", url)} />
        </Field>

        <Field
          label="Unlock Condition"
          hint="e.g. 'level:5' or 'class:explorer'. Leave blank for always-unlocked."
        >
          <input
            type="text"
            value={form.unlock_condition}
            onChange={(e) => update("unlock_condition", e.target.value)}
            className={inputCls}
            placeholder="level:5"
            spellCheck={false}
          />
        </Field>

        <Toggle
          label="Active"
          hint="Inactive emotes are hidden from the emote menu."
          checked={form.active}
          onChange={(v) => update("active", v)}
        />
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

        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnCls}
          >
            <ExternalLink size={12} /> Preview
          </a>
        ) : null}

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

  const anim = form.animation_key.trim();
  if (anim && !SLUG_REGEX.test(anim)) {
    errors.animation_key = "Use lowercase letters, numbers, and dashes only";
  }

  return errors;
}

// ─── Sub-components / classes ───────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent-cyan)] transition-colors";

const primaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";

const secondaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-xs uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] transition-colors";

const publishBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";

const dangerBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 font-mono text-xs uppercase tracking-wider rounded-md hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

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
      <label className="block text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.65rem] font-mono text-[var(--color-text-muted)]/70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.65rem] font-mono text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border border-[var(--glass-border)] transition-colors ${
          checked
            ? "bg-[var(--color-accent-cyan)]"
            : "bg-[var(--color-bg)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <div className="flex-1">
        <label className="block text-xs font-mono text-[var(--color-text-primary)]">
          {label}
        </label>
        {hint ? (
          <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]/70 mt-0.5">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
