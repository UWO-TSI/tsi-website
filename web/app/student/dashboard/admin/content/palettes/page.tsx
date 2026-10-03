"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Palette, Plus, Pencil } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PALETTES } from "@/data/content-defaults";
import type { SeasonalPalette, PaletteColors } from "@/lib/content/types";
import { Badge, Card, Empty, ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

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
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden />
          Back to admin
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
              Seasonal palettes
            </h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">
              {palettes?.length ?? 0} palettes
            </p>
          </div>
          <Link
            href="/student/dashboard/admin/content/palettes/new"
            className={BUTTON_LINK}
            data-size="sm"
          >
            <Plus size={16} aria-hidden /> New palette
          </Link>
        </div>

        {fetchError && (
          <ErrorNote className="mb-4">
            Couldn’t read the palettes ({fetchError}), so these are the built-in defaults.
          </ErrorNote>
        )}

        {palettes === null ? (
          <Loading label="Getting the palettes…" />
        ) : palettes.length === 0 ? (
          <Empty icon={<Palette size={32} />} title="No palettes yet">
            Add one to give the island a new look for a season.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {palettes.map((p) => (
              <Card
                key={p.id}
                as="article"
                style={p.active ? { boxShadow: "var(--gui-shadow-sm), inset 0 0 0 2.5px var(--gui-sage)" } : undefined}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                      {p.display_name}
                    </h3>
                    <p className="text-xs text-[var(--gui-muted)]">
                      {p.slug}
                    </p>
                  </div>
                  {p.active ? <Badge tone="sage">Active</Badge> : <Badge>Inactive</Badge>}
                </div>

                <div className="mb-3 flex flex-wrap gap-3">
                  {swatchKeys.map((key) => {
                    const color =
                      (p.palette as unknown as Record<string, string> | null)?.[
                        key
                      ] ?? null;
                    if (!color) return null;
                    return (
                      <div
                        key={key}
                        className="flex w-16 flex-col items-center gap-1 text-center"
                        title={`${key}: ${color}`}
                      >
                        <div
                          className="h-9 w-9 rounded-[10px] shadow-[inset_0_0_0_1.5px_var(--gui-paper-line)]"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs leading-tight text-[var(--gui-ink-2)]">
                          {key.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mb-3 space-y-0.5 text-sm text-[var(--gui-ink-2)]">
                  <p>
                    Starts {p.scheduled_start ? day(p.scheduled_start) : "—"}
                  </p>
                  <p>
                    Ends {p.scheduled_end ? day(p.scheduled_end) : "—"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t-2 border-dashed border-[var(--gui-paper-edge)] pt-3 text-sm">
                  <Link
                    href={`/student/dashboard/admin/content/palettes/${p.id}/edit`}
                    className="inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"
                  >
                    <Pencil size={14} aria-hidden /> Edit
                  </Link>
                  <Link
                    href={`/student/dashboard/admin/content/palettes/${p.id}/history`}
                    className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"
                  >
                    <History size={14} aria-hidden /> History
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminGate>
  );
}
