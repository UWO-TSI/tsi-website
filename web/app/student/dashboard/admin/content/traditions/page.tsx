"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarHeart, History, Pencil, Plus } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { Badge, Card, Empty, ErrorNote, Loading } from "@/components/gui";
import type { TraditionRow } from "@/components/portal/TraditionEditor";
import { CONTENT_LABEL, TRADITION_CONTENT, traditionOpen, windowLabel } from "@/lib/content/traditions";
import { createClient } from "@/lib/supabase/client";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

// Traditions (the traditions calendar, design principle 8): every row, inactive ones too, and whether it runs today.
export default function AdminTraditionsPage() {
  const [rows, setRows] = useState<TraditionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    void createClient().from("traditions").select("*").order("position").then(({ data, error }) => {
      setRows((data ?? []) as TraditionRow[]);
      setError(error ? "The traditions table isn’t there yet (is the traditions migration applied?)." : null);
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
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Traditions</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">{rows?.length ?? 0} traditions · they come back every year, on Toronto days</p>
          </div>
          <Link href="/student/dashboard/admin/content/traditions/new" className={buttonLinkCls} data-size="sm">
            <Plus size={16} aria-hidden /> New tradition
          </Link>
        </div>
        {error ? <ErrorNote className="mb-4">{error}</ErrorNote> : null}
        {rows === null ? (
          <Loading label="Getting the calendar…" />
        ) : rows.length === 0 ? (
          error ? null : (
            <Empty icon={<CalendarHeart size={32} />} title="No traditions yet">
              Add one and the island dresses for it every year on its days.
            </Empty>
          )
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["#", "Tradition", "When", "Switches on", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{t.position}</td>
                    <td className="px-4 py-3 font-extrabold text-[var(--gui-ink-strong)]">{t.title}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink)] whitespace-nowrap">{windowLabel(t)}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{TRADITION_CONTENT.filter((k) => t.content?.[k]).map((k) => CONTENT_LABEL[k].label).join(", ")}</td>
                    <td className="px-4 py-3">{!t.active ? <Badge>Inactive</Badge> : traditionOpen(t, now) ? <Badge tone="success">Running now</Badge> : <Badge>Waiting</Badge>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/student/dashboard/admin/content/traditions/${t.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/traditions/${t.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
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
