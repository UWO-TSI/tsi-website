"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NPCPersona, SpawnZone } from "@/lib/content/types";
import ImageUploadButton from "@/components/portal/ImageUploadButton";
import { MAX_STOPS, POST_TITLES, RESIDENT_ANCHORS, RESIDENT_POSTS, validateResidentDraft, type ResidentSchedule, type ResidentStop } from "@/lib/content/residents";
import { TALK_LIMITS } from "@/lib/content/talk";
import { EXPRESSIONS } from "@/lib/game/character/face";
import { HOME_LANDMARKS, ROUTINE_SPECIAL } from "@/lib/game/residentRoutine";
import { LANDMARK_INFO, type LandmarkId } from "@/lib/game/defaultIsland";
import { ISLAND_PHASES } from "@/lib/game/islandTime";
import { Button, Card, IconButton, Select } from "@/components/gui";
import { backLinkCls, buttonLinkCls, DraftBar, Field, FixList, inputCls, Toggle, useDraftFlow } from "./ProgressionAdminShared";

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
  /** Conversations, each as the text in its box: one line per row. */
  talk: string[];
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
  talk: [],
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
    talk: Array.isArray(row.talk) ? row.talk.map((c) => (Array.isArray(c) ? c.join("\n") : "")) : [],
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
      talk: form.talk.map((c) => c.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)).filter((c) => c.length > 0),
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
    <div className="mx-auto w-full max-w-3xl">
      <Link href={BACK} className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden />
        Back to residents
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          {mode === "new" ? "New resident" : `Edit: ${initial?.display_name ?? "Resident"}`}
        </h1>
        <p className="text-sm text-[var(--gui-muted)] mt-1">
          Drafts stay invisible to members until published.
        </p>
      </div>

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
        <Field
          label="Slug"
          hint="Lowercase letters, numbers and dashes, e.g. wise-shopkeeper"
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

        <Field label="Display name">
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className={inputCls}
            placeholder="Marigold the Merchant"
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Post" hint="The service post they staff, or a flavour villager">
            <Select value={form.post} onChange={(e) => update("post", e.target.value)} className="w-full">
              <option value="">None</option>
              {RESIDENT_POSTS.map((p) => (
                <option key={p} value={p}>{POST_TITLES[p]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tone" hint="How they talk: warm, dry, playful, earnest…">
            <input type="text" list="resident-tones" aria-label="Tone" value={form.tone} onChange={(e) => update("tone", e.target.value)} className={inputCls} placeholder="warm" />
            <datalist id="resident-tones">
              {["warm", "dry", "playful", "earnest"].map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
        </div>

        <Field label="Bio" hint="Authored background for writers and the resident card. Up to 1000 characters.">
          <textarea rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} className={`${inputCls} resize-y`} maxLength={1000} />
        </Field>

        <Field label="Home" hint="The building they go into at night (their door). Empty = by post: the shop for the shopkeeper, HQ for everyone else.">
          <Select
            value={form.schedule.home ?? ""}
            onChange={(e) => {
              const next = { ...form.schedule };
              if (e.target.value) next.home = e.target.value as LandmarkId;
              else delete next.home;
              update("schedule", next);
            }}
            className="w-full"
          >
            <option value="">By post</option>
            {HOME_LANDMARKS.map((id) => <option key={id} value={id}>{LANDMARK_INFO[id].label}</option>)}
          </Select>
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
                <div key={phase} className="rounded-2xl bg-[var(--gui-paper-warm)] p-3">
                  <span className="block mb-2 text-sm font-extrabold capitalize text-[var(--gui-ink-strong)]">{phase}</span>
                  {stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <Select value={stop} onChange={(e) => set(stops.map((s, j) => (j === i ? (e.target.value as ResidentStop) : s)))} className="w-full min-w-0" aria-label={`${phase} stop ${i + 1}`}>
                        {STOP_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </Select>
                      <IconButton label={`Remove ${phase} stop ${i + 1}`} size="sm" onClick={() => set(stops.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden /></IconButton>
                    </div>
                  ))}
                  {stops.length === 0 && (
                    <p className="mb-2 text-[13px] text-[var(--gui-muted)]">{phase === "night" ? "Nothing set: they go home." : "Nothing set: the day's routine."}</p>
                  )}
                  {stops.length < MAX_STOPS && (
                    <Button size="sm" variant="quiet" onClick={() => set([...stops, phase === "night" ? "home" : "plaza"])}>
                      <Plus size={16} aria-hidden /> Add a stop
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Field>

        <Field label="Spawn zone" hint="Legacy portal world only; the member island uses the schedule.">
          <Select
            value={form.spawn_zone}
            onChange={(e) => update("spawn_zone", e.target.value as SpawnZone)}
            className="w-full"
          >
            {SPAWN_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle
          label="Permanent NPC"
          hint="Permanent NPCs always spawn. Non-permanent are filler that scale with player count."
          checked={form.is_permanent}
          onChange={(v) => update("is_permanent", v)}
        />

        <Field
          label="Persona prompt"
          hint="LLM system prompt for the NPC's voice and behaviour. Used when LLM NPCs ship."
        >
          <textarea
            rows={6}
            value={form.persona_prompt}
            onChange={(e) => update("persona_prompt", e.target.value)}
            className={`${inputCls} resize-y`}
            aria-label="Persona prompt"
            placeholder="You are Marigold, the cheerful merchant of the courtyard..."
          />
          <p
            className={`mt-1.5 text-[13px] font-semibold ${
              promptOver
                ? "text-[var(--gui-danger)]"
                : promptWarn
                  ? "text-[var(--gui-warn)]"
                  : "text-[var(--gui-muted)]"
            }`}
          >
            {promptLength} / 2000 characters
          </p>
        </Field>

        <Field
          label="Dialogue lines"
          hint="What they say in their speech bubble as you pass by. Up to 200 characters a line. Talking to them uses the conversations below."
        >
          <div className="space-y-2">
            {form.canned_dialogue.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleEditLine(idx, e.target.value)}
                  className={`${inputCls} flex-1`}
                  aria-label={`Dialogue line ${idx + 1}`}
                  placeholder="Welcome, traveler!"
                />
                <IconButton label={`Remove line ${idx + 1}`} size="sm" onClick={() => handleRemoveLine(idx)}>
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            ))}
            <Button size="sm" variant="quiet" onClick={handleAddLine}>
              <Plus size={16} aria-hidden /> Add a line
            </Button>
          </div>
        </Field>

        <Field
          label="Conversations"
          hint={`What they say when a member walks up and talks to them: each box is one conversation, each line its own text box (up to ${TALK_LIMITS.lines}, ${TALK_LIMITS.chars} characters each). Start a line with ${EXPRESSIONS.filter((e) => e !== "neutral").map((e) => `[${e}]`).join(", ")} for the face they make. {name} is the member's island name. Each talk picks the next conversation.`}
        >
          <div className="space-y-2">
            {form.talk.map((conversation, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <textarea
                  rows={Math.max(2, Math.min(TALK_LIMITS.lines, conversation.split("\n").length))}
                  value={conversation}
                  onChange={(e) => update("talk", form.talk.map((c, i) => (i === idx ? e.target.value : c)))}
                  className={`${inputCls} flex-1 resize-y`}
                  aria-label={`Conversation ${idx + 1}`}
                  placeholder={"[happy] Oh! Hi there, {name}.\nThe notice board has something new."}
                />
                <IconButton label={`Remove conversation ${idx + 1}`} size="sm" onClick={() => update("talk", form.talk.filter((_, i) => i !== idx))}>
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            ))}
            {form.talk.length < TALK_LIMITS.conversations && (
              <Button size="sm" variant="quiet" onClick={() => update("talk", [...form.talk, ""])}>
                <Plus size={16} aria-hidden /> Add a conversation
              </Button>
            )}
          </div>
        </Field>

        <Field label="Sprite URL" hint="Paste a URL or upload an image (up to 5 MB: PNG, JPEG, WebP or GIF)">
          <input
            type="text"
            value={form.sprite_url}
            onChange={(e) => update("sprite_url", e.target.value)}
            className={inputCls}
            aria-label="Sprite URL"
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
      </Card>

      <FixList errors={errors} className="mt-4" />
      <DraftBar flow={flow} canSave={errors.length === 0} onSave={() => flow.save(draft)} />
      {flow.draftId ? (
        <a
          href={`/student/dashboard?preview=draft-${flow.draftId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 ${buttonLinkCls}`}
          data-variant="quiet"
          data-size="sm"
        >
          <ExternalLink size={16} aria-hidden /> Preview the draft
        </a>
      ) : null}
    </div>
  );
}
