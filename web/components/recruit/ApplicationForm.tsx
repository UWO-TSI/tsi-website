"use client";

import DeveloperProjects from "./DeveloperProjects";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef, useMemo, useImperativeHandle, type Ref } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import FormField from "./FormField";
import FormProgress from "./FormProgress";
import ResumeUpload from "./ResumeUpload";
import PortfolioUpload, { type PortfolioFile } from "./PortfolioUpload";
import SuccessScreen from "./SuccessScreen";
import Button from "@/components/ui/Button";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Position, EssayAnswer } from "@/lib/recruitment";
import { HEARD_ABOUT_OPTIONS, YEAR_OPTIONS, isApplicationLink } from "@/lib/recruitment";

import { applicationDraftKey, createApplicationDraft, confirmedApplication, readApplicationDraft, type DraftPayload, type DraftSaveResult, type DraftStatus } from "./application-draft";
import { SaveStatus } from "./ui";

export interface ApplicationFormHandle {
  flushDraft: () => Promise<DraftSaveResult>;
  isSubmitting: () => boolean;
}

interface ApplicationFormProps {
  position: Position;
  userId: string;
  onSubmitted?: () => void;
  onReturnToBoard?: () => void;
  onPreviewComplete?: () => void;
  layout?: "steps" | "sheet";
  preview?: boolean;
  ref?: Ref<ApplicationFormHandle>;
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
  /** PM only: past projects, solo or team (optional). */
  past_projects: string;
  heard_about_us: string;
  essay_answers: Record<string, string>;
  resume_storage_path: string | null;
  resume_filename: string | null;
  resume_size_bytes: number | null;
  /** Portfolio files (resume step, VP Marketing). */
  portfolio_files: PortfolioFile[];
  /** Optional hosted link instead of (or in addition to) portfolio files. */
  portfolio_link: string;
  /** Creative-piece files (essay step, VP Marketing + VP Internal). */
  creative_piece_files: PortfolioFile[];
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
  past_projects: "",
  heard_about_us: "",
  essay_answers: {},
  resume_storage_path: null,
  resume_filename: null,
  resume_size_bytes: null,
  portfolio_files: [],
  portfolio_link: "",
  creative_piece_files: [],
};


// Reserved IDs for profile fields stashed inside essay_answers since the
// applications table doesn't have dedicated columns for them. Admin views
// and the user's review screen pull these out separately from real essays.
export const META_OTHER_LINKS_ID = "__profile_other_links";
export const META_COMMITMENTS_ID = "__profile_commitments_next_year";
export const META_PAST_PROJECTS_ID = "__past_projects";
export const META_PORTFOLIO_FILES_ID = "__portfolio_files";
export const META_PORTFOLIO_LINK_ID = "__portfolio_link";
export const META_CREATIVE_PIECE_FILES_ID = "__creative_piece_files";

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

export default function ApplicationForm(props: ApplicationFormProps) {
  return <ApplicationFormInner key={`${props.userId}:${props.position.id}:${!!props.preview}`} {...props} />;
}

function ApplicationFormInner({
  position,
  userId,
  onSubmitted,
  onReturnToBoard,
  onPreviewComplete,
  layout = "steps",
  preview = false,
  ref: formRef,
}: ApplicationFormProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const latestForm = useRef<FormData>(EMPTY_FORM);
  const formElement = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const submittedCallback = useRef(onSubmitted);
  useEffect(() => { submittedCallback.current = onSubmitted; }, [onSubmitted]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [hydrated, setHydrated] = useState(preview);
  const [hydrationError, setHydrationError] = useState<"session" | "draft" | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<DraftStatus>("idle");
  const hydratedRef = useRef(preview);
  const draft = useMemo(() => createApplicationDraft<FormData>({
    writeLocal: payload => localStorage.setItem(applicationDraftKey(userId, position.id), JSON.stringify(payload)),
    removeLocal: () => localStorage.removeItem(applicationDraftKey(userId, position.id)),
    saveRemote: async data => {
      const response = await fetch("/api/drafts", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_id: position.id, form_data: data }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 409) {
        const result = await response.json().catch(() => null);
        if (result?.code === "ALREADY_SUBMITTED" && confirmedApplication(result.submitted_application, position.id)) return "submitted";
      }
      return response.ok;
    },
    onStatus: setDraftSyncState,
    onSubmitted: () => { setAlreadySubmitted(true); setSubmitted(true); submittedCallback.current?.(); },
  }), [position.id, userId]);

  useImperativeHandle(formRef, () => ({
    flushDraft: async () => {
      if (submittingRef.current) return "error";
      if (!hydratedRef.current) return "saved";
      return preview ? "saved" : draft.flush();
    },
    isSubmitting: () => submittingRef.current,
  }), [draft, preview]);

  useEffect(() => {
    draft.activate();
    if (preview) return () => draft.dispose();
    let cancelled = false;
    hydratedRef.current = false;
    const controller = new AbortController();
    async function hydrate() {
      let stage: "session" | "draft" = "session";
      try {
        const { data: { user }, error } = await createClient().auth.getUser();
        if (error || user?.id !== userId) throw new Error("Session changed");
        stage = "draft";
        const defaults = { full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "", email: user.email ?? "" };
        let local: DraftPayload<Partial<FormData>> | null = null;
        try { local = JSON.parse(localStorage.getItem(applicationDraftKey(userId, position.id)) ?? "null"); } catch { /* Browser storage is optional. */ }
        const res = await fetch(`/api/drafts?position_id=${encodeURIComponent(position.id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const stored = await readApplicationDraft<Partial<FormData>>(res, position.id);
        if (cancelled) return;
        if (stored.submitted) {
          draft.submitted();
          hydratedRef.current = true;
          setHydrated(true);
          setAlreadySubmitted(true);
          setSubmitted(true);
          submittedCallback.current?.();
          return;
        }
        const remote = stored.draft;
        const candidates = [local, remote].filter((candidate): candidate is DraftPayload<Partial<FormData>> =>
          !!candidate?.form_data && typeof candidate.form_data === "object" && !Array.isArray(candidate.form_data) && Number.isFinite(Date.parse(candidate.updated_at)));
        candidates.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
        const chosen = candidates[0];
        const restored = { ...EMPTY_FORM, ...defaults, ...chosen?.form_data };
        const data: FormData = {
          ...restored,
          essay_answers: restored.essay_answers && typeof restored.essay_answers === "object" ? restored.essay_answers : {},
          portfolio_files: Array.isArray(restored.portfolio_files) ? restored.portfolio_files : [],
          creative_piece_files: Array.isArray(restored.creative_piece_files) ? restored.creative_piece_files : [],
        };
        for (const [key, initial] of Object.entries(EMPTY_FORM)) {
          if (typeof initial === "string" && typeof data[key as keyof FormData] !== "string") Object.assign(data, { [key]: initial });
        }
        data.essay_answers = Object.fromEntries(Object.entries(data.essay_answers).filter(([, value]) => typeof value === "string"));
        latestForm.current = data;
        hydratedRef.current = true;
        setFormData(data);
        setHydrated(true);
        if (chosen) { setDraftRestoredAt(chosen.updated_at); draft.update(data); }
      } catch { if (!cancelled) setHydrationError(stage); }
    }
    void hydrate();
    const retry = () => { if (hydratedRef.current && !submittingRef.current) void draft.flush(); };
    window.addEventListener("online", retry);
    return () => { cancelled = true; hydratedRef.current = false; controller.abort(); window.removeEventListener("online", retry); draft.dispose(); };
  }, [draft, position.id, userId, preview]);

  useEffect(() => {
    if (preview || !(submitting || draftSyncState === "saving" || draftSyncState === "error")) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftSyncState, submitting, preview]);

  useEffect(() => {
    if (layout !== "sheet") return;
    const frame = requestAnimationFrame(() => {
      const heading = formElement.current?.querySelector<HTMLElement>("[data-form-section] h3");
      if (!heading) return;
      heading.focus({ preventScroll: true });
      let scroll = formElement.current?.parentElement;
      while (scroll && scroll !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(scroll).overflowY)) {
          scroll.scrollTo({ top: 0, behavior: "instant" });
          break;
        }
        scroll = scroll.parentElement;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [layout, step]);

  const updateForm = useCallback((change: (current: FormData) => FormData) => {
    if (!hydratedRef.current || submittingRef.current) return;
    const next = change(latestForm.current);
    latestForm.current = next;
    setFormData(next);
    if (!preview) draft.update(next);
  }, [draft, preview]);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    updateForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, [updateForm]);
  const updateEssay = useCallback((questionId: string, value: string) => {
    updateForm(prev => ({ ...prev, essay_answers: { ...prev.essay_answers, [questionId]: value } }));
    setErrors(prev => { const next = { ...prev }; delete next[`essay_${questionId}`]; return next; });
  }, [updateForm]);
  const updateResume = useCallback((data: { path: string; filename: string; size: number } | null) => {
    updateForm(prev => ({ ...prev, resume_storage_path: data?.path ?? null, resume_filename: data?.filename ?? null, resume_size_bytes: data?.size ?? null }));
    setErrors(prev => { const next = { ...prev }; delete next.resume; return next; });
  }, [updateForm]);
  const updatePortfolioFiles = useCallback((files: PortfolioFile[]) => {
    updateForm(prev => ({ ...prev, portfolio_files: files }));
  }, [updateForm]);
  const updateCreativePieceFiles = useCallback((files: PortfolioFile[]) => {
    updateForm(prev => ({ ...prev, creative_piece_files: files }));
  }, [updateForm]);

  // Step validation
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};

    if (s === 0) {
      if (!formData.full_name.trim()) errs.full_name = "Required";
      if (!formData.email.trim()) errs.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        errs.email = "Invalid email";
      if (!formData.program_major.trim()) errs.program_major = "Required";
      if (!formData.year_of_study) errs.year_of_study = "Required";
      if (!formData.heard_about_us) errs.heard_about_us = "Required";
    }

    if (s === 1) {
      if (!preview && !formData.resume_storage_path) errs.resume = "Resume is required";
    }

    if (s === 2) {
      // Roles whose essay step accepts a file upload as a substitute
      // for written text. Both inputs are optional — applicant can
      // submit with neither, either, or both. Word cap still enforced
      // on whatever text is provided.
      const ROLES_WITH_ATTACHMENT = new Set(["vp-marketing", "vp-internal"]);
      const acceptsAttachment = ROLES_WITH_ATTACHMENT.has(position.slug);
      for (const q of position.essay_questions) {
        const answer = formData.essay_answers[q.id] ?? "";
        if (acceptsAttachment) {
          if (answer.trim() && countWords(answer) > q.max_words) {
            errs[`essay_${q.id}`] = `Exceeds ${q.max_words} word limit`;
          }
          continue;
        }
        if (!answer.trim() && q.required !== false) {
          errs[`essay_${q.id}`] = "Required";
        } else if (q.response_type === "url" && answer.trim() && !isApplicationLink(answer)) {
          errs[`essay_${q.id}`] = "Enter a valid http or https link";
        } else if (q.response_type !== "url" && countWords(answer) > q.max_words) {
          errs[`essay_${q.id}`] = `Exceeds ${q.max_words} word limit`;
        }
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length) requestAnimationFrame(() => {
      const section = formElement.current?.querySelector<HTMLElement>(`[data-form-section="${["profile", "resume", "your-answers"][s]}"]`);
      const target = section?.querySelector<HTMLElement>("[aria-invalid=true]") ?? section?.querySelector<HTMLElement>("h3, input, textarea, button");
      if (!target) return;
      if (target.tagName === "H3") target.tabIndex = -1;
      target.focus({ preventScroll: true });
      let scroll = formElement.current?.parentElement;
      while (scroll && scroll !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(scroll).overflowY)) {
          scroll.scrollTo({ top: scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24, behavior: "instant" });
          break;
        }
        scroll = scroll.parentElement;
      }
    });
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
    if (preview || submittingRef.current || !hydratedRef.current || !confirmChecked) return;
    for (const section of [0, 1, 2]) {
      if (!validateStep(section)) { setStep(section); return; }
    }
    submittingRef.current = true;
    setSubmitting(true);
    setErrors(prev => { const next = { ...prev }; delete next.submit; return next; });
    // Drain older writes before submission so a delayed autosave cannot recreate its draft.
    await draft.pauseForSubmission();

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
      ...(formData.past_projects.trim()
        ? [
            {
              question_id: META_PAST_PROJECTS_ID,
              answer: formData.past_projects.trim(),
            },
          ]
        : []),
      ...(formData.portfolio_files.length > 0
        ? [
            {
              question_id: META_PORTFOLIO_FILES_ID,
              answer: JSON.stringify(formData.portfolio_files),
            },
          ]
        : []),
      ...(formData.portfolio_link.trim()
        ? [
            {
              question_id: META_PORTFOLIO_LINK_ID,
              answer: formData.portfolio_link.trim(),
            },
          ]
        : []),
      ...(formData.creative_piece_files.length > 0
        ? [
            {
              question_id: META_CREATIVE_PIECE_FILES_ID,
              answer: JSON.stringify(formData.creative_piece_files),
            },
          ]
        : []),
    ];

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
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

      const result = await res.json().catch(() => null);
      if (res.ok && confirmedApplication(result, position.id)) {
        draft.submitted();
        setAlreadySubmitted(result.already_submitted === true);
        setSubmitted(true);
        onSubmitted?.();
        return;
      }
      const serverMessage = typeof result?.error === "string" ? result.error : "We couldn’t confirm that your application was received.";
      const guidance = res.status === 401
        ? "Your session expired. Save and close, then sign in again to this role."
        : res.status === 429 ? "Please wait a minute, then retry."
        : res.status === 409 ? "Your answers are still here. Check this role’s availability or My applications before retrying."
        : "Your answers are still here. Check your connection and retry; we’ll check for an existing submission to avoid duplicates.";
      setErrors({ submit: `${serverMessage} ${guidance}` });
      draft.resume();
    } catch {
      setErrors({ submit: "We couldn’t confirm your submission. Your answers are still here. Check My applications, then retry if needed; retrying won’t create a second application." });
      draft.resume();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!hydrated) return <div role={hydrationError ? "alert" : "status"} className="py-8">
    {hydrationError ? <><p>{hydrationError === "session" ? "We couldn’t verify your session." : "We couldn’t restore your saved progress."} Your saved answers haven’t changed.</p><p>{hydrationError === "session" ? "Sign in again, then return to this role." : "Check your connection and retry before editing."}</p><button type="button" onClick={() => location.reload()}>Try again</button></> : "Restoring your application…"}
  </div>;

  if (submitted) {
    return (
      <SuccessScreen
        positionTitle={position.title}
        applicantName={formData.full_name}
        position={position}
        positionSlug={position.slug}
        alreadySubmitted={alreadySubmitted}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user"><div ref={formElement} className="max-w-2xl mx-auto" data-layout={layout}>
      <AnimatePresence>
        {draftRestoredAt && !draftBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 p-4 rounded-xl mb-6"
            style={{
              background: "rgba(29,155,240,0.08)",
              border: "1px solid rgba(29,155,240,0.25)",
            }}
          >
            <span className="mt-0.5 w-5 h-5 rounded-md bg-[#1D9BF0]/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-[#1D9BF0]" />
            </span>
            <div className="flex-1">
              <p className="text-sm text-[#F1FFFF]">
                Draft restored
                <span className="text-[#9CA3AF] ml-2 text-xs font-mono">
                  · last edited {relativeTime(draftRestoredAt)}
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

      {layout === "steps" ? <FormProgress currentStep={step} totalSteps={STEP_LABELS.length} labels={STEP_LABELS} /> : <p className="mb-6 text-sm">{step === 3 ? "Review · Check your details before sending" : "Your application · Review before sending"}</p>}

      <div className="flex items-center justify-between gap-4 mb-6">
        {preview ? <p>Preview only · Nothing is saved or submitted.</p> : <><SaveStatus state={draftSyncState} />{(draftSyncState === "error" || draftSyncState === "local") && <button type="button" onClick={() => void draft.flush()}>Retry saving</button>}</>}
      </div>

      <fieldset disabled={submitting} className="relative min-w-0 border-0 p-0 m-0" aria-busy={submitting}>
        {position.slug === "developer" && step !== 3 && <DeveloperProjects />}
        <AnimatePresence mode={layout === "sheet" ? "sync" : "wait"} custom={direction}>
          {/* Step 0: Personal Info */}
          {(step === 0 || layout === "sheet" && step !== 3) && (
            <motion.div
              key="step0"
              data-form-section="profile"
              custom={direction}
              variants={slideVariants}
              initial={layout === "sheet" ? false : "enter"}
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-6"
            >
              {layout === "sheet" && <h3 tabIndex={-1}>Profile</h3>}
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
                  label="Phone (optional)"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(v) => updateField("phone", v)}
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
                        aria-pressed={selected}
                        type="button"
                        onClick={() =>
                          updateField("year_of_study", String(y.value))
                        }
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          selected
                            ? "bg-[#1D9BF0] text-[#F1FFFF] border border-[#1D9BF0]"
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
                placeholder="Portfolio, GitHub, Behance, anywhere else worth showing. One per line."
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
                        aria-pressed={selected}
                        type="button"
                        onClick={() => updateField("heard_about_us", o)}
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          selected
                            ? "bg-[#1D9BF0] text-[#F1FFFF] border border-[#1D9BF0]"
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
          {(step === 1 || layout === "sheet" && step !== 3) && (
            <motion.div
              key="step1"
              data-form-section="resume"
              custom={direction}
              variants={slideVariants}
              initial={layout === "sheet" ? false : "enter"}
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {layout === "sheet" && <h3 tabIndex={-1}>Resume</h3>}
              <div className="py-8">
                <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
                  Upload your resume
                </h3>
                <p className="text-sm text-[#9CA3AF] mb-6">
                  Upload a PDF of your resume. Make sure it&apos;s up to date
                  and highlights relevant experience.
                </p>
                {preview ? <div className="rounded-xl border border-dashed p-6"><p>PDF résumé · Up to 2 MB</p><button type="button" disabled>Upload disabled in preview</button></div> : <ResumeUpload
                  positionSlug={position.slug}
                  currentPath={formData.resume_storage_path}
                  currentFilename={formData.resume_filename}
                  currentSize={formData.resume_size_bytes}
                  onChange={updateResume}
                  error={errors.resume}
                />}

                {["director-marketing", "developer"].includes(position.slug) && (
                  <div className="mt-8">
                    <FormField label="Portfolio or project link (optional)" name="portfolio_link" type="url"
                      value={formData.portfolio_link} onChange={(v) => updateField("portfolio_link", v)}
                      placeholder="Your website, GitHub, or portfolio" />
                  </div>
                )}
                {position.slug === "vp-marketing" && (
                  <div className="mt-8 pt-8 border-t border-white/[0.06]">
                    {!preview && <PortfolioUpload
                      positionSlug={`${position.slug}-portfolio`}
                      files={formData.portfolio_files}
                      onChange={updatePortfolioFiles}
                      label="Portfolio (optional)"
                      description="Drop your broader body of work: designs, reels, photos, anything that shows what you've made before. Multiple files OK. Or paste a hosted link below."
                    />}
                    <div className="mt-4">
                      <FormField
                        label="Portfolio link (optional)"
                        name="portfolio_link"
                        type="url"
                        value={formData.portfolio_link}
                        onChange={(v) => updateField("portfolio_link", v)}
                        placeholder="Behance, Dribbble, personal site, anywhere your work lives"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Essay Questions */}
          {(step === 2 || layout === "sheet" && step !== 3) && (
            <motion.div
              key="step2"
              data-form-section="your-answers"
              custom={direction}
              variants={slideVariants}
              initial={layout === "sheet" ? false : "enter"}
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              {layout === "sheet" && <h3 tabIndex={-1}>Your answers</h3>}
              {position.slug === "pm" && (
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p className="text-sm text-[#F1FFFF] mb-1 font-medium">
                    Past projects (optional)
                  </p>
                  <p className="text-xs text-[#9CA3AF] mb-3 leading-relaxed">
                    Solo or team, school or personal. For each: what it was,
                    what you did, and a link if there is one. A few lines is
                    plenty.
                  </p>
                  <FormField
                    label=""
                    name="past_projects"
                    type="textarea"
                    value={formData.past_projects}
                    onChange={(v) => updateField("past_projects", v)}
                    placeholder="Project name, solo or team, what you built and your part in it, link if there is one"
                    rows={5}
                    wordCount={countWords(formData.past_projects)}
                    maxWords={300}
                  />
                </div>
              )}

              {position.essay_questions.map((q, i) => {
                const answer = formData.essay_answers[q.id] ?? "";
                // Roles where the essay accepts a file upload as the
                // submission. Marketing wants a creative piece; Internal
                // wants the actual planning doc / screenshots.
                const ATTACHMENT_ROLES: Record<
                  string,
                  { label: string; description: string }
                > = {
                  "vp-marketing": {
                    label: "Your video",
                    description:
                      "Upload a video that convinces us you're the candidate for this role. Up to 50MB here; if it's bigger, paste a hosted link (YouTube, Drive, Instagram) below instead.",
                  },
                  "vp-internal": {
                    label: "Planning doc / screenshots",
                    description:
                      "Drop a planning doc, screenshots, spreadsheets, or a zip with everything together. Image, video, PDF, or zip up to 50MB. For larger files, paste a hosted link below instead.",
                  },
                };
                const attachmentMeta = ATTACHMENT_ROLES[position.slug];
                const acceptsAttachment = !!attachmentMeta;
                return (
                  <div key={q.id}>
                    <label htmlFor={`essay_${q.id}`} className="block text-sm text-[#F1FFFF] mb-3 font-medium whitespace-pre-line">
                      {i + 1}. {q.question}
                    </label>
                    {q.response_type === "url" && (
                      <p className="text-sm text-[#9CA3AF] mb-3">Paste the link. Check that the team can open it.</p>
                    )}

                    {acceptsAttachment && !preview && (
                      <div className="mb-4">
                        <PortfolioUpload
                          positionSlug={`${position.slug}-creative`}
                          files={formData.creative_piece_files}
                          onChange={updateCreativePieceFiles}
                          label={attachmentMeta.label}
                          description={attachmentMeta.description}
                        />
                      </div>
                    )}

                    <FormField
                      label=""
                      name={`essay_${q.id}`}
                      type={q.response_type === "url" ? "url" : "textarea"}
                      value={answer}
                      onChange={(v) => updateEssay(q.id, v)}
                      required={!acceptsAttachment && q.required !== false}
                      placeholder={
                        q.response_type === "url" ? "https://…" : acceptsAttachment
                          ? "Or paste a link if your file is hosted elsewhere"
                          : undefined
                      }
                      rows={q.max_words <= 80 ? 2 : 6}
                      error={errors[`essay_${q.id}`]}
                      wordCount={q.response_type === "url" ? undefined : countWords(answer)}
                      maxWords={q.response_type === "url" ? undefined : q.max_words}
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
                    Do not use AI for the written questions
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                    The president is chronically on Claude and he can tell if
                    you Claude your answers. We&apos;d rather see a broken
                    English response with thought behind your answers than
                    slop.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <motion.div
              key="step3"
              data-form-section="review"
              custom={direction}
              variants={slideVariants}
              initial={layout === "sheet" ? false : "enter"}
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {layout === "sheet" && <h3 tabIndex={-1}>Review</h3>}
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
                  {formData.past_projects.trim() && (
                    <ReviewRow
                      label="Past projects"
                      value={formData.past_projects.trim()}
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
                    label="Resume"
                    value={formData.resume_filename ?? "Not uploaded"}
                  />
                  {formData.portfolio_files.length > 0 && (
                    <ReviewRow
                      label="Portfolio"
                      value={formData.portfolio_files
                        .map((f) => f.filename)
                        .join(", ")}
                    />
                  )}
                  {formData.portfolio_link.trim() && (
                    <ReviewRow
                      label="Portfolio link"
                      value={formData.portfolio_link.trim()}
                    />
                  )}
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
                    {formData.creative_piece_files.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-[#9CA3AF] mb-1.5 font-medium">
                          {position.slug === "vp-marketing"
                            ? "Video"
                            : "Attachment"}
                        </p>
                        <ul className="text-sm text-[#E5E7EB] space-y-1">
                          {formData.creative_piece_files.map((f) => (
                            <li key={f.path}>{f.filename}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {position.essay_questions.map((q) => (
                      <div key={q.id} className="pt-2">
                        <p className="text-xs text-[#9CA3AF] mb-1.5 font-medium whitespace-pre-line">
                          {q.question}
                        </p>
                        <p className="text-sm text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                          {formData.essay_answers[q.id] || "—"}
                        </p>
                        <p className="text-[10px] text-[#6B7280] font-mono mt-1">
                          {q.response_type === "url" ? "Link" : `${countWords(formData.essay_answers[q.id] ?? "")} / ${q.max_words} words`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                role="checkbox"
                aria-checked={confirmChecked}
                onClick={() => setConfirmChecked((v) => !v)}
                className="w-full flex items-start gap-3 p-4 rounded-xl mt-6 text-left transition-colors"
                style={{
                  background: confirmChecked
                    ? "rgba(29,155,240,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    confirmChecked
                      ? "rgba(29,155,240,0.4)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                }}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    confirmChecked
                      ? "bg-[#1D9BF0] border-[#1D9BF0]"
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
                  role="alert"
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
                    <p className="text-xs mt-3"><Link href="/student/apply/dashboard">Check My applications</Link> · <a href={`mailto:team@tethos.ca?subject=${encodeURIComponent(`Application help: ${position.title}`)}`}>Contact the recruitment team</a></p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </fieldset>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <div>
          {step > 0 && (
            <button
              onClick={() => layout === "sheet" ? setStep(0) : goBack()}
              disabled={submitting}
              className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
        <div>
          {step < STEP_LABELS.length - 1 ? (
            <Button variant="primary" onClick={() => {
              if (layout !== "sheet") { goNext(); return; }
              for (const section of [0, 1, 2]) { if (!validateStep(section)) { setStep(section); return; } }
              setStep(3);
            }}>
              <span className="flex items-center gap-2">
                {layout === "sheet" ? "Review application" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={preview ? onPreviewComplete : handleSubmit}
              disabled={(preview && !onPreviewComplete) || !confirmChecked || submitting}
            >
              {preview ? onPreviewComplete ? "Rehearse completion · No submission" : "Preview · Submission disabled" : submitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </div>
    </div></MotionConfig>
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
      <p className="font-mono text-xs text-[#1D9BF0] uppercase tracking-wider">
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
