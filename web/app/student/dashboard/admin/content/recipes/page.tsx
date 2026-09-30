"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus } from "lucide-react";
import { AdminGate, thCls } from "@/components/portal/ProgressionAdminShared";
import type { RecipeRow } from "@/components/portal/RecipeEditor";
import { createClient } from "@/lib/supabase/client";

// Recipes (rows 63, 199): every crafting_recipes row, inactive ones too.
export default function AdminRecipesPage() {
  const [rows, setRows] = useState<RecipeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void createClient().from("crafting_recipes").select("*").order("position").then(({ data, error }) => {
      setRows((data ?? []) as RecipeRow[]);
      setError(error ? "crafting_recipes is not available (crafting migration not applied?)" : null);
    });
  }, []);

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Recipes</h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">{rows?.length ?? 0} recipes · crafted at the HQ workbench</p>
        </div>
        <Link href="/student/dashboard/admin/content/recipes/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md">
          <Plus size={14} /> New recipe
        </Link>
      </div>
      {error ? <p className="mb-4 text-xs font-mono text-red-400">{error}</p> : null}
      {rows === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading recipes...</p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">{["#", "Recipe", "Makes", "Ingredients", "Learned from", "Active", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs">{r.position}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-accent-cyan)]">{r.id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.output_qty} × {r.output_weapon ?? r.output_item}{r.output_weapon ? " (weapon)" : ""}</td>
                  <td className="px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)]">{Object.entries(r.ingredients).map(([k, n]) => `${n} ${k}`).join(", ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{[...r.sources, ...(r.drop_rarity ? [`${r.drop_rarity}+ catch`] : [])].join(", ")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.active ? "active" : "inactive"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/student/dashboard/admin/content/recipes/${r.id}/edit`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline mr-3"><Pencil size={12} /> Edit</Link>
                    <Link href={`/student/dashboard/admin/content/recipes/${r.id}/history`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:underline"><History size={12} /> History</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminGate>
  );
}
