"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STEP_KEYS, validateChapterDraft } from "@/lib/progression/chapters";
import type { ChapterRequirement, QuestChapter } from "@/lib/progression/types";
import { CurrencyIcon } from "@/components/economy/Amount";
import { Badge, Card, Select } from "@/components/gui";
import { backLinkCls, DraftBar, Field, FixList, inputCls, listToText, textToList, Toggle, useDraftFlow } from "./ProgressionAdminShared";

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
    <div className="mx-auto w-full max-w-3xl">
      <Link href={BACK} className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden /> Back to the main quest
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-[var(--gui-ink-strong)]">{mode === "new" ? "New chapter" : `Edit: ${initial?.title ?? "Chapter"}`}</h1>
      <p className="text-sm text-[var(--gui-muted)] mt-1 mb-6">Drafts stay invisible to members until published. Every publish is versioned.</p>

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
        <div className="grid gap-5 md:grid-cols-[1fr_120px]">
          <Field label="Slug" hint="Lowercase with dashes, e.g. settle-in">
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
          <Select className="w-full" value={form.requirement} onChange={(e) => set("requirement", e.target.value as ChapterRequirement)}>
            {REQUIREMENTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        {form.requirement === "club_goal" ? (
          <Field label="Club goal" hint="The chapter shows this goal and completes when it does.">
            <Select className="w-full" value={form.goal_slug} onChange={(e) => set("goal_slug", e.target.value)}>
              <option value="">Pick a goal…</option>
              {goalSlugs.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
        ) : null}
        <fieldset className="space-y-3">
          <legend className="block mb-1.5 text-[15px] font-extrabold text-[var(--gui-ink-strong)]">Step copy</legend>
          {STEP_KEYS[form.requirement].map((k) => (
            <div key={k} className="grid gap-2 md:grid-cols-[140px_1fr_1fr] items-center">
              <span><Badge>{k}</Badge></span>
              <input className={inputCls} placeholder="Label" aria-label={`${k}: label`} value={form.step_copy[k]?.label ?? ""} onChange={(e) => set("step_copy", { ...form.step_copy, [k]: { ...form.step_copy[k], label: e.target.value } })} />
              <input className={inputCls} placeholder="Hint (optional)" aria-label={`${k}: hint`} value={form.step_copy[k]?.hint ?? ""} onChange={(e) => set("step_copy", { ...form.step_copy, [k]: { label: form.step_copy[k]?.label ?? "", hint: e.target.value } })} />
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
          <Select className="w-full" value={form.skippable_max_tier} onChange={(e) => set("skippable_max_tier", Number(e.target.value))}>
            <option value={0}>Nobody</option>
            <option value={1}>T1 only</option>
            <option value={2}>T1–T2</option>
            <option value={3}>T1–T3</option>
            <option value={4}>T1–T4</option>
            <option value={5}>Everyone (default for onboarding)</option>
          </Select>
        </Field>
        <Field label="Reward in TC" hint="Paid once when a member completes the chapter; skipping pays nothing. 0 = none.">
          <div className="flex items-center gap-2.5">
            <input className={inputCls} type="number" min={0} max={5000} aria-label="Reward in TC" value={form.reward_coins} onChange={(e) => set("reward_coins", Number(e.target.value))} />
            <CurrencyIcon currency="coins" size={28} />
          </div>
        </Field>
        <Toggle label="Active" hint="Inactive chapters are hidden from the journal." checked={form.active} onChange={(v) => set("active", v)} />
        <FixList errors={errors} />
      </Card>
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
    </div>
  );
}
