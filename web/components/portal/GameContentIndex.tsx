"use client";

/**
 * Admin index of every game content area (specs/admin-pass.md): what it
 * holds, when it was last published and by whom (content_drafts), plus the
 * game's staff tools. T1/T2 only, like everything under /admin.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card } from "@/components/gui";
import { thCls } from "./ProgressionAdminShared";

const A = "/student/dashboard/admin";
const AREAS = [
  { title: "Residents", what: "Roster, post, tone, dialogue lines, schedule", table: "npc_personas", href: `${A}/content/npcs` },
  { title: "Main quest", what: "Chapter copy, order, regions, skip rules", table: "quest_chapters", href: `${A}/content/chapters` },
  { title: "Club goals", what: "Story goals: targets, weights, caps, letters", table: "club_goals", seasonal: false, href: `${A}/content/goals` },
  { title: "Seasonal events", what: "Yearly goals: window, target, unlocks", table: "club_goals", seasonal: true, href: `${A}/content/seasonal` },
  { title: "Recipes", what: "Workbench recipes, ingredients, where learned", table: "crafting_recipes", href: `${A}/content/recipes` },
  { title: "Shop catalogue", what: "Items, prices, specials pool, merch stock", table: "shop_items", href: `${A}/content/shop` },
  { title: "Seasonal palettes", what: "Island colours per season", table: "seasonal_palettes", href: `${A}/content/palettes` },
  { title: "Emotes", what: "Emote types and unlocks", table: "emote_types", href: `${A}/content/emotes` },
] as const;
const TOOLS = [
  { title: "Members", what: "Mark TSI members, tiers, active and alumni", href: `${A}/members` },
  { title: "Moderation queue", what: "Reported names, notes and table chat", href: `${A}/moderation` },
  { title: "Merch pickups", what: "Hand over reserved merch, or cancel with a refund", href: `${A}/merch` },
  { title: "Activity log", what: "Every publish, with rollback", href: `${A}/content/log` },
];

interface Published { table_name: string; published_at: string; author: string | null; goal_type: string | null }

export default function GameContentIndex() {
  const [last, setLast] = useState<Map<string, Published> | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [openReports, setOpenReports] = useState<number | null>(null);

  useEffect(() => {
    const db = createClient();
    void (async () => {
      const { data } = await db.from("content_drafts").select("table_name, published_at, author, goal_type:draft_data->>goal_type").eq("status", "published").order("published_at", { ascending: false }).limit(500);
      const latest = new Map<string, Published>();
      for (const row of (data ?? []) as Published[]) {
        const key = row.table_name === "club_goals" ? `club_goals:${row.goal_type === "seasonal"}` : row.table_name;
        if (!latest.has(key)) latest.set(key, row);
      }
      const ids = [...new Set([...latest.values()].map((r) => r.author).filter((x): x is string => !!x))];
      const { data: people } = ids.length ? await db.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
      setNames(new Map(((people ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name])));
      setLast(latest);
      const queue = await fetch("/api/admin/moderation").then((r) => r.json()).catch(() => null);
      setOpenReports(queue?.ok ? queue.names.length + queue.letters.length + queue.chat.length : 0);
    })();
  }, []);

  const published = (area: (typeof AREAS)[number]) => {
    const row = last?.get("seasonal" in area ? `club_goals:${area.seasonal}` : area.table);
    if (!last) return "…";
    if (!row) return "Never";
    return `${new Date(row.published_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" })} · ${row.author ? (names.get(row.author) ?? "Member") : "—"}`;
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-extrabold text-[var(--gui-ink-strong)] mb-3">Game content</h2>
      <Card className="overflow-x-auto mb-4" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--gui-paper-warm)]">{["Area", "Holds", "Last published"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {AREAS.map((a) => (
              <tr key={a.title} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                <td className="px-4 py-3 whitespace-nowrap"><Link href={a.href} className="font-extrabold text-[var(--gui-sage)] hover:underline">{a.title}</Link></td>
                <td className="px-4 py-3 text-[13px] text-[var(--gui-ink-2)]">{a.what}</td>
                <td className="px-4 py-3 text-[13px] font-semibold text-[var(--gui-ink)] whitespace-nowrap">{published(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {TOOLS.map((t) => (
          <Link key={t.title} href={t.href} className="block rounded-[18px] transition-transform hover:-translate-y-0.5">
            <Card className="h-full">
              <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold text-[var(--gui-ink-strong)] mb-1">
                {t.title}
                {t.title === "Moderation queue" && openReports ? <Badge tone="danger">{openReports} open</Badge> : null}
              </h3>
              <p className="text-[13px] text-[var(--gui-ink-2)]">{t.what}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
