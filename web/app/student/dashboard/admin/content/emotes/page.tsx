"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import type { EmoteType } from "@/lib/content/types";

export default function AdminContentEmotesPage() {
  const [emotes, setEmotes] = useState<EmoteType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Admin listing includes inactive emotes so they can be re-enabled, so we
  // query directly rather than reuse useEmoteTypes() which filters active=true.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("emote_types")
          .select(
            "id, slug, display_name, animation_key, icon_url, unlock_condition, active, created_at",
          )
          .order("created_at", { ascending: false });
        if (!cancelled) setEmotes((data ?? []) as unknown as EmoteType[]);
      } catch {
        if (!cancelled) setEmotes([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              Emotes
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {emotes.length} total · content_pipeline.emote_types
            </p>
          </div>
          <Link
            href="/student/dashboard/admin/content/emotes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Emote
          </Link>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">
            Loading emotes...
          </p>
        ) : emotes.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">
            No emotes defined yet.
          </p>
        ) : (
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Slug
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Display Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Animation
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Unlock
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Active
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Icon
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Created
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {emotes.map((emote) => (
                  <tr
                    key={emote.id}
                    className="border-b border-[var(--glass-border)]/40 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-xs text-[var(--color-accent-cyan)]">
                      {emote.slug}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {emote.display_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {emote.animation_key}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {emote.unlock_condition ?? (
                        <span className="text-[var(--color-text-muted)]/50">
                          — always —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs uppercase px-2 py-0.5 rounded ${
                          emote.active
                            ? "text-[var(--gui-success)] bg-[var(--gui-success-soft)]"
                            : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                        }`}
                      >
                        {emote.active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {emote.icon_url ? (
                        <span className="text-[var(--color-text-soft)]">
                          {emote.icon_url.split("/").pop()}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]/50">
                          — none —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {new Date(emote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/student/dashboard/admin/content/emotes/${emote.id}/edit`}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-cyan)] hover:underline"
                      >
                        <Pencil size={12} /> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGate>
  );
}
