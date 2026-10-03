"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PALETTES } from "@/data/content-defaults";
import type { SeasonalPalette, PaletteColors } from "@/lib/content/types";

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export default function AdminContentPalettesPage() {
  const [palettes, setPalettes] = useState<SeasonalPalette[] | null>(hasSupabaseEnv() ? null : DEFAULT_PALETTES);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("seasonal_palettes")
          .select(
            "id, slug, display_name, palette, active, scheduled_start, scheduled_end, created_at",
          )
          .order("created_at", { ascending: false });
        if (error || !data) {
          setFetchError(error?.message ?? "unknown");
          setPalettes(DEFAULT_PALETTES);
          return;
        }
        setPalettes(data as unknown as SeasonalPalette[]);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "unknown");
        setPalettes(DEFAULT_PALETTES);
      }
    })();
  }, []);

  const swatchKeys: (keyof PaletteColors)[] = [
    "sky",
    "grass",
    "water",
    "fog",
    "accent",
    "building_primary",
    "building_accent",
  ];

  return (
    <AdminGate>
      <div>
        <div className="mb-2">
          <Link
            href="/student/dashboard/admin"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Admin
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
              Seasonal Palettes
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {palettes?.length ?? 0} total
            </p>
          </div>
          <Link
            href="/student/dashboard/admin/content/palettes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Palette
          </Link>
        </div>

        {fetchError && (
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            Supabase read failed ({fetchError}) — showing bundled defaults.
          </p>
        )}

        {palettes === null ? (
          <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">
            Loading palettes...
          </p>
        ) : palettes.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">
            No palettes defined yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {palettes.map((p) => (
              <div
                key={p.id}
                className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
                style={{
                  borderColor: p.active
                    ? "var(--color-brand-blue)"
                    : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                      {p.display_name}
                    </h3>
                    <p className="text-xs text-[var(--color-accent-cyan)]">
                      {p.slug}
                    </p>
                  </div>
                  <span
                    className={`text-xs uppercase px-2 py-0.5 rounded ${
                      p.active
                        ? "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10"
                        : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                    }`}
                  >
                    {p.active ? "active" : "inactive"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {swatchKeys.map((key) => {
                    const color =
                      (p.palette as unknown as Record<string, string> | null)?.[
                        key
                      ] ?? null;
                    if (!color) return null;
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center gap-1"
                        title={`${key}: ${color}`}
                      >
                        <div
                          className="w-8 h-8 rounded border border-[var(--glass-border)]"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {key}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-[var(--color-text-muted)] space-y-0.5 mb-3">
                  <p>
                    Start:{" "}
                    {p.scheduled_start
                      ? new Date(p.scheduled_start).toLocaleDateString()
                      : "—"}
                  </p>
                  <p>
                    End:{" "}
                    {p.scheduled_end
                      ? new Date(p.scheduled_end).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--glass-border)]/40">
                  <Link
                    href={`/student/dashboard/admin/content/palettes/${p.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-cyan)] hover:underline"
                  >
                    <Pencil size={12} /> Edit
                  </Link>
                  <Link
                    href={`/student/dashboard/admin/content/palettes/${p.id}/history`}
                    className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors"
                  >
                    History
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminGate>
  );
}
