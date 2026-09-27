"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { ROSTER } from "@/lib/collections/roster";
import { WEAPONS } from "@/lib/combat/weapons";
import { CRAFTED_ITEMS, MATERIALS, RECIPE_SOURCES, validateRecipeDraft, type RecipeSource } from "@/lib/crafting/recipes";
import { CATALOGUE } from "@/lib/wallet/catalogue";
import { DraftBar, Field, inputCls, Toggle, useDraftFlow } from "./ProgressionAdminShared";

// ─── RecipeEditor ───────────────────────────────────────────────────────────
// A crafting_recipes row (rows 63, 199): output, ingredients from the
// collections roster, where it can be learned. Same draft → publish flow and
// version history as the other content editors.

const BACK = "/student/dashboard/admin/content/recipes";
const SOURCE_HINT: Record<RecipeSource, string> = { starter: "everyone knows it", shop: "recipe card in the shop", bottle: "beach message bottle", quest: "a resident's quest" };
const ITEM_KEYS = [...CATALOGUE, ...CRAFTED_ITEMS].map((c) => c.slug);
const INGREDIENT_KEYS = [...ROSTER, ...MATERIALS].map((s) => s.key);

export interface RecipeRow {
  id: string;
  output_item: string | null;
  output_weapon: string | null;
  output_qty: number;
  ingredients: Record<string, number>;
  sources: RecipeSource[];
  position: number;
  active: boolean;
}

export default function RecipeEditor({ mode, initial }: { mode: "new" | "edit"; initial?: RecipeRow | null }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id ?? "",
    kind: initial?.output_weapon ? ("weapon" as const) : ("item" as const),
    output: initial?.output_weapon ?? initial?.output_item ?? "",
    output_qty: initial?.output_qty ?? 1,
    ingredients: Object.entries(initial?.ingredients ?? { "": 1 }),
    sources: initial?.sources ?? (["bottle"] as RecipeSource[]),
    position: initial?.position ?? 100,
    active: initial?.active ?? true,
  }));
  const flow = useDraftFlow("crafting_recipes", mode === "edit" ? initial?.id : undefined, BACK);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setIngredient = (i: number, key: string, n: number) => set("ingredients", form.ingredients.map((row, j) => (j === i ? [key, n] : row)));

  const draft = useMemo(
    () => ({
      id: form.id.trim(),
      output_item: form.kind === "item" ? form.output.trim() : null,
      output_weapon: form.kind === "weapon" ? form.output.trim() : null,
      output_qty: Math.floor(Number(form.output_qty)),
      ingredients: Object.fromEntries(form.ingredients.map(([k, n]) => [k.trim(), Math.floor(Number(n))])),
      sources: form.sources,
      position: Math.floor(Number(form.position)),
      active: form.active,
    }),
    [form],
  );
  const errors = validateRecipeDraft(draft);

  return (
    <div>
      <Link href={BACK} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Recipes
      </Link>
      <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">{mode === "new" ? "New recipe" : `Edit: ${initial?.id ?? "Recipe"}`}</h1>
      <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1 mb-6">Crafted at the HQ workbench from collection items. The output must already exist in the shop catalogue or the weapons list.</p>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <div className="grid gap-5 md:grid-cols-[1fr_120px]">
          <Field label="Recipe id" hint={mode === "edit" ? "Fixed once published (members' recipe books point at it)" : "lowercase-with-dashes, usually the output's key"}>
            <input className={inputCls} value={form.id} disabled={mode === "edit"} onChange={(e) => set("id", e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Order"><input className={inputCls} type="number" value={form.position} onChange={(e) => set("position", Number(e.target.value))} /></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-[140px_1fr_100px]">
          <Field label="Makes a">
            <select className={inputCls} value={form.kind} onChange={(e) => set("kind", e.target.value as "item" | "weapon")}>
              <option value="item">Shop item</option>
              <option value="weapon">Weapon</option>
            </select>
          </Field>
          <Field label="Output">
            <input className={inputCls} list={`recipe-${form.kind}s`} value={form.output} onChange={(e) => set("output", e.target.value)} spellCheck={false} />
            <datalist id="recipe-items">{ITEM_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
            <datalist id="recipe-weapons">{WEAPONS.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}</datalist>
          </Field>
          <Field label="Quantity"><input className={inputCls} type="number" min={1} max={20} value={form.output_qty} onChange={(e) => set("output_qty", Number(e.target.value))} /></Field>
        </div>
        <Field label="Ingredients" hint="Collection item keys (fish, bugs, flowers, shells, minerals, wood_branch) and how many">
          <div className="space-y-2">
            {form.ingredients.map(([key, n], i) => (
              <div key={i} className="grid grid-cols-[1fr_96px_auto] gap-2">
                <input className={inputCls} list="recipe-ingredients" aria-label="Ingredient" value={key} onChange={(e) => setIngredient(i, e.target.value, n)} spellCheck={false} />
                <input className={inputCls} aria-label="Count" type="number" min={1} max={99} value={n} onChange={(e) => setIngredient(i, key, Number(e.target.value))} />
                <button type="button" aria-label="Remove ingredient" onClick={() => set("ingredients", form.ingredients.filter((_, j) => j !== i))} className="px-2 text-[var(--color-text-muted)] hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
            <datalist id="recipe-ingredients">{INGREDIENT_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
            <button type="button" onClick={() => set("ingredients", [...form.ingredients, ["", 1]])} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline"><Plus size={12} /> Add ingredient</button>
          </div>
        </Field>
        <Field label="Learned from" hint="Shop recipes also need a recipe card in the shop catalogue (catalogue_ref recipe:<id>)">
          <div className="flex flex-wrap gap-4">
            {RECIPE_SOURCES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-primary)]">
                <input type="checkbox" checked={form.sources.includes(s)} onChange={(e) => set("sources", e.target.checked ? [...form.sources, s] : form.sources.filter((x) => x !== s))} />
                {s} <span className="text-[var(--color-text-muted)]">({SOURCE_HINT[s]})</span>
              </label>
            ))}
          </div>
        </Field>
        <Toggle label="Active" hint="Inactive recipes leave every recipe book and can't be crafted." checked={form.active} onChange={(v) => set("active", v)} />
        {errors.length ? <ul className="text-[0.65rem] font-mono text-red-400 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      </div>
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
    </div>
  );
}
