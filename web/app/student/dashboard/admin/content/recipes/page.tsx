"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Hammer, History, Pencil, Plus } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { Badge, Card, Empty, ErrorNote, Loading } from "@/components/gui";
import type { RecipeRow } from "@/components/portal/RecipeEditor";
import { createClient } from "@/lib/supabase/client";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

// Recipes (rows 63, 199): every crafting_recipes row, inactive ones too.
export default function AdminRecipesPage() {
  const [rows, setRows] = useState<RecipeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void createClient().from("crafting_recipes").select("*").order("position").then(({ data, error }) => {
      setRows((data ?? []) as RecipeRow[]);
      setError(error ? "The recipes table isn’t there yet (is the crafting migration applied?)." : null);
    });
  }, []);

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Recipes</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">{rows?.length ?? 0} recipes · crafted at the HQ workbench</p>
          </div>
          <Link href="/student/dashboard/admin/content/recipes/new" className={BUTTON_LINK} data-size="sm">
            <Plus size={16} aria-hidden /> New recipe
          </Link>
        </div>
        {error ? <ErrorNote className="mb-4">{error}</ErrorNote> : null}
        {rows === null ? (
          <Loading label="Getting the recipes…" />
        ) : rows.length === 0 ? (
          error ? null : (
            <Empty icon={<Hammer size={32} />} title="No recipes yet">
              Add one and members can craft it at the HQ workbench.
            </Empty>
          )
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["#", "Recipe", "Makes", "Ingredients", "Learned from", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{r.position}</td>
                    <td className="px-4 py-3 font-extrabold text-[var(--gui-ink-strong)]">{r.id}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink)]">{r.output_qty} × {r.output_weapon ?? r.output_item}{r.output_weapon ? " (weapon)" : ""}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{Object.entries(r.ingredients).map(([k, n]) => `${n} ${k}`).join(", ")}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{[...r.sources, ...(r.drop_rarity ? [`${r.drop_rarity}+ catch`] : [])].join(", ")}</td>
                    <td className="px-4 py-3">{r.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/student/dashboard/admin/content/recipes/${r.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/recipes/${r.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminGate>
  );
}
