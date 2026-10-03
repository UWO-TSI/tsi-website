"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NPCPersona, SpawnZone } from "@/lib/content/types";
import ImageUploadButton from "@/components/portal/ImageUploadButton";
import { MAX_STOPS, RESIDENT_ANCHORS, RESIDENT_POSTS, validateResidentDraft, type ResidentPost, type ResidentSchedule, type ResidentStop } from "@/lib/content/residents";
import { HOME_LANDMARKS, ROUTINE_SPECIAL } from "@/lib/game/residentRoutine";
import { LANDMARK_INFO, type LandmarkId } from "@/lib/game/defaultIsland";
import { ISLAND_PHASES } from "@/lib/game/islandTime";
import { DraftBar, Field, inputCls, Toggle, useDraftFlow } from "./ProgressionAdminShared";

// ─── NPCEditor (Residents) ──────────────────────────────────────────────────
// Shared form component used by both /new and /[id]/edit. Renders all NPC
// fields plus the resident roster fields (post, bio, tone, schedule; rows 122,
// 218), validates with the server's validateResidentDraft, then drives the
// shared draft/preview/publish flow.
//
// `mode = "new"` — slug uniqueness is enforced; row_id sent as null.
// `mode = "edit"` — initial row + id loaded by the page wrapper; slug
//                   uniqueness skips the current slug.

const SPAWN_ZONES: SpawnZone[] = ["courtyard", "shop", "temple", "roaming"];
const POST_LABELS: Record<ResidentPost, string> = {
  hq_lead: "HQ lead", shopkeeper: "Shopkeeper", cafe_owner: "Café owner", museum_curator: "Museum curator",
  wharf_keeper: "Wharf keeper", oracle_keeper: "Oracle keeper", workshop_crafter: "Workshop crafter", villager: "Villager",
};

/** Routine stops: the map's anchors, then a bench and home. */
const STOP_OPTIONS = [...Object.entries(RESIDENT_ANCHORS), ...Object.entries(ROUTINE_SPECIAL)].map(([key, a]) => [key, a.label] as const);

interface FormState {
  slug: string;
  display_name: string;
  spawn_zone: SpawnZone;
  is_permanent: boolean;
  persona_prompt: string;
  canned_dialogue: string[];
  sprite_url: string;
  active: boolean;
  post: string;
  bio: string;
  tone: string;
  schedule: ResidentSchedule;
}

interface NPCEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<NPCPersona> | null;
}

const EMPTY_FORM: FormState = {
  slug: "",
  display_name: "",
  spawn_zone: "courtyard",
  is_permanent: false,
  persona_prompt: "",
  canned_dialogue: [],
  sprite_url: "",
  active: true,
  post: "",
  bio: "",
  tone: "",
  schedule: {},
};

function toFormState(row: Partial<NPCPersona> | null | undefined): FormState {
  if (!row) return { ...EMPTY_FORM };
  return {
    slug: row.slug ?? "",
    display_name: row.display_name ?? "",
    spawn_zone: (row.spawn_zone as SpawnZone) ?? "courtyard",
    is_permanent: Boolean(row.is_permanent),
    persona_prompt: row.persona_prompt ?? "",
    canned_dialogue: Array.isArray(row.canned_dialogue)
      ? [...row.canned_dialogue]
      : [],
    sprite_url: row.sprite_url ?? "",
    active: row.active ?? true,
    post: row.post ?? "",
    bio: row.bio ?? "",
    tone: row.tone ?? "",
    schedule: (row.schedule ?? {}) as ResidentSchedule,
  };
}

const BACK = "/student/dashboard/admin/content/npcs";

export default function NPCEditor({ mode, rowId, initial }: NPCEditorProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const flow = useDraftFlow("npc_personas", mode === "edit" ? rowId : undefined, BACK);
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  // Load existing slugs once (live table + outstanding drafts). Skip own slug
  // in edit mode so user can save without bumping the slug each time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: rows }, { data: drafts }] = await Promise.all([
          supabase.from("npc_personas").select("slug, id"),
          supabase
            .from("content_drafts")
            .select("draft_data, row_id")
            .eq("table_name", "npc_personas")
            .eq("status", "draft"),
        ]);
        if (cancelled) return;
        const slugs = new Set<string>();
        for (const r of rows ?? []) {
          if (mode === "edit" && rowId === r.id) continue;
          if (r.slug) slugs.add(r.slug);
        }
        for (const d of drafts ?? []) {
          const data = d.draft_data as { slug?: string } | null;
          if (!data?.slug) continue;
          if (mode === "edit" && d.row_id === rowId) continue;
          slugs.add(data.slug);
        }
        setExistingSlugs(slugs);
      } catch {
        // Silent — uniqueness check will fall back to server.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, rowId]);

  const draft = useMemo(
    () => ({
      slug: form.slug.trim(),
      display_name: form.display_name.trim(),
      spawn_zone: form.spawn_zone,
      is_permanent: form.is_permanent,
      persona_prompt: form.persona_prompt.trim() || null,
      canned_dialogue: form.canned_dialogue.map((l) => l.trim()).filter((l) => l.length > 0),
      sprite_url: form.sprite_url.trim() || null,
      active: form.active,
      post: form.post || null,
      bio: form.bio.trim(),
      tone: form.tone.trim() || null,
      schedule: form.schedule,
    }),
    [form],
  );
  const errors = [...validateResidentDraft(draft), ...(existingSlugs.has(draft.slug) ? ["slug: already in use"] : [])];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddLine = () => {
    update("canned_dialogue", [...form.canned_dialogue, ""]);
  };
  const handleEditLine = (idx: number, val: string) => {
    const next = [...form.canned_dialogue];
    next[idx] = val;
    update("canned_dialogue", next);
  };
  const handleRemoveLine = (idx: number) => {
    update(
      "canned_dialogue",
      form.canned_dialogue.filter((_, i) => i !== idx),
    );
  };

  const promptLength = form.persona_prompt.length;
  const promptOver = promptLength > 2000;
  const promptWarn = !promptOver && promptLength > 1800;

  return (
    <div>
      <div className="mb-2">
        <Link
          href={BACK}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Residents
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new" ? "New resident" : `Edit: ${initial?.display_name ?? "Resident"}`}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Drafts stay invisible to members until published.
        </p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <Field
          label="Slug"
          hint="kebab-case identifier, e.g. wise-shopkeeper"
        >
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputCls}
            placeholder="wise-shopkeeper"
            spellCheck={false}
          />
        </Field>

        <Field label="Display Name">
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Marigold the Merchant"
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Post" hint="The service post they staff (row 122), or a flavour villager">
            <select value={form.post} onChange={(e) => update("post", e.target.value)} className={inputCls}>
              <option value="">(none)</option>
              {RESIDENT_POSTS.map((p) => (
                <option key={p} value={p}>{POST_LABELS[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Tone" hint="How they talk: warm, dry, playful, earnest…">
            <input type="text" list="resident-tones" value={form.tone} onChange={(e) => update("tone", e.target.value)} className={inputCls} placeholder="warm" />
            <datalist id="resident-tones">
              {["warm", "dry", "playful", "earnest"].map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
        </div>

        <Field label="Bio" hint="Authored background for writers and the resident card. Up to 1000 characters.">
          <textarea rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} className={`${inputCls} resize-y`} maxLength={1000} />
        </Field>

        <Field label="Home" hint="The building they go into at night (their door). Empty = by post (the shop for the shopkeeper; the clubhouse otherwise).">
          <select
            value={form.schedule.home ?? ""}
            onChange={(e) => {
              const next = { ...form.schedule };
              if (e.target.value) next.home = e.target.value as LandmarkId;
              else delete next.home;
              update("schedule", next);
            }}
            className={inputCls}
          >
            <option value="">(by post)</option>
            {HOME_LANDMARKS.map((id) => <option key={id} value={id}>{LANDMARK_INFO[id].label}</option>)}
          </select>
        </Field>

        <Field label="Routine" hint="Per part of the day, the places they walk between in turn, stopping a while at each. One place = they mill about it. Empty = the day's routine (night: home).">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {ISLAND_PHASES.map((phase) => {
              const raw = form.schedule[phase];
              const stops: ResidentStop[] = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
              const set = (list: ResidentStop[]) => {
                const next = { ...form.schedule };
                if (list.length) next[phase] = list;
                else delete next[phase];
                update("schedule", next);
              };
              return (
                <div key={phase} className="block">
                  <span className="block text-xs uppercase text-[var(--color-text-muted)] mb-1">{phase}</span>
                  {stops.map((stop, i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <select value={stop} onChange={(e) => set(stops.map((s, j) => (j === i ? (e.target.value as ResidentStop) : s)))} className={inputCls} aria-label={`${phase} stop ${i + 1}`}>
                        {STOP_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                      <button type="button" onClick={() => set(stops.filter((_, j) => j !== i))} className="px-2 text-[var(--color-text-muted)]" aria-label={`Remove ${phase} stop ${i + 1}`}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {stops.length < MAX_STOPS && (
                    <button type="button" onClick={() => set([...stops, phase === "night" ? "home" : "plaza"])} className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Plus size={12} /> {stops.length ? "Add a stop" : phase === "night" ? "(home) Add a stop" : "(day routine) Add a stop"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Field>

        <Field label="Spawn Zone" hint="Legacy portal world only; the member island uses the schedule.">
          <select
            value={form.spawn_zone}
            onChange={(e) => update("spawn_zone", e.target.value as SpawnZone)}
            className={inputCls}
          >
            {SPAWN_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>

        <Toggle
          label="Permanent NPC"
          hint="Permanent NPCs always spawn. Non-permanent are filler that scale with player count."
          checked={form.is_permanent}
          onChange={(v) => update("is_permanent", v)}
        />

        <Field
          label="Persona Prompt"
          hint="LLM system prompt for the NPC's voice and behavior. Used when LLM-NPC ships."
        >
          <textarea
            rows={6}
            value={form.persona_prompt}
            onChange={(e) => update("persona_prompt", e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="You are Marigold, the cheerful merchant of the courtyard..."
          />
          <p
            className={`mt-1 text-xs ${
              promptOver
                ? "text-[var(--gui-danger)]"
                : promptWarn
                  ? "text-[var(--color-brand-yellow)]"
                  : "text-[var(--color-text-muted)]"
            }`}
          >
            {promptLength} / 2000 characters
          </p>
        </Field>

        <Field
          label="Dialogue lines"
          hint="What they say in their speech bubble when you pass by. ≤ 200 chars per line."
        >
          <div className="space-y-2">
            {form.canned_dialogue.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleEditLine(idx, e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="Welcome, traveler!"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  className="px-2 py-2 text-[var(--color-text-muted)] hover:text-[var(--gui-danger)] transition-colors"
                  aria-label="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-cyan)] hover:underline"
            >
              <Plus size={12} /> Add line
            </button>
          </div>
        </Field>

        <Field label="Sprite URL" hint="Paste a URL or upload an image (≤ 5MB, PNG/JPEG/WebP/GIF)">
          <input
            type="text"
            value={form.sprite_url}
            onChange={(e) => update("sprite_url", e.target.value)}
            className={inputCls}
            placeholder="https://..."
            spellCheck={false}
          />
          <ImageUploadButton onUpload={(url) => update("sprite_url", url)} />
        </Field>

        <Toggle
          label="Active"
          hint="Inactive NPCs are hidden from the world."
          checked={form.active}
          onChange={(v) => update("active", v)}
        />
      </div>

      {errors.length ? <ul className="mt-4 text-xs text-[var(--gui-danger)] list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
      {flow.draftId ? (
        <a
          href={`/student/dashboard?preview=draft-${flow.draftId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] text-xs uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] transition-colors"
        >
          <ExternalLink size={12} /> Preview
        </a>
      ) : null}
    </div>
  );
}
