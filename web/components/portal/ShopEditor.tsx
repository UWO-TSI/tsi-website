"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem, ShopCategory, Rarity } from "@/lib/game/contentTypes";

// ─── ShopEditor ─────────────────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Mirrors NPCEditor:
// renders all shop_item fields, validates client-side, then drives the B3
// draft/preview/publish API.
//
// `mode = "new"` — slug uniqueness is enforced; row_id sent as null.
// `mode = "edit"` — initial row + id loaded by the page wrapper; slug
//                   uniqueness skips the current slug.

const SLUG_REGEX = /^[a-z0-9-]+$/;
const CATEGORIES: ShopCategory[] = [
  "avatar-outfit",
  "avatar-effect",
  "merch",
  "profile-customization",
];
const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

interface FormState {
  slug: string;
  display_name: string;
  category: ShopCategory;
  sprite_url: string;
  description: string;
  tc_price: string;
  rarity: Rarity;
  stock: string;
  unlimited_stock: boolean;
  active: boolean;
  released_at: string;
  retired_at: string;
}

interface ShopEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<ShopItem> | null;
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

function makeEmptyForm(): FormState {
  return {
    slug: "",
    display_name: "",
    category: "merch",
    sprite_url: "",
    description: "",
    tc_price: "0",
    rarity: "common",
    stock: "0",
    unlimited_stock: false,
    active: true,
    released_at: toLocalDatetime(new Date().toISOString()),
    retired_at: "",
  };
}

function toFormState(row: Partial<ShopItem> | null | undefined): FormState {
  if (!row) return makeEmptyForm();
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    category: (row.category as ShopCategory) ?? "merch",
    sprite_url: row.sprite_url ?? "",
    description: row.description ?? "",
    tc_price:
      row.tc_price === undefined || row.tc_price === null
        ? "0"
        : String(row.tc_price),
    rarity: (row.rarity as Rarity) ?? "common",
    stock:
      row.stock === undefined || row.stock === null ? "0" : String(row.stock),
    unlimited_stock: row.stock === null || row.stock === undefined,
    active: row.active ?? true,
    released_at: toLocalDatetime(row.released_at) || toLocalDatetime(new Date().toISOString()),
    retired_at: toLocalDatetime(row.retired_at ?? null),
  };
}

export default function ShopEditor({ mode, rowId, initial }: ShopEditorProps) {
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
          supabase.from("shop_items").select("slug, id"),
          supabase
            .from("content_drafts")
            .select("draft_data, row_id")
            .eq("table_name", "shop_items")
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

  const handleSaveDraft = async () => {
    if (hasErrors || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const stockValue = form.unlimited_stock
        ? null
        : Number.parseInt(form.stock, 10);
      const releasedIso = fromLocalDatetime(form.released_at);
      const retiredIso = form.retired_at
        ? fromLocalDatetime(form.retired_at)
        : null;
      const payload = {
        table_name: "shop_items",
        row_id: mode === "edit" ? rowId : null,
        draft_data: {
          slug: form.slug.trim(),
          display_name: form.display_name.trim(),
          category: form.category,
          sprite_url: form.sprite_url.trim() || null,
          description: form.description.trim() || null,
          tc_price: Number.parseInt(form.tc_price, 10),
          rarity: form.rarity,
          stock: stockValue,
          active: form.active,
          released_at: releasedIso,
          retired_at: retiredIso,
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
      router.push("/student/dashboard/admin/content/shop");
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

  const descriptionLength = form.description.length;
  const descOver = descriptionLength > 500;
  const descWarn = !descOver && descriptionLength > 450;

  const trimmedSprite = form.sprite_url.trim();

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin/content/shop"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Shop
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new"
            ? "New Shop Item"
            : `Edit: ${initial?.display_name ?? "Shop Item"}`}
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
          hint="kebab-case identifier, e.g. tsi-hoodie"
          error={errors.slug}
        >
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputCls}
            placeholder="tsi-hoodie"
            spellCheck={false}
          />
        </Field>

        <Field label="Display Name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="TSI Hoodie"
          />
        </Field>

        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) =>
              update("category", e.target.value as ShopCategory)
            }
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Sprite URL"
          hint="Leave blank until sprite assets are uploaded"
        >
          <input
            type="text"
            value={form.sprite_url}
            onChange={(e) => update("sprite_url", e.target.value)}
            className={inputCls}
            placeholder="https://..."
            spellCheck={false}
          />
          {trimmedSprite ? (
            <div className="mt-2 inline-flex items-center justify-center w-20 h-20 border border-[var(--glass-border)] rounded-md bg-[var(--color-bg)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trimmedSprite}
                alt="Sprite preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : null}
        </Field>

        <Field
          label="Description"
          hint="Shown on the shop listing. ≤ 500 chars."
          error={errors.description}
        >
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="Heavyweight cotton hoodie with the TSI crest..."
          />
          <p
            className={`mt-1 text-[0.65rem] font-mono ${
              descOver
                ? "text-red-400"
                : descWarn
                  ? "text-[var(--color-brand-yellow)]"
                  : "text-[var(--color-text-muted)]"
            }`}
          >
            {descriptionLength} / 500 characters
          </p>
        </Field>

        <Field label="TC Price" error={errors.tc_price}>
          <input
            type="number"
            min={0}
            step={1}
            value={form.tc_price}
            onChange={(e) => update("tc_price", e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </Field>

        <Field label="Rarity">
          <select
            value={form.rarity}
            onChange={(e) => update("rarity", e.target.value as Rarity)}
            className={inputCls}
          >
            {RARITIES.map((r) => (
              <option
                key={r}
                value={r}
                style={{ color: rarityOptionColor[r] }}
              >
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Toggle
          label="Unlimited stock"
          hint="When on, stock is treated as null (infinite). When off, set an integer count below."
          checked={form.unlimited_stock}
          onChange={(v) => update("unlimited_stock", v)}
        />

        {form.unlimited_stock ? null : (
          <Field label="Stock" error={errors.stock}>
            <input
              type="number"
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => update("stock", e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </Field>
        )}

        <Toggle
          label="Active"
          hint="Inactive items are hidden from the shop."
          checked={form.active}
          onChange={(v) => update("active", v)}
        />

        <Field
          label="Released At"
          hint="When the item becomes available."
          error={errors.released_at}
        >
          <input
            type="datetime-local"
            value={form.released_at}
            onChange={(e) => update("released_at", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Retired At"
          hint="Leave blank for never-retired."
        >
          <input
            type="datetime-local"
            value={form.retired_at}
            onChange={(e) => update("retired_at", e.target.value)}
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

  if (form.description.length > 500) {
    errors.description = "Description must be ≤ 500 characters";
  }

  const price = Number(form.tc_price);
  if (form.tc_price.trim() === "" || !Number.isFinite(price)) {
    errors.tc_price = "Price is required";
  } else if (!Number.isInteger(price)) {
    errors.tc_price = "Price must be a whole number";
  } else if (price < 0) {
    errors.tc_price = "Price must be ≥ 0";
  }

  if (!form.unlimited_stock) {
    const stock = Number(form.stock);
    if (form.stock.trim() === "" || !Number.isFinite(stock)) {
      errors.stock = "Stock is required (or toggle Unlimited)";
    } else if (!Number.isInteger(stock)) {
      errors.stock = "Stock must be a whole number";
    } else if (stock < 0) {
      errors.stock = "Stock must be ≥ 0";
    }
  }

  if (!form.released_at) {
    errors.released_at = "Released-at is required";
  } else {
    const iso = fromLocalDatetime(form.released_at);
    if (!iso) errors.released_at = "Invalid timestamp";
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

const rarityOptionColor: Record<Rarity, string> = {
  common: "#9ca3af",
  rare: "#60a5fa",
  epic: "#a78bfa",
  legendary: "#fb923c",
};

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
