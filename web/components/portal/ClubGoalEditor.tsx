"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_CAPS, DEFAULT_TARGET, DEFAULT_WEIGHTS } from "@/lib/progression/defaults";
import { validateGoalDraft } from "@/lib/progression/goals";
import { DECOR_SETS } from "@/lib/progression/seasonal";
import { torontoInstant, torontoParts } from "@/lib/time";
import { DELIVERY_KINDS, type ClubGoal, type DeliveryKind, type GoalType, type WeightKey } from "@/lib/progression/types";
import { DraftBar, Field, inputCls, listToText, textToList, Toggle, useDraftFlow } from "./ProgressionAdminShared";

// ─── ClubGoalEditor ─────────────────────────────────────────────────────────
// Server-wide goal: type (story one-time / seasonal yearly), target, weights
// per source, per-member caps, accepted deliveries, window, unlocks and the
// completion letter sent to every member. `seasonal` is the Seasonal Events
// editor: the same goal, type fixed to seasonal (row 212; specs/seasonal-events.md),
// plus its event: decoration set, fishing tourney, limited-time catches, the
// items every member gets on completion, GENESIS posters. Windows are Toronto time.

const GOALS = "/student/dashboard/admin/content/goals";
export const SEASONAL = "/student/dashboard/admin/content/seasonal";
const WEIGHT_LABELS: Record<WeightKey, string> = {
  coins: "Coin (per 1)",
  material: "Material (per item)",
  specimen: "Specimen (per item)",
  event: "Event QR check-in",
  bounty: "Completed bounty",
  admin: "Admin-logged (per pt)",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const t = torontoParts(new Date(iso));
  return `${t.date}T${pad(t.hour)}:${pad(t.minute)}`;
};
const fromLocalInput = (v: string) => (v ? torontoInstant(v.slice(0, 10), Number(v.slice(11, 13)) + Number(v.slice(14, 16)) / 60).toISOString() : null);

export default function ClubGoalEditor({ mode, initial, seasonal = false }: { mode: "new" | "edit"; initial?: Partial<ClubGoal> | null; seasonal?: boolean }) {
  const BACK = seasonal ? SEASONAL : GOALS;
  const noun = seasonal ? "Seasonal Event" : "Club Goal";
  const [form, setForm] = useState(() => ({
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    goal_type: (seasonal ? "seasonal" : (initial?.goal_type ?? "story")) as GoalType,
    target_points: initial?.target_points ?? DEFAULT_TARGET,
    weights: { ...DEFAULT_WEIGHTS, ...(initial?.weights ?? {}) },
    caps: { ...DEFAULT_CAPS, ...(initial?.caps ?? {}) },
    accepts: (initial?.accepts ?? ["coins"]) as DeliveryKind[],
    window_start: toLocalInput(initial?.window_start),
    window_end: toLocalInput(initial?.window_end),
    unlocks: listToText(initial?.unlocks),
    monument_key: initial?.monument_key ?? "plaza",
    completion_letter_subject: initial?.completion_letter_subject ?? "",
    completion_letter_body: initial?.completion_letter_body ?? "",
    position: initial?.position ?? 10,
    active: initial?.active ?? true,
    decor: initial?.event?.decor ?? "",
    tourney: initial?.event?.tourney ?? false,
    catches: listToText(initial?.event?.catches),
    rewards: listToText(initial?.event?.rewards),
    posters: (initial?.event?.posters ?? []).join("\n"),
  }));
  const flow = useDraftFlow("club_goals", mode === "edit" ? initial?.id : undefined, BACK);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const draft = useMemo(
    () => ({
      slug: form.slug.trim(),
      title: form.title.trim(),
      summary: form.summary.trim(),
      goal_type: form.goal_type,
      target_points: Math.floor(Number(form.target_points)),
      weights: Object.fromEntries(Object.entries(form.weights).map(([k, v]) => [k, Number(v)])),
      caps: { member_total: Math.floor(Number(form.caps.member_total)), delivery: Math.floor(Number(form.caps.delivery)) },
      accepts: form.accepts,
      window_start: fromLocalInput(form.window_start),
      window_end: fromLocalInput(form.window_end),
      unlocks: textToList(form.unlocks),
      monument_key: form.monument_key.trim() || "plaza",
      completion_letter_subject: form.completion_letter_subject.trim(),
      completion_letter_body: form.completion_letter_body.trim(),
      position: Math.floor(Number(form.position)),
      active: form.active,
      event: {
        decor: form.decor || null,
        tourney: form.tourney,
        catches: textToList(form.catches),
        rewards: textToList(form.rewards),
        posters: form.posters.split("\n").map((t) => t.trim()).filter(Boolean),
      },
    }),
    [form],
  );
  const errors = validateGoalDraft(draft);
  const w = form.weights;
  const checkinsToFill = w.event > 0 ? Math.ceil(form.target_points / w.event) : null;

  return (
    <div>
      <Link href={BACK} className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to {seasonal ? "Seasonal Events" : "Club Goals"}
      </Link>
      <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">{mode === "new" ? `New ${noun}` : `Edit: ${initial?.title ?? noun}`}</h1>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">Default size: about two weeks for 20–30 active members (~30 check-ins or ~15,000 coins).</p>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_120px]">
          <Field label="Slug"><input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} spellCheck={false} /></Field>
          <Field label="Type" hint="Story: one-time. Seasonal: repeats yearly.">
            <select className={inputCls} value={form.goal_type} disabled={seasonal} onChange={(e) => set("goal_type", e.target.value as GoalType)}>
              <option value="story">Story (one-time)</option>
              <option value="seasonal">Seasonal (yearly)</option>
            </select>
          </Field>
          <Field label="Order" hint="Story goals run in this order"><input className={inputCls} type="number" value={form.position} onChange={(e) => set("position", Number(e.target.value))} /></Field>
        </div>
        <Field label="Title"><input className={inputCls} value={form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Summary"><textarea className={`${inputCls} min-h-[70px]`} value={form.summary} maxLength={500} onChange={(e) => set("summary", e.target.value)} /></Field>
        <Field label="Target (points)" hint={checkinsToFill ? `≈ ${checkinsToFill} event check-ins or ${Math.ceil(form.target_points / Math.max(w.coins, 0.001)).toLocaleString()} coins` : undefined}>
          <input className={inputCls} type="number" min={1} value={form.target_points} onChange={(e) => set("target_points", Number(e.target.value))} />
        </Field>
        <fieldset>
          <legend className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Weights (points per unit)</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(WEIGHT_LABELS) as WeightKey[]).map((k) => (
              <Field key={k} label={WEIGHT_LABELS[k]}>
                <input className={inputCls} type="number" min={0} step="any" value={form.weights[k]} onChange={(e) => set("weights", { ...form.weights, [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Per-member cap (all sources)" hint="Admin-logged credit is not capped.">
            <input className={inputCls} type="number" min={0} value={form.caps.member_total} onChange={(e) => set("caps", { ...form.caps, member_total: Number(e.target.value) })} />
          </Field>
          <Field label="Per-member cap (in-game deliveries)">
            <input className={inputCls} type="number" min={0} value={form.caps.delivery} onChange={(e) => set("caps", { ...form.caps, delivery: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Accepts deliveries of">
          <div className="flex gap-4">
            {DELIVERY_KINDS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                <input type="checkbox" checked={form.accepts.includes(k)} onChange={(e) => set("accepts", e.target.checked ? [...form.accepts, k] : form.accepts.filter((x) => x !== k))} />
                {k}
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Window start (Toronto)" hint={form.goal_type === "seasonal" ? "Required; repeats on this date and time yearly" : "Optional"}>
            <input className={inputCls} type="datetime-local" value={form.window_start} onChange={(e) => set("window_start", e.target.value)} />
          </Field>
          <Field label="Window end (Toronto)">
            <input className={inputCls} type="datetime-local" value={form.window_end} onChange={(e) => set("window_end", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Unlocks" hint="Comma-separated landmarks/regions, e.g. cafe, study_tables">
            <input className={inputCls} value={form.unlocks} onChange={(e) => set("unlocks", e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Monument"><input className={inputCls} value={form.monument_key} onChange={(e) => set("monument_key", e.target.value)} spellCheck={false} /></Field>
        </div>
        <Field label="Completion letter subject"><input className={inputCls} value={form.completion_letter_subject} maxLength={120} onChange={(e) => set("completion_letter_subject", e.target.value)} /></Field>
        <Field label="Completion letter" hint="Sent to every active member once, when the goal completes.">
          <textarea className={`${inputCls} min-h-[90px]`} value={form.completion_letter_body} maxLength={2000} onChange={(e) => set("completion_letter_body", e.target.value)} />
        </Field>
        {form.goal_type === "seasonal" ? (
          <fieldset className="space-y-4 border-t border-[var(--glass-border)] pt-5">
            <legend className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Event (while the window is open)</legend>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Decorations" hint="What goes up around the plaza for the window">
                <select className={inputCls} value={form.decor} onChange={(e) => set("decor", e.target.value)}>
                  <option value="">None</option>
                  {Object.entries(DECOR_SETS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </Field>
              <Toggle label="Fishing tourney" hint="Catches during the window go on the tourney board; top half shown by name, the rest only see their own place." checked={form.tourney} onChange={(v) => set("tourney", v)} />
            </div>
            <Field label="Limited-time catches" hint="Species keys that only bite during this event, e.g. fish_sturgeon">
              <input className={inputCls} value={form.catches} onChange={(e) => set("catches", e.target.value)} spellCheck={false} />
            </Field>
            <Field label="Reward items" hint="Shop item slugs every active member gets once when the club completes this goal, e.g. acc-flower-crown, furn-beach-towel. Cosmetics only.">
              <input className={inputCls} value={form.rewards} onChange={(e) => set("rewards", e.target.value)} spellCheck={false} />
            </Field>
            <Field label="Project posters" hint="One title per line (GENESIS week). The stage shows the first two; the poster sheet lists them all.">
              <textarea className={`${inputCls} min-h-[70px]`} value={form.posters} onChange={(e) => set("posters", e.target.value)} />
            </Field>
          </fieldset>
        ) : null}
        <Toggle label="Active" hint="Inactive goals are hidden and take no contributions." checked={form.active} onChange={(v) => set("active", v)} />
        {errors.length ? <ul className="text-xs text-[var(--gui-danger)] list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      </div>
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
    </div>
  );
}
