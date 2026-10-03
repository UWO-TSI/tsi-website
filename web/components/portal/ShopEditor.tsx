"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem, ShopCategory, Rarity } from "@/lib/content/types";
import type { ShopCategory as CatalogueCategory } from "@/lib/wallet/catalogue";
import ImageUploadButton from "@/components/portal/ImageUploadButton";
import { CurrencyIcon } from "@/components/economy/Amount";
import { Button, Card, ItemTile, Select } from "@/components/gui";
import { AdminMessage, backLinkCls, Field, inputCls, Toggle } from "./ProgressionAdminShared";

// ─── ShopEditor ─────────────────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Mirrors NPCEditor:
// renders all shop_item fields, validates client-side, then drives the B3
// draft/publish API.
//
// `mode = "new"` — slug uniqueness is enforced; row_id sent as null.
// `mode = "edit"` — initial row + id loaded by the page wrapper; slug
//                   uniqueness skips the current slug.

const SLUG_REGEX = /^[a-z0-9-]+$/;
// 20260926150600_economy.sql widened the categories; merch is always priced in Gems,
// everything else in play coins or Gems. No real-money price exists.
type EditorCategory = ShopCategory | CatalogueCategory;
const CATEGORIES: EditorCategory[] = [
  "tool",
  "outfit",
  "hair",
  "accessory",
  "furniture",
  "wallpaper",
  "flooring",
  "merch",
  "avatar-outfit",
  "avatar-effect",
  "profile-customization",
];
const TIERS = ["", "basic", "mid", "premium"] as const;
const SLOTS = ["", "rod", "net", "shovel", "outfit", "hair", "accessory"] as const;
type EconomyFields = { price_coins?: number | null; tier?: string | null; slot?: string | null; special_pool?: boolean; stackable?: boolean; catalogue_ref?: string | null };
const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

interface FormState {
  slug: string;
  display_name: string;
  category: EditorCategory;
  currency: "coins" | "gems";
  tier: string;
  slot: string;
  special_pool: boolean;
  stackable: boolean;
  catalogue_ref: string;
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
  initial?: (Partial<ShopItem> & EconomyFields) | null;
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
    currency: "gems",
    tier: "",
    slot: "",
    special_pool: false,
    stackable: false,
    catalogue_ref: "",
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

function toFormState(row: (Partial<ShopItem> & EconomyFields) | null | undefined): FormState {
  if (!row) return makeEmptyForm();
  const coinPriced = row.price_coins !== null && row.price_coins !== undefined;
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    category: (row.category as EditorCategory) ?? "merch",
    currency: coinPriced ? "coins" : "gems",
    tier: row.tier ?? "",
    slot: row.slot ?? "",
    special_pool: row.special_pool ?? false,
    stackable: row.stackable ?? false,
    catalogue_ref: row.catalogue_ref ?? "",
    sprite_url: row.sprite_url ?? "",
    description: row.description ?? "",
    tc_price: coinPriced
      ? String(row.price_coins)
      : row.tc_price === undefined || row.tc_price === null
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
          // One price per item (033 shop_items_one_price): Gems in tc_price, coins in price_coins.
          tc_price: form.currency === "gems" ? Number.parseInt(form.tc_price, 10) : null,
          price_coins: form.currency === "coins" ? Number.parseInt(form.tc_price, 10) : null,
          tier: form.tier || null,
          slot: form.slot || null,
          special_pool: form.special_pool,
          stackable: form.stackable,
          catalogue_ref: form.catalogue_ref.trim() || null,
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

  const descriptionLength = form.description.length;
  const descOver = descriptionLength > 500;
  const descWarn = !descOver && descriptionLength > 450;

  const trimmedSprite = form.sprite_url.trim();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/student/dashboard/admin/content/shop" className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden />
        Back to the shop
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          {mode === "new"
            ? "New shop item"
            : `Edit: ${initial?.display_name ?? "Shop item"}`}
        </h1>
        <p className="text-sm text-[var(--gui-muted)] mt-1">
          Drafts stay invisible to members until published.
        </p>
      </div>

      <AdminMessage message={message} className="mb-4" />

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
        <Field
          label="Slug"
          hint="Lowercase letters, numbers and dashes, e.g. tsi-hoodie"
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

        <Field label="Display name" error={errors.display_name}>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="TSI Hoodie"
          />
        </Field>

        <Field label="Category">
          <Select
            value={form.category}
            onChange={(e) =>
              update("category", e.target.value as EditorCategory)
            }
            className="w-full"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Sprite URL"
          hint="Paste a URL or upload an image (up to 5 MB: PNG, JPEG, WebP or GIF)"
        >
          <input
            type="text"
            value={form.sprite_url}
            onChange={(e) => update("sprite_url", e.target.value)}
            className={inputCls}
            aria-label="Sprite URL"
            placeholder="https://..."
            spellCheck={false}
          />
          <ImageUploadButton onUpload={(url) => update("sprite_url", url)} />
          {trimmedSprite ? (
            <ItemTile
              className="mt-3"
              icon={trimmedSprite}
              name={form.display_name.trim() || "Sprite preview"}
              rarity={form.rarity}
              size={80}
            />
          ) : null}
        </Field>

        <Field
          label="Description"
          hint="Shown on the shop listing. Up to 500 characters."
          error={errors.description}
        >
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${inputCls} resize-y`}
            aria-label="Description"
            placeholder="Heavyweight cotton hoodie with the TSI crest..."
          />
          <p
            className={`mt-1.5 text-[13px] font-semibold ${
              descOver
                ? "text-[var(--gui-danger)]"
                : descWarn
                  ? "text-[var(--gui-warn)]"
                  : "text-[var(--gui-muted)]"
            }`}
          >
            {descriptionLength} / 500 characters
          </p>
        </Field>

        <Field label="Priced in" hint="Merch is always Gems (picked up on campus). Everything else can be TC or Gems." error={errors.currency}>
          <Select value={form.currency} onChange={(e) => update("currency", e.target.value as FormState["currency"])} className="w-full">
            <option value="coins">TC</option>
            <option value="gems">Gems</option>
          </Select>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Tier" hint="Tools: basic, mid or premium">
            <Select value={form.tier} onChange={(e) => update("tier", e.target.value)} className="w-full">
              {TIERS.map((t) => <option key={t} value={t}>{t || "none"}</option>)}
            </Select>
          </Field>
          <Field label="Equip slot" hint="One equipped item per slot">
            <Select value={form.slot} onChange={(e) => update("slot", e.target.value)} className="w-full">
              {SLOTS.map((t) => <option key={t} value={t}>{t || "none"}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Catalogue ref" hint="Homes piece id (e.g. lounge-sofa), wallpaper/flooring key, or legacy gear key (rod_cedar).">
          <input type="text" value={form.catalogue_ref} onChange={(e) => update("catalogue_ref", e.target.value)} className={inputCls} spellCheck={false} />
        </Field>

        <Toggle label="Daily specials pool" hint="Eligible for the three daily specials (20% off, the same for everyone each Toronto day). TC-priced items only." checked={form.special_pool} onChange={(v) => update("special_pool", v)} />
        <Toggle label="Stackable" hint="Members can own more than one (furniture). Off: one per member." checked={form.stackable} onChange={(v) => update("stackable", v)} />

        <Field label={form.currency === "coins" ? "Price in TC" : "Price in Gems"} error={errors.tc_price}>
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={0}
              step={1}
              value={form.tc_price}
              onChange={(e) => update("tc_price", e.target.value)}
              className={inputCls}
              placeholder="0"
              aria-label={form.currency === "coins" ? "Price in TC" : "Price in Gems"}
            />
            <CurrencyIcon currency={form.currency} size={28} />
          </div>
        </Field>

        <Field label="Rarity">
          <Select
            value={form.rarity}
            onChange={(e) => update("rarity", e.target.value as Rarity)}
            className="w-full"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle
          label="Unlimited stock"
          hint="On: it never sells out. Off: set how many there are below."
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
          label="Released"
          hint="When the item goes on sale."
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
          label="Retired"
          hint="Leave it empty to keep it on sale."
        >
          <input
            type="datetime-local"
            value={form.retired_at}
            onChange={(e) => update("retired_at", e.target.value)}
            className={inputCls}
          />
        </Field>
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

  if (form.category === "merch" && form.currency !== "gems") {
    errors.currency = "Merch is priced in Gems";
  }
  if (form.special_pool && form.currency !== "coins") {
    errors.currency = "Daily specials are TC-priced items only";
  }

  if (form.description.length > 500) {
    errors.description = "Description must be ≤ 500 characters";
  }

  const price = Number(form.tc_price);
  if (form.tc_price.trim() === "" || !Number.isFinite(price)) {
    errors.tc_price = "Price is required";
  } else if (!Number.isInteger(price)) {
    errors.tc_price = "Price must be a whole number";
  } else if (price < 0 || (form.currency === "coins" && price < 1)) {
    errors.tc_price = form.currency === "coins" ? "The TC price must be at least 1" : "Price must be ≥ 0";
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
    errors.released_at = "Set when it goes on sale";
  } else {
    const iso = fromLocalDatetime(form.released_at);
    if (!iso) errors.released_at = "Invalid timestamp";
  }

  return errors;
}
