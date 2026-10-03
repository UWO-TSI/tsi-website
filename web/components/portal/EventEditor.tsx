"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIcon } from "@/components/economy/Amount";
import { Button, Card, Loading, Select } from "@/components/gui";
import { AdminMessage, backLinkCls, buttonLinkCls, Field, inputCls, Toggle } from "./ProgressionAdminShared";

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
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/student/dashboard/admin/content/events" className={backLinkCls}>
        <ArrowLeft size={16} aria-hidden />
        Back to events
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          {mode === "new" ? "New event" : `Edit: ${initial?.title ?? "Event"}`}
        </h1>
        <p className="text-sm text-[var(--gui-muted)] mt-1">
          Events save straight away, with no draft: members see them as soon as you save.
        </p>
      </div>

      <AdminMessage message={message} className="mb-4" />

      <Card className="space-y-5" style={{ padding: "clamp(16px, 4vw, 24px)" }}>
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

        <Field label="Event type">
          <Select
            value={form.event_type}
            onChange={(e) =>
              update("event_type", e.target.value as EventType)
            }
            className="w-full"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Starts" error={errors.start_time}>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Ends" error={errors.end_time}>
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
          hint="Off: set the most people who can come below."
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
          label="XP reward"
          hint={
            form.is_irl
              ? "Given to each member who scans the QR code at check-in."
              : "Off: only in-person events give XP."
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
            className={inputCls}
          />
        </Field>

        <Field
          label="Gem reward"
          hint="Given to each member at check-in. Any event can give Gems."
          error={errors.tc_reward}
        >
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={0}
              step={1}
              value={form.tc_reward}
              onChange={(e) => update("tc_reward", e.target.value)}
              className={inputCls}
              aria-label="Gem reward"
            />
            <CurrencyIcon currency="gems" size={28} />
          </div>
        </Field>

        {mode === "edit" && qrCheckInCode ? (
          <div className="border-t-2 border-dashed border-[var(--gui-paper-edge)] pt-5">
            <h2 className="mb-2 text-[15px] font-extrabold text-[var(--gui-ink-strong)]">
              Check-in QR code
            </h2>
            <div className="flex flex-wrap items-start gap-4">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="QR check-in code"
                  className="w-40 h-40 rounded-xl bg-white p-2 border-2 border-[var(--gui-paper-line)]"
                />
              ) : (
                <div className="w-40 h-40 rounded-xl bg-[var(--gui-paper-warm)] border-2 border-[var(--gui-paper-edge)] flex items-center justify-center">
                  <Loading label="Drawing the code…" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-bold text-[var(--gui-ink)] break-all">
                  {qrCheckInCode}
                </p>
                <p className="text-[13px] text-[var(--gui-muted)] break-all">
                  {checkInUrl}
                </p>
                {rowId ? (
                  <a
                    href={`/student/dashboard/admin/content/events/${rowId}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonLinkCls}
                    data-variant="quiet"
                    data-size="sm"
                  >
                    <Printer size={16} aria-hidden /> Print the QR code
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={hasErrors || busy !== null}
        >
          {busy === "save"
            ? "Saving…"
            : mode === "new"
              ? "Create event"
              : "Save"}
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() =>
            router.push("/student/dashboard/admin/content/events")
          }
        >
          Cancel
        </Button>
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
    errors.tc_reward = "Gems must be a whole number ≥ 0";
  }

  return errors;
}
