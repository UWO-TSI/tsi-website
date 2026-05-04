"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FormField from "./FormField";
import FormProgress from "./FormProgress";
import ResumeUpload from "./ResumeUpload";
import SuccessScreen from "./SuccessScreen";
import Button from "@/components/ui/Button";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  CloudOff,
  Cloud,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Position, EssayAnswer } from "@/lib/recruitment";
import { HEARD_ABOUT_OPTIONS, YEAR_OPTIONS } from "@/lib/recruitment";

interface ApplicationFormProps {
  position: Position;
  userId: string;
}

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  program_major: string;
  year_of_study: string;
  linkedin_url: string;
  other_links: string;
  commitments_next_year: string;
  heard_about_us: string;
  essay_answers: Record<string, string>;
  resume_storage_path: string | null;
  resume_filename: string | null;
  resume_size_bytes: number | null;
}

const EMPTY_FORM: FormData = {
  full_name: "",
  email: "",
  phone: "",
  program_major: "",
  year_of_study: "",
  linkedin_url: "",
  other_links: "",
  commitments_next_year: "",
  heard_about_us: "",
  essay_answers: {},
  resume_storage_path: null,
  resume_filename: null,
  resume_size_bytes: null,
};

const DRAFT_KEY = (positionId: string) => `tethos:draft:${positionId}`;

// Reserved IDs for profile fields stashed inside essay_answers since the
// applications table doesn't have dedicated columns for them. Admin views
// and the user's review screen pull these out separately from real essays.
export const META_OTHER_LINKS_ID = "__profile_other_links";
export const META_COMMITMENTS_ID = "__profile_commitments_next_year";

interface DraftPayload {
  form_data: FormData;
  updated_at: string;
}

function isEmptyForm(f: FormData): boolean {
  return (
    !f.full_name &&
    !f.email &&
    !f.phone &&
    !f.program_major &&
    !f.year_of_study &&
    !f.linkedin_url &&
    !f.other_links &&
    !f.commitments_next_year &&
    !f.heard_about_us &&
    !f.resume_storage_path &&
    Object.values(f.essay_answers).every((v) => !v)
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

const STEP_LABELS = ["Personal Info", "Resume", "Questions", "Review"];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export default function ApplicationForm({
  position,
  userId,
}: ApplicationFormProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<
    "idle" | "saving" | "saved" | "offline"
  >("idle");
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from draft + Google session on mount.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const supabase = createClient();

      // Start with Google-derived defaults (name/email pre-fill)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      const sessionDefaults: Partial<FormData> = {
        full_name: meta.full_name ?? meta.name ?? "",
        email: user?.email ?? "",
      };

      // Load drafts in parallel: localStorage (fast) + Supabase (authoritative)
      let localDraft: DraftPayload | null = null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY(position.id));
        if (raw) localDraft = JSON.parse(raw);
      } catch {
        localDraft = null;
      }

      let remoteDraft: DraftPayload | null = null;
      try {
        const res = await fetch(
          `/api/drafts?position_id=${encodeURIComponent(position.id)}`
        );
        if (res.ok) {
          const row = await res.json();
          if (row && row.form_data) {
            remoteDraft = {
              form_data: row.form_data,
              updated_at: row.updated_at,
            };
          }
        }
      } catch {
        // Network failed, rely on localStorage
      }

      if (cancelled) return;

      // Prefer the most recently updated draft
      let chosen: DraftPayload | null = null;
      if (localDraft && remoteDraft) {
        chosen =
          new Date(localDraft.updated_at).getTime() >
          new Date(remoteDraft.updated_at).getTime()
            ? localDraft
            : remoteDraft;
      } else {
        chosen = localDraft ?? remoteDraft;
      }

      if (chosen && !isEmptyForm(chosen.form_data)) {
        setFormData({
          ...EMPTY_FORM,
          ...sessionDefaults,
          ...chosen.form_data,
          essay_answers: chosen.form_data.essay_answers ?? {},
          other_links: chosen.form_data.other_links ?? "",
          commitments_next_year: chosen.form_data.commitments_next_year ?? "",
          resume_storage_path: chosen.form_data.resume_storage_path ?? null,
          resume_filename: chosen.form_data.resume_filename ?? null,
          resume_size_bytes: chosen.form_data.resume_size_bytes ?? null,
        });
        setDraftRestoredAt(chosen.updated_at);
      } else {
        setFormData((prev) => ({ ...prev, ...sessionDefaults }));
      }
      hydratedRef.current = true;
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [position.id]);

  // Debounced autosave to localStorage (always) + Supabase (when non-empty).
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isEmptyForm(formData)) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDraftSyncState("saving");

    saveTimerRef.current = setTimeout(async () => {
      const payload: DraftPayload = {
        form_data: formData,
        updated_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem(DRAFT_KEY(position.id), JSON.stringify(payload));
      } catch {
        // Storage may be full or disabled; proceed with remote save.
      }

      try {
        const res = await fetch("/api/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position_id: position.id,
            form_data: formData,
          }),
        });
        setDraftSyncState(res.ok ? "saved" : "offline");
      } catch {
        setDraftSyncState("offline");
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formData, position.id]);

  const clearDraft = useCallback(async () => {
    try {
      localStorage.removeItem(DRAFT_KEY(position.id));
    } catch {
      // ignore
    }
    try {
      await fetch(
        `/api/drafts?position_id=${encodeURIComponent(position.id)}`,
        { method: "DELETE" }
      );
    } catch {
      // Server-side cleanup also happens on successful submit.
    }
  }, [position.id]);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const updateEssay = useCallback((questionId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      essay_answers: { ...prev.essay_answers, [questionId]: value },
    }));
  }, []);

  const updateResume = useCallback(
    (data: { path: string; filename: string; size: number } | null) => {
      setFormData((prev) => ({
        ...prev,
        resume_storage_path: data?.path ?? null,
        resume_filename: data?.filename ?? null,
        resume_size_bytes: data?.size ?? null,
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.resume;
        return next;
      });
    },
    []
  );

  // Step validation
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};

    if (s === 0) {
      if (!formData.full_name.trim()) errs.full_name = "Required";
      if (!formData.email.trim()) errs.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        errs.email = "Invalid email";
      if (!formData.phone.trim()) errs.phone = "Required";
      if (!formData.program_major.trim()) errs.program_major = "Required";
      if (!formData.year_of_study) errs.year_of_study = "Required";
      if (!formData.heard_about_us) errs.heard_about_us = "Required";
    }

    if (s === 1) {
      if (!formData.resume_storage_path) errs.resume = "Resume is required";
    }

    if (s === 2) {
      for (const q of position.essay_questions) {
        const answer = formData.essay_answers[q.id] ?? "";
        if (!answer.trim()) {
          errs[`essay_${q.id}`] = "Required";
        } else if (countWords(answer) > q.max_words) {
          errs[`essay_${q.id}`] = `Exceeds ${q.max_words} word limit`;
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    // Block double-submit
    if (submitting) return;

    // Cancel any pending autosave so it can't race the clearDraft call
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    if (!formData.resume_storage_path) {
      setStep(1);
      setErrors({ resume: "Resume is required" });
      return;
    }

    setSubmitting(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });

    const essayAnswers: EssayAnswer[] = [
      ...position.essay_questions.map((q) => ({
        question_id: q.id,
        answer: formData.essay_answers[q.id] ?? "",
      })),
      // Profile fields stashed alongside essays — see META_*_ID constants.
      ...(formData.other_links.trim()
        ? [
            {
              question_id: META_OTHER_LINKS_ID,
              answer: formData.other_links.trim(),
            },
          ]
        : []),
      ...(formData.commitments_next_year.trim()
        ? [
            {
              question_id: META_COMMITMENTS_ID,
              answer: formData.commitments_next_year.trim(),
            },
          ]
        : []),
    ];

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          position_id: position.id,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          program_major: formData.program_major,
          year_of_study: parseInt(formData.year_of_study),
          linkedin_url: formData.linkedin_url || null,
          heard_about_us: formData.heard_about_us,
          resume_storage_path: formData.resume_storage_path,
          resume_filename: formData.resume_filename,
          essay_answers: essayAnswers,
        }),
      });

      if (res.ok) {
        await clearDraft();
        setSubmitted(true);
        setSubmitting(false);
        return;
      }

      // Map status codes to actionable messages
      let message: string;
      try {
        const errData = await res.json();
        if (res.status === 409) {
          message =
            "You've already applied for this position. Track its status in your dashboard.";
        } else if (res.status === 429) {
          message = "Too many submissions. Wait a moment, then try again.";
        } else if (res.status === 401) {
          message = "Your session expired. Please refresh and sign in again.";
        } else {
          message =
            errData?.error ||
            "Submission failed. Your draft is saved — try again.";
        }
      } catch {
        message = "Submission failed. Your draft is saved — try again.";
      }
      setErrors({ submit: message });
      if (res.status === 409) {
        // Already applied — clear the local draft so they can't keep
        // mashing Submit on stale data.
        await clearDraft().catch(() => {});
      }
    } catch {
      setErrors({
        submit:
          "Network error. Your draft is saved — check your connection and try again.",
      });
    }

    setSubmitting(false);
  };

  if (submitted) {
    return (
      <SuccessScreen
        positionTitle={position.title}
        applicantName={formData.full_name}
        position={position}
        positionSlug={position.slug}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence>
        {draftRestoredAt && !draftBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 p-4 rounded-xl mb-6"
            style={{
              background: "rgba(0,47,167,0.08)",
              border: "1px solid rgba(0,47,167,0.25)",
            }}
          >
            <span className="mt-0.5 w-5 h-5 rounded-md bg-[#002FA7]/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-[#002FA7]" />
            </span>
            <div className="flex-1">
              <p className="text-sm text-[#F1FFFF]">
                Draft restored
                <span className="text-[#9CA3AF] ml-2 text-xs font-mono">
                  — last edited {relativeTime(draftRestoredAt)}
                </span>
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                We saved your progress automatically. Pick up where you left
                off.
              </p>
            </div>
            <button
              onClick={() => setDraftBannerDismissed(true)}
              className="text-xs text-[#6B7280] hover:text-[#F1FFFF] transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FormProgress
        currentStep={step}
        totalSteps={STEP_LABELS.length}
        labels={STEP_LABELS}
      />

      <div className="flex items-center justify-end mb-6 h-5">
        <AnimatePresence mode="wait">
          {draftSyncState === "saving" && (
            <motion.span
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-mono text-[#6B7280] flex items-center gap-1.5"
            >
              <span className="w-1 h-1 rounded-full bg-[#FFD166] animate-pulse" />
              Saving draft…
            </motion.span>
          )}
          {draftSyncState === "saved" && (
            <motion.span
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-mono text-[#6B7280] flex items-center gap-1.5"
            >
              <Cloud className="w-3 h-3 text-[#1D9BF0]" />
              Draft saved
            </motion.span>
          )}
          {draftSyncState === "offline" && (
            <motion.span
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-mono text-[#FFD166] flex items-center gap-1.5"
            >
              <CloudOff className="w-3 h-3" />
              Saved locally — will sync when online
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative overflow-hidden min-h-[400px]">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <motion.div
              key="step0"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={(v) => updateField("full_name", v)}
                  required
                  error={errors.full_name}
                />
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(v) => updateField("email", v)}
                  required
                  error={errors.email}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(v) => updateField("phone", v)}
                  required
                  error={errors.phone}
                />
                <FormField
                  label="Program / Major"
                  name="program_major"
                  value={formData.program_major}
                  onChange={(v) => updateField("program_major", v)}
                  required
                  error={errors.program_major}
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
                  Year of Study <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {YEAR_OPTIONS.map((y) => {
                    const selected = formData.year_of_study === String(y.value);
                    return (
                      <button
                        key={y.value}
                        type="button"
                        onClick={() =>
                          updateField("year_of_study", String(y.value))
                        }
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          selected
                            ? "bg-[#002FA7] text-[#F1FFFF] border border-[#002FA7]"
                            : "bg-white/[0.03] text-[#9CA3AF] border border-white/10 hover:border-white/20 hover:text-[#F1FFFF]"
                        }`}
                      >
                        {y.label}
                      </button>
                    );
                  })}
                </div>
                {errors.year_of_study && (
                  <p className="text-xs text-[#EF4444] mt-1.5 ml-1">
                    {errors.year_of_study}
                  </p>
                )}
              </div>

              <FormField
                label="LinkedIn (optional)"
                name="linkedin_url"
                type="url"
                value={formData.linkedin_url}
                onChange={(v) => updateField("linkedin_url", v)}
                placeholder="https://linkedin.com/in/..."
              />

              <FormField
                label="Other links (optional)"
                name="other_links"
                type="textarea"
                value={formData.other_links}
                onChange={(v) => updateField("other_links", v)}
                placeholder="Portfolio, GitHub, Behance, anywhere else worth showing — one per line"
                rows={3}
              />

              <FormField
                label="Commitments next year (optional)"
                name="commitments_next_year"
                type="textarea"
                value={formData.commitments_next_year}
                onChange={(v) => updateField("commitments_next_year", v)}
                placeholder="Other clubs, jobs, internships, or commitments you'll have during the school year"
                rows={3}
              />

              <div>
                <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
                  How did you hear about us?{" "}
                  <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {HEARD_ABOUT_OPTIONS.map((o) => {
                    const selected = formData.heard_about_us === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => updateField("heard_about_us", o)}
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          selected
                            ? "bg-[#002FA7] text-[#F1FFFF] border border-[#002FA7]"
                            : "bg-white/[0.03] text-[#9CA3AF] border border-white/10 hover:border-white/20 hover:text-[#F1FFFF]"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
                {errors.heard_about_us && (
                  <p className="text-xs text-[#EF4444] mt-1.5 ml-1">
                    {errors.heard_about_us}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 1: Resume */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="py-8">
                <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
                  Upload your resume
                </h3>
                <p className="text-sm text-[#9CA3AF] mb-6">
                  Upload a PDF of your resume. Make sure it&apos;s up to date
                  and highlights relevant experience.
                </p>
                <ResumeUpload
                  positionSlug={position.slug}
                  currentPath={formData.resume_storage_path}
                  currentFilename={formData.resume_filename}
                  currentSize={formData.resume_size_bytes}
                  onChange={updateResume}
                  error={errors.resume}
                />
              </div>
            </motion.div>
          )}

          {/* Step 2: Essay Questions */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              {position.essay_questions.map((q, i) => {
                const answer = formData.essay_answers[q.id] ?? "";
                return (
                  <div key={q.id}>
                    <p className="text-sm text-[#F1FFFF] mb-3 font-medium">
                      {i + 1}. {q.question}
                    </p>
                    <FormField
                      label=""
                      name={`essay_${q.id}`}
                      type="textarea"
                      value={answer}
                      onChange={(v) => updateEssay(q.id, v)}
                      required
                      rows={6}
                      error={errors[`essay_${q.id}`]}
                      wordCount={countWords(answer)}
                      maxWords={q.max_words}
                    />
                  </div>
                );
              })}

              <div
                className="flex items-start gap-3 p-4 rounded-xl mt-6"
                style={{
                  background: "rgba(255,209,102,0.06)",
                  border: "1px solid rgba(255,209,102,0.2)",
                }}
              >
                <Sparkles className="w-4 h-4 text-[#FFD166] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#F1FFFF] font-medium">
                    Write in your own voice
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                    We can tell when essays are AI-written. Short and honest
                    beats long and polished every time.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div>
                <h3 className="text-lg font-semibold text-[#F1FFFF] mb-8">
                  Review your application
                </h3>

                <div className="space-y-3 pb-6 border-b border-white/[0.06]">
                  <ReviewSectionHeader
                    title="Personal"
                    onEdit={() => {
                      setDirection(-1);
                      setStep(0);
                    }}
                  />
                  <ReviewRow label="Name" value={formData.full_name} />
                  <ReviewRow label="Email" value={formData.email} />
                  <ReviewRow label="Phone" value={formData.phone} />
                  <ReviewRow label="Program" value={formData.program_major} />
                  <ReviewRow
                    label="Year"
                    value={
                      YEAR_OPTIONS.find(
                        (y) => String(y.value) === formData.year_of_study
                      )?.label ?? formData.year_of_study
                    }
                  />
                  {formData.linkedin_url && (
                    <ReviewRow
                      label="LinkedIn"
                      value={formData.linkedin_url}
                    />
                  )}
                  {formData.other_links.trim() && (
                    <ReviewRow
                      label="Links"
                      value={formData.other_links.trim()}
                    />
                  )}
                  {formData.commitments_next_year.trim() && (
                    <ReviewRow
                      label="Commitments"
                      value={formData.commitments_next_year.trim()}
                    />
                  )}
                  <ReviewRow
                    label="Heard via"
                    value={formData.heard_about_us}
                  />
                </div>

                <div className="space-y-3 py-6 border-b border-white/[0.06]">
                  <ReviewSectionHeader
                    title="Resume"
                    onEdit={() => {
                      setDirection(-1);
                      setStep(1);
                    }}
                  />
                  <ReviewRow
                    label="File"
                    value={formData.resume_filename ?? "Not uploaded"}
                  />
                </div>

                {position.essay_questions.length > 0 && (
                  <div className="space-y-4 pt-6">
                    <ReviewSectionHeader
                      title="Essays"
                      onEdit={() => {
                        setDirection(-1);
                        setStep(2);
                      }}
                    />
                    {position.essay_questions.map((q) => (
                      <div key={q.id} className="pt-2">
                        <p className="text-xs text-[#9CA3AF] mb-1.5 font-medium">
                          {q.question}
                        </p>
                        <p className="text-sm text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                          {formData.essay_answers[q.id] || "—"}
                        </p>
                        <p className="text-[10px] text-[#6B7280] font-mono mt-1">
                          {countWords(formData.essay_answers[q.id] ?? "")} /{" "}
                          {q.max_words} words
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setConfirmChecked((v) => !v)}
                className="w-full flex items-start gap-3 p-4 rounded-xl mt-6 text-left transition-colors"
                style={{
                  background: confirmChecked
                    ? "rgba(0,47,167,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    confirmChecked
                      ? "rgba(0,47,167,0.4)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                }}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    confirmChecked
                      ? "bg-[#002FA7] border-[#002FA7]"
                      : "border border-white/20"
                  }`}
                >
                  {confirmChecked && (
                    <Check className="w-3 h-3 text-[#F1FFFF]" />
                  )}
                </span>
                <span className="text-sm text-[#F1FFFF] leading-relaxed">
                  I confirm the information above is accurate. Once submitted,
                  I won&apos;t be able to edit this application.
                </span>
              </button>

              {errors.submit && (
                <div
                  className="flex items-start gap-3 p-4 rounded-xl mt-6"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  <span className="mt-0.5 w-5 h-5 rounded-md bg-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-[#EF4444]">!</span>
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[#F1FFFF]">
                      Couldn&apos;t submit
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                      {errors.submit}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <div>
          {step > 0 && (
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
        <div>
          {step < STEP_LABELS.length - 1 ? (
            <Button variant="primary" onClick={goNext}>
              <span className="flex items-center gap-2">
                Next
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!confirmChecked || submitting}
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="font-mono text-xs text-[#6B7280] w-20 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[#E5E7EB] break-words">{value}</span>
    </div>
  );
}

function ReviewSectionHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/5">
      <p className="font-mono text-xs text-[#002FA7] uppercase tracking-wider">
        {title}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-[#9CA3AF] hover:text-[#F1FFFF] transition"
      >
        Edit
      </button>
    </div>
  );
}
