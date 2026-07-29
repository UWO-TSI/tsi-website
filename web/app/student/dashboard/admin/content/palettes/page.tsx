"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Plus, Pencil, Check } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
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
  const { profile, loading } = useUser();
  const [palettes, setPalettes] = useState<SeasonalPalette[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateMessage, setActivateMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setPalettes(DEFAULT_PALETTES);
      return;
    }
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSetActive = async (id: string) => {
    if (activating) return;
    setActivating(id);
    setActivateMessage(null);
    try {
      const res = await fetch(`/api/content/palettes/${id}/activate`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setActivateMessage({
          kind: "err",
          text: body.error ?? "Activation failed",
        });
        return;
      }
      setActivateMessage({ kind: "ok", text: "Palette activated." });
      await load();
    } catch (err) {
      setActivateMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Activation failed",
      });
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
        Loading...
      </p>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto text-[var(--color-text-muted)]/20 mb-4"
          />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-sm font-mono text-[var(--color-text-muted)]">
            T1/T2 clearance required for content admin.
          </p>
        </div>
      </div>
    );
  }

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
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
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
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {palettes?.length ?? 0} total · only one active at a time
          </p>
        </div>
        <Link
          href="/student/dashboard/admin/content/palettes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New Palette
        </Link>
      </div>

      {activateMessage ? (
        <div
          className={`mb-4 p-3 rounded-md text-xs font-mono border ${
            activateMessage.kind === "ok"
              ? "bg-green-400/10 border-green-400/30 text-green-400"
              : "bg-red-400/10 border-red-400/30 text-red-400"
          }`}
        >
          {activateMessage.text}
        </div>
      ) : null}

      {fetchError && (
        <p className="mb-4 text-xs font-mono text-[var(--color-text-muted)]">
          Supabase read failed ({fetchError}) — showing bundled defaults.
        </p>
      )}

      {palettes === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading palettes...
        </p>
      ) : palettes.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
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
                  <p className="text-[0.65rem] font-mono text-[var(--color-accent-cyan)]">
                    {p.slug}
                  </p>
                </div>
                <span
                  className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
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
                      <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)]">
                        {key}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[0.65rem] font-mono text-[var(--color-text-muted)] space-y-0.5 mb-3">
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
                  className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline"
                >
                  <Pencil size={12} /> Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleSetActive(p.id)}
                  disabled={p.active || activating !== null}
                  className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-brand-blue)] hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                >
                  <Check size={12} />
                  {p.active
                    ? "Active"
                    : activating === p.id
                      ? "Activating..."
                      : "Set Active"}
                </button>
                <Link
                  href={`/student/dashboard/admin/content/palettes/${p.id}/history`}
                  className="text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors"
                >
                  History
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
