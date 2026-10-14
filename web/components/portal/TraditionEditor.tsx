"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/gui";
import { CONTENT_LABEL, TRADITION_CONTENT, monthDay, validateTraditionDraft, windowLabel, type TraditionContent, type TraditionContentKind } from "@/lib/content/traditions";
import { backLinkCls, DraftBar, Field, FixList, inputCls, Toggle, useDraftFlow } from "./ProgressionAdminShared";

// ─── TraditionEditor ────────────────────────────────────────────────────────
// A traditions row (the traditions calendar, lib/content/traditions.ts; design principle 8): a yearly window on the
// Toronto calendar and what it switches on in the island. Same draft → publish flow and version history as the other
// content editors.

const BACK = "/student/dashboard/admin/content/traditions";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface TraditionRow {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  content: TraditionContent;
  position: number;
  active: boolean;
}

/** A month and a day, as MM-DD. */
function DayPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const md = monthDay(value) ?? 101, m = Math.floor(md / 100), d = md % 100;
  const set = (mm: number, dd: number) => onChange(`${String(mm).padStart(2, "0")}-${String(Math.min(dd, DAYS[mm - 1])).padStart(2, "0")}`);
  return <div className="grid grid-cols-[1fr_88px] gap-2">
    <select className={inputCls} aria-label={`${label} month`} value={m} onChange={(e) => set(Number(e.target.value), d)}>
      {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
    </select>
    <select className={inputCls} aria-label={`${label} day`} value={d} onChange={(e) => set(m, Number(e.target.value))}>
      {Array.from({ length: DAYS[m - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
    </select>
  </div>;
}

export default function TraditionEditor({ mode, initial }: { mode: "new" | "edit"; initial?: TraditionRow | null }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id ?? "",
    title: initial?.title ?? "",
    starts_on: initial?.starts_on ?? "10-25",
    ends_on: initial?.ends_on ?? "11-01",
    content: { ...(initial?.content ?? {}) } as TraditionContent,
    position: initial?.position ?? 10,
    active: initial?.active ?? true,
  }));
  const flow = useDraftFlow("traditions", mode === "edit" ? initial?.id : undefined, BACK);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const draft = useMemo(() => ({
    id: form.id.trim(),
    title: form.title.trim(),
    starts_on: form.starts_on,
    ends_on: form.ends_on,
    content: Object.fromEntries(TRADITION_CONTENT.filter((k) => form.content[k]).map((k) => [k, true])),
    position: Math.floor(Number(form.position)),
    active: form.active,
  }), [form]);
  const errors = validateTraditionDraft(draft);
  const wraps = (monthDay(form.ends_on) ?? 0) < (monthDay(form.starts_on) ?? 0);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={BACK} className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden /> Back to traditions
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-[var(--gui-ink-strong)]">{mode === "new" ? "New tradition" : `Edit: ${initial?.title ?? "Tradition"}`}</h1>
      <p className="text-sm text-[var(--gui-muted)] mt-1 mb-6">Comes back every year on the same days (Toronto time). While it runs, the island switches on what you pick below, for everyone at once.</p>

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_120px]">
          <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={60} /></Field>
          <Field label="Id" hint={mode === "edit" ? "Fixed once published (its costumes are tagged with it)" : "Lowercase with dashes"}>
            <input className={inputCls} value={form.id} disabled={mode === "edit"} onChange={(e) => set("id", e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Order"><input className={inputCls} type="number" value={form.position} onChange={(e) => set("position", Number(e.target.value))} /></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Starts"><DayPicker label="Start" value={form.starts_on} onChange={(v) => set("starts_on", v)} /></Field>
          <Field label="Ends" hint={wraps ? "Ends before it starts: it runs over New Year" : "The last day it runs"}><DayPicker label="End" value={form.ends_on} onChange={(v) => set("ends_on", v)} /></Field>
        </div>
        <p className="text-sm font-bold text-[var(--gui-ink-2)]">Runs {windowLabel(form)}, both days included.</p>
        <Field label="What it switches on">
          <div className="space-y-3">
            {TRADITION_CONTENT.map((k: TraditionContentKind) => (
              <Toggle key={k} label={CONTENT_LABEL[k].label} hint={CONTENT_LABEL[k].hint} checked={!!form.content[k]} onChange={(v) => set("content", { ...form.content, [k]: v })} />
            ))}
          </div>
        </Field>
        <Toggle label="Active" hint="An inactive tradition never runs, whatever the date." checked={form.active} onChange={(v) => set("active", v)} />
        <FixList errors={errors} />
      </Card>
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
    </div>
  );
}
