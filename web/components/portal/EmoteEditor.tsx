"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EmoteType } from "@/lib/content/types";
import ImageUploadButton from "@/components/portal/ImageUploadButton";
import { Button, Card } from "@/components/gui";
import { AdminMessage, backLinkCls, Field, inputCls, Toggle } from "./ProgressionAdminShared";

// ─── EmoteEditor (sprint E8) ────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Mirrors the C1
// NPCEditor draft/publish flow.

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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/student/dashboard/admin/content/emotes" className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden />
        Back to emotes
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          {mode === "new" ? "New emote" : `Edit: ${initial?.display_name ?? "Emote"}`}
        </h1>
        <p className="text-sm text-[var(--gui-muted)] mt-1">
          Drafts stay invisible to members until published.
        </p>
      </div>

      <AdminMessage message={message} className="mb-4" />

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
        <Field
          label="Slug"
          hint="Lowercase letters, numbers and dashes, e.g. wave or dance"
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

        <Field label="Display name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Wave"
          />
        </Field>

        <Field
          label="Animation key"
          hint="Usually the same as the slug (wave, dance). It picks the animation the game plays. Empty = the slug."
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

        <Field label="Icon URL" hint="Optional. Paste a URL or upload an image (up to 5 MB).">
          <input
            type="text"
            value={form.icon_url}
            onChange={(e) => update("icon_url", e.target.value)}
            className={inputCls}
            aria-label="Icon URL"
            placeholder="https://..."
            spellCheck={false}
          />
          <ImageUploadButton onUpload={(url) => update("icon_url", url)} />
        </Field>

        <Field
          label="Unlock condition"
          hint="e.g. level:5 or class:explorer. Leave it empty and everyone has it."
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
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={draftId ? "quiet" : "primary"}
          onClick={handleSaveDraft}
          disabled={hasErrors || busy !== null}
        >
          {busy === "save" ? "Saving…" : "Save as draft"}
        </Button>

        {draftId ? (
          <Button size="sm" onClick={handlePublish} disabled={busy !== null}>
            {busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
        ) : null}

        {draftId ? (
          <Button size="sm" variant="danger" onClick={handleDiscard} disabled={busy !== null}>
            {busy === "discard" ? "Discarding…" : "Discard draft"}
          </Button>
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
