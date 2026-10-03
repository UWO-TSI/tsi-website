"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Smile } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import type { EmoteType } from "@/lib/content/types";
import { Badge, Card, Empty, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

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
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden />
          Back to admin
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
              Emotes
            </h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">
              {emotes.length} emotes, inactive ones included
            </p>
          </div>
          <Link
            href="/student/dashboard/admin/content/emotes/new"
            className={BUTTON_LINK}
            data-size="sm"
          >
            <Plus size={16} aria-hidden /> New emote
          </Link>
        </div>

        {isLoading ? (
          <Loading label="Getting the emotes…" />
        ) : emotes.length === 0 ? (
          <Empty icon={<Smile size={32} />} title="No emotes yet">
            Add one and members can use it on the island.
          </Empty>
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  <th className={TH}>Emote</th>
                  <th className={TH}>Animation</th>
                  <th className={TH}>Unlocks</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Icon</th>
                  <th className={TH}>Added</th>
                  <th className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {emotes.map((emote) => (
                  <tr
                    key={emote.id}
                    className="border-t-2 border-dashed border-[var(--gui-paper-edge)]"
                  >
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-[var(--gui-ink-strong)]">
                        {emote.display_name}
                      </span>
                      <div className="text-xs text-[var(--gui-muted)]">
                        {emote.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                      {emote.animation_key}
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                      {emote.unlock_condition ?? "Always"}
                    </td>
                    <td className="px-4 py-3">
                      {emote.active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge>Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                      {emote.icon_url ? emote.icon_url.split("/").pop() : "None"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink-2)]">
                      {day(emote.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/student/dashboard/admin/content/emotes/${emote.id}/edit`}
                        className="inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"
                      >
                        <Pencil size={14} aria-hidden /> Edit
                      </Link>
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
