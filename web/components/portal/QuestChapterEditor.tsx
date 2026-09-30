"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STEP_KEYS, validateChapterDraft } from "@/lib/progression/chapters";
import type { ChapterRequirement, QuestChapter } from "@/lib/progression/types";
import { DraftBar, Field, inputCls, listToText, textToList, Toggle, useDraftFlow } from "./ProgressionAdminShared";

// ─── QuestChapterEditor ─────────────────────────────────────────────────────
// Main quest chapter copy, order, regions, skip rule and (for club_goal
// chapters) the goal it points at. The conditions themselves are code
// (lib/progression/chapters.ts); admins pick one of the three requirement types.

const BACK = "/student/dashboard/admin/content/chapters";
const REQUIREMENTS: { value: ChapterRequirement; label: string }[] = [
  { value: "settle_in", label: "Settle in (claim plot, first catch, donate, report)" },
  { value: "club_goal", label: "Club goal (completes when the club goal does)" },
  { value: "oracle_trial", label: "Oracle quiz + level-10 subclass" },
];

export default function QuestChapterEditor({ mode, initial, goalSlugs }: { mode: "new" | "edit"; initial?: Partial<QuestChapter> | null; goalSlugs: string[] }) {
  const [form, setForm] = useState(() => ({
    slug: initial?.slug ?? "",
    position: initial?.position ?? 5,
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    requirement: (initial?.requirement ?? "settle_in") as ChapterRequirement,
    goal_slug: initial?.goal_slug ?? "",
    step_copy: { ...(initial?.step_copy ?? {}) } as Record<string, { label: string; hint?: string }>,
    unlocks_regions: listToText(initial?.unlocks_regions),
    completion_letter: initial?.completion_letter ?? "",
    skippable_max_tier: initial?.skippable_max_tier ?? 5,
    reward_coins: initial?.reward_coins ?? 0,
    active: initial?.active ?? true,
  }));
  const flow = useDraftFlow("quest_chapters", mode === "edit" ? initial?.id : undefined, BACK);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const draft = useMemo(() => {
    const keys = STEP_KEYS[form.requirement];
    const step_copy: Record<string, { label: string; hint?: string }> = {};
    for (const k of keys) {
      const c = form.step_copy[k];
      if (c?.label?.trim()) step_copy[k] = c.hint?.trim() ? { label: c.label.trim(), hint: c.hint.trim() } : { label: c.label.trim() };
    }
    return {
      slug: form.slug.trim(),
      position: Number(form.position),
      title: form.title.trim(),
      summary: form.summary.trim(),
      requirement: form.requirement,
      goal_slug: form.requirement === "club_goal" ? form.goal_slug || null : null,
      step_copy,
      unlocks_regions: textToList(form.unlocks_regions),
      completion_letter: form.completion_letter.trim(),
      skippable_max_tier: form.requirement === "club_goal" ? 0 : Number(form.skippable_max_tier),
      reward_coins: Math.max(0, Math.floor(Number(form.reward_coins) || 0)),
      active: form.active,
    };
  }, [form]);
  const errors = validateChapterDraft(draft);

  return (
    <div>
      <Link href={BACK} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Main Quest
      </Link>
      <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">{mode === "new" ? "New Chapter" : `Edit: ${initial?.title ?? "Chapter"}`}</h1>
      <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1 mb-6">Drafts stay invisible to members until published. Every publish is versioned.</p>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <div className="grid gap-5 md:grid-cols-[1fr_120px]">
          <Field label="Slug" hint="kebab-case, e.g. settle-in">
            <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Order" hint="1 = first chapter">
            <input className={inputCls} type="number" min={1} max={50} value={form.position} onChange={(e) => set("position", Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Title">
          <input className={inputCls} value={form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Summary" hint="Shown in the journal under the title.">
          <textarea className={`${inputCls} min-h-[70px]`} value={form.summary} maxLength={500} onChange={(e) => set("summary", e.target.value)} />
        </Field>
        <Field label="Requirement" hint="What finishes the chapter. New requirement types need code.">
          <select className={inputCls} value={form.requirement} onChange={(e) => set("requirement", e.target.value as ChapterRequirement)}>
            {REQUIREMENTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        {form.requirement === "club_goal" ? (
          <Field label="Club goal" hint="The chapter shows this goal and completes when it does.">
            <select className={inputCls} value={form.goal_slug} onChange={(e) => set("goal_slug", e.target.value)}>
              <option value="">Pick a goal…</option>
              {goalSlugs.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        ) : null}
        <fieldset className="space-y-3">
          <legend className="block text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Step copy</legend>
          {STEP_KEYS[form.requirement].map((k) => (
            <div key={k} className="grid gap-2 md:grid-cols-[140px_1fr_1fr] items-center">
              <code className="text-xs text-[var(--color-accent-cyan)]">{k}</code>
              <input className={inputCls} placeholder="Label" value={form.step_copy[k]?.label ?? ""} onChange={(e) => set("step_copy", { ...form.step_copy, [k]: { ...form.step_copy[k], label: e.target.value } })} />
              <input className={inputCls} placeholder="Hint (optional)" value={form.step_copy[k]?.hint ?? ""} onChange={(e) => set("step_copy", { ...form.step_copy, [k]: { label: form.step_copy[k]?.label ?? "", hint: e.target.value } })} />
            </div>
          ))}
        </fieldset>
        <Field label="Opens regions" hint="Comma-separated: village_core, cafe, study_tables, museum, woods, cliffs, ruins_gate">
          <input className={inputCls} value={form.unlocks_regions} onChange={(e) => set("unlocks_regions", e.target.value)} spellCheck={false} />
        </Field>
        <Field label="Completion letter" hint="Sent to the member's mailbox when they finish. Leave empty for none.">
          <textarea className={`${inputCls} min-h-[70px]`} value={form.completion_letter} maxLength={2000} onChange={(e) => set("completion_letter", e.target.value)} />
        </Field>
        <Field label="Skippable by" hint="Members at this tier or above (lower number) can skip in one click. Club-goal chapters can't be skipped.">
          <select className={inputCls} value={form.skippable_max_tier} onChange={(e) => set("skippable_max_tier", Number(e.target.value))}>
            <option value={0}>Nobody</option>
            <option value={1}>T1 only</option>
            <option value={2}>T1–T2</option>
            <option value={3}>T1–T3</option>
            <option value={4}>T1–T4</option>
            <option value={5}>Everyone (default for onboarding)</option>
          </select>
        </Field>
        <Field label="Reward (play coins)" hint="Paid once when a member completes the chapter; skipping pays nothing. 0 = none.">
          <input className={inputCls} type="number" min={0} max={5000} value={form.reward_coins} onChange={(e) => set("reward_coins", Number(e.target.value))} />
        </Field>
        <Toggle label="Active" hint="Inactive chapters are hidden from the journal." checked={form.active} onChange={(v) => set("active", v)} />
        {errors.length ? <ul className="text-[0.65rem] font-mono text-red-400 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      </div>
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
    </div>
  );
}
