"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NPCPersona, SpawnZone } from "@/lib/game/contentTypes";

// ─── NPCEditor ──────────────────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Renders all NPC
// fields, validates client-side, then drives the B3 draft/preview/publish API.
//
// `mode = "new"` — slug uniqueness is enforced; row_id sent as null.
// `mode = "edit"` — initial row + id loaded by the page wrapper; slug
//                   uniqueness skips the current slug.

const SLUG_REGEX = /^[a-z0-9-]+$/;
const SPAWN_ZONES: SpawnZone[] = ["courtyard", "shop", "temple", "roaming"];

interface FormState {
  slug: string;
  display_name: string;
  spawn_zone: SpawnZone;
  is_permanent: boolean;
  persona_prompt: string;
  canned_dialogue: string[];
  sprite_url: string;
  active: boolean;
}

interface NPCEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<NPCPersona> | null;
}

const EMPTY_FORM: FormState = {
  slug: "",
  display_name: "",
  spawn_zone: "courtyard",
  is_permanent: false,
  persona_prompt: "",
  canned_dialogue: [],
  sprite_url: "",
  active: true,
};

function toFormState(row: Partial<NPCPersona> | null | undefined): FormState {
  if (!row) return { ...EMPTY_FORM };
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    spawn_zone: (row.spawn_zone as SpawnZone) ?? "courtyard",
    is_permanent: Boolean(row.is_permanent),
    persona_prompt: row.persona_prompt ?? "",
    canned_dialogue: Array.isArray(row.canned_dialogue)
      ? [...row.canned_dialogue]
      : [],
    sprite_url: row.sprite_url ?? "",
    active: row.active ?? true,
  };
}

export default function NPCEditor({ mode, rowId, initial }: NPCEditorProps) {
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
          supabase.from("npc_personas").select("slug, id"),
          supabase
            .from("content_drafts")
            .select("draft_data, row_id")
            .eq("table_name", "npc_personas")
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

  const handleAddLine = () => {
    update("canned_dialogue", [...form.canned_dialogue, ""]);
  };
  const handleEditLine = (idx: number, val: string) => {
    const next = [...form.canned_dialogue];
    next[idx] = val;
    update("canned_dialogue", next);
  };
  const handleRemoveLine = (idx: number) => {
    update(
      "canned_dialogue",
      form.canned_dialogue.filter((_, i) => i !== idx),
    );
  };

  const handleSaveDraft = async () => {
    if (hasErrors || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const payload = {
        table_name: "npc_personas",
        row_id: mode === "edit" ? rowId : null,
        draft_data: {
          slug: form.slug.trim(),
          display_name: form.display_name.trim(),
          spawn_zone: form.spawn_zone,
          is_permanent: form.is_permanent,
          persona_prompt: form.persona_prompt.trim() || null,
          canned_dialogue: form.canned_dialogue
            .map((l) => l.trim())
            .filter((l) => l.length > 0),
          sprite_url: form.sprite_url.trim() || null,
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
      router.push("/student/dashboard/admin/content/npcs");
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

  const promptLength = form.persona_prompt.length;
  const promptOver = promptLength > 2000;
  const promptWarn = !promptOver && promptLength > 1800;

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin/content/npcs"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to NPCs
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new" ? "New NPC" : `Edit: ${initial?.display_name ?? "NPC"}`}
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
          hint="kebab-case identifier, e.g. wise-shopkeeper"
          error={errors.slug}
        >
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputCls}
            placeholder="wise-shopkeeper"
            spellCheck={false}
          />
        </Field>

        <Field label="Display Name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Marigold the Merchant"
          />
        </Field>

        <Field label="Spawn Zone">
          <select
            value={form.spawn_zone}
            onChange={(e) => update("spawn_zone", e.target.value as SpawnZone)}
            className={inputCls}
          >
            {SPAWN_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>

        <Toggle
          label="Permanent NPC"
          hint="Permanent NPCs always spawn. Non-permanent are filler that scale with player count."
          checked={form.is_permanent}
          onChange={(v) => update("is_permanent", v)}
        />

        <Field
          label="Persona Prompt"
          hint="LLM system prompt for the NPC's voice and behavior. Used when LLM-NPC ships."
          error={errors.persona_prompt}
        >
          <textarea
            rows={6}
            value={form.persona_prompt}
            onChange={(e) => update("persona_prompt", e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="You are Marigold, the cheerful merchant of the courtyard..."
          />
          <p
            className={`mt-1 text-[0.65rem] font-mono ${
              promptOver
                ? "text-red-400"
                : promptWarn
                  ? "text-[var(--color-brand-yellow)]"
                  : "text-[var(--color-text-muted)]"
            }`}
          >
            {promptLength} / 2000 characters
          </p>
        </Field>

        <Field
          label="Canned Dialogue"
          hint="Fallback lines used when the LLM is unavailable. ≤ 200 chars per line."
          error={errors.canned_dialogue}
        >
          <div className="space-y-2">
            {form.canned_dialogue.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleEditLine(idx, e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="Welcome, traveler!"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  className="px-2 py-2 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  aria-label="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline"
            >
              <Plus size={12} /> Add line
            </button>
          </div>
        </Field>

        <Field label="Sprite URL" hint="Leave blank until sprite assets are uploaded">
          <input
            type="text"
            value={form.sprite_url}
            onChange={(e) => update("sprite_url", e.target.value)}
            className={inputCls}
            placeholder="https://..."
            spellCheck={false}
          />
        </Field>

        <Toggle
          label="Active"
          hint="Inactive NPCs are hidden from the world."
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

  if (form.persona_prompt.length > 2000) {
    errors.persona_prompt = "Persona prompt must be ≤ 2000 characters";
  }

  for (const line of form.canned_dialogue) {
    if (line.length > 200) {
      errors.canned_dialogue = "Each dialogue line must be ≤ 200 characters";
      break;
    }
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
