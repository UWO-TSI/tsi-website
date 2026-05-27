"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

// ─── EventEditor ────────────────────────────────────────────────────────────
// Events live OUTSIDE the content_pipeline / content_drafts flow. Editor
// performs direct supabase CRUD (RLS lets authenticated users insert/update
// today; the tier check happens client-side via UserContext on the page).
//
// XP guard: per design principle #3, XP only flows from IRL events. The
// is_irl toggle controls whether xp_reward is editable; the form clears xp
// to 0 when the event is flipped to non-IRL.

const EVENT_TYPES = [
  "club",
  "team",
  "bounty",
  "volunteer",
  "social",
  "workshop",
  "meeting",
] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  is_irl: boolean | null;
  xp_reward: number | null;
  tc_reward: number | null;
  qr_check_in_code: string | null;
}

interface FormState {
  title: string;
  description: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  location: string;
  capacity: string;
  unlimited_capacity: boolean;
  is_irl: boolean;
  xp_reward: string;
  tc_reward: string;
}

interface EventEditorProps {
  mode: "new" | "edit";
  rowId?: string;
  initial?: Partial<EventRow> | null;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function makeEmptyForm(): FormState {
  return {
    title: "",
    description: "",
    event_type: "social",
    start_time: "",
    end_time: "",
    location: "",
    capacity: "",
    unlimited_capacity: true,
    is_irl: true,
    xp_reward: "0",
    tc_reward: "0",
  };
}

function toFormState(row: Partial<EventRow> | null | undefined): FormState {
  if (!row) return makeEmptyForm();
  const isIrl = row.is_irl ?? true;
  return {
    title: row.title ?? "",
    description: row.description ?? "",
    event_type: (EVENT_TYPES.includes(row.event_type as EventType)
      ? row.event_type
      : "social") as EventType,
    start_time: toLocalDatetime(row.start_time),
    end_time: toLocalDatetime(row.end_time),
    location: row.location ?? "",
    capacity:
      row.capacity === null || row.capacity === undefined
        ? ""
        : String(row.capacity),
    unlimited_capacity: row.capacity === null || row.capacity === undefined,
    is_irl: isIrl,
    xp_reward: String(row.xp_reward ?? 0),
    tc_reward: String(row.tc_reward ?? 0),
  };
}

export default function EventEditor({ mode, rowId, initial }: EventEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [busy, setBusy] = useState<"save" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [qrCheckInCode] = useState<string | null>(
    initial?.qr_check_in_code ?? null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!qrCheckInCode) {
      setQrDataUrl("");
      return;
    }
    const checkInUrl = `https://tethos.org/student/check-in?code=${qrCheckInCode}`;
    let cancelled = false;
    QRCode.toDataURL(checkInUrl, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrCheckInCode]);

  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // XP guard — when is_irl flips off, force xp to 0.
  const handleIrlToggle = (v: boolean) => {
    setForm((prev) => ({
      ...prev,
      is_irl: v,
      xp_reward: v ? prev.xp_reward : "0",
    }));
  };

  const handleSave = async () => {
    if (hasErrors || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const supabase = createClient();
      const startIso = fromLocalDatetime(form.start_time);
      const endIso = form.end_time ? fromLocalDatetime(form.end_time) : null;
      const capacity = form.unlimited_capacity
        ? null
        : Number.parseInt(form.capacity, 10);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        start_time: startIso,
        end_time: endIso,
        location: form.location.trim() || null,
        capacity,
        is_irl: form.is_irl,
        xp_reward: Number.parseInt(form.xp_reward, 10) || 0,
        tc_reward: Number.parseInt(form.tc_reward, 10) || 0,
      };

      if (mode === "edit" && rowId) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", rowId);
        if (error) {
          setMessage({ kind: "err", text: error.message });
          return;
        }
        setMessage({ kind: "ok", text: "Event saved." });
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("events")
          .insert({
            ...payload,
            status: "approved",
            created_by: user?.id ?? null,
            approved_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error || !data) {
          setMessage({ kind: "err", text: error?.message ?? "Save failed" });
          return;
        }
        router.push(`/student/dashboard/admin/content/events/${data.id}/edit`);
      }
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setBusy(null);
    }
  };

  const checkInUrl = qrCheckInCode
    ? `https://tethos.org/student/check-in?code=${qrCheckInCode}`
    : "";

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin/content/events"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Events
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {mode === "new" ? "New Event" : `Edit: ${initial?.title ?? "Event"}`}
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Events save directly. No draft preview — they are public on save.
        </p>
      </div>

      {message ? (
        <div
          className={`mb-4 p-3 rounded-md text-xs font-mono border ${
            message.kind === "ok"
              ? "bg-green-400/10 border-green-400/30 text-green-400"
              : "bg-red-400/10 border-red-400/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-5">
        <Field label="Title" error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className={inputCls}
            placeholder="Kickoff Social"
            maxLength={120}
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="Open-house mixer for new members..."
          />
        </Field>

        <Field label="Event Type">
          <select
            value={form.event_type}
            onChange={(e) =>
              update("event_type", e.target.value as EventType)
            }
            className={inputCls}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Start Time" error={errors.start_time}>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="End Time" error={errors.end_time}>
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => update("end_time", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Location">
          <input
            type="text"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className={inputCls}
            placeholder="UCC 268, Western University"
          />
        </Field>

        <Toggle
          label="Unlimited capacity"
          hint="When off, set a max-attendee count below."
          checked={form.unlimited_capacity}
          onChange={(v) => update("unlimited_capacity", v)}
        />

        {form.unlimited_capacity ? null : (
          <Field label="Capacity" error={errors.capacity}>
            <input
              type="number"
              min={1}
              step={1}
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value)}
              className={inputCls}
              placeholder="50"
            />
          </Field>
        )}

        <Toggle
          label="In-person event (IRL)"
          hint="Only in-person events award XP per design principle #3."
          checked={form.is_irl}
          onChange={handleIrlToggle}
        />

        <Field
          label="XP Reward"
          hint={
            form.is_irl
              ? "Granted to each member who scans the QR at check-in."
              : "Disabled — non-IRL events can't award XP."
          }
          error={errors.xp_reward}
        >
          <input
            type="number"
            min={0}
            step={1}
            disabled={!form.is_irl}
            value={form.xp_reward}
            onChange={(e) => update("xp_reward", e.target.value)}
            className={`${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </Field>

        <Field
          label="TC Reward"
          hint="Granted to each member at check-in. Allowed for any event."
          error={errors.tc_reward}
        >
          <input
            type="number"
            min={0}
            step={1}
            value={form.tc_reward}
            onChange={(e) => update("tc_reward", e.target.value)}
            className={inputCls}
          />
        </Field>

        {mode === "edit" && qrCheckInCode ? (
          <div className="border-t border-[var(--glass-border)] pt-5">
            <label className="block text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              QR Check-in Code
            </label>
            <div className="flex flex-wrap items-start gap-4">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="QR check-in code"
                  className="w-40 h-40 rounded-md bg-white p-2"
                />
              ) : (
                <div className="w-40 h-40 rounded-md bg-[var(--color-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                  rendering...
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] break-all">
                  {qrCheckInCode}
                </p>
                <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]/70 break-all">
                  {checkInUrl}
                </p>
                {rowId ? (
                  <a
                    href={`/student/dashboard/admin/content/events/${rowId}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryBtnCls}
                  >
                    <Printer size={12} /> Print QR
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={hasErrors || busy !== null}
          className={primaryBtnCls}
        >
          {busy === "save"
            ? "Saving..."
            : mode === "new"
              ? "Create event"
              : "Save"}
        </button>
        <button
          type="button"
          onClick={() =>
            router.push("/student/dashboard/admin/content/events")
          }
          className={secondaryBtnCls}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  const title = form.title.trim();
  if (!title) {
    errors.title = "Title is required";
  } else if (title.length > 100) {
    errors.title = "Keep under 100 characters";
  }

  if (!form.start_time) {
    errors.start_time = "Start time is required";
  } else if (!fromLocalDatetime(form.start_time)) {
    errors.start_time = "Invalid start time";
  }

  if (form.end_time) {
    const endIso = fromLocalDatetime(form.end_time);
    if (!endIso) {
      errors.end_time = "Invalid end time";
    } else if (form.start_time) {
      const startMs = new Date(form.start_time).getTime();
      const endMs = new Date(form.end_time).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
        errors.end_time = "End must be after start";
      }
    }
  }

  if (!form.unlimited_capacity) {
    const cap = Number(form.capacity);
    if (form.capacity.trim() === "" || !Number.isFinite(cap)) {
      errors.capacity = "Capacity is required (or toggle Unlimited)";
    } else if (!Number.isInteger(cap)) {
      errors.capacity = "Capacity must be a whole number";
    } else if (cap < 1) {
      errors.capacity = "Capacity must be ≥ 1";
    }
  }

  const xp = Number(form.xp_reward);
  if (form.xp_reward.trim() === "" || !Number.isFinite(xp) || !Number.isInteger(xp) || xp < 0) {
    errors.xp_reward = "XP must be a whole number ≥ 0";
  }

  const tc = Number(form.tc_reward);
  if (form.tc_reward.trim() === "" || !Number.isFinite(tc) || !Number.isInteger(tc) || tc < 0) {
    errors.tc_reward = "TC must be a whole number ≥ 0";
  }

  return errors;
}

// ─── Sub-components / classes ───────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent-cyan)] transition-colors";

const primaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";

const secondaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-xs uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] transition-colors";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.65rem] font-mono text-[var(--color-text-muted)]/70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.65rem] font-mono text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border border-[var(--glass-border)] transition-colors ${
          checked ? "bg-[var(--color-accent-cyan)]" : "bg-[var(--color-bg)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <div className="flex-1">
        <label className="block text-xs font-mono text-[var(--color-text-primary)]">
          {label}
        </label>
        {hint ? (
          <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]/70 mt-0.5">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
