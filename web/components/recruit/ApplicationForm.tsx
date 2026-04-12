"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FormField from "./FormField";
import FormProgress from "./FormProgress";
import ResumeUpload from "./ResumeUpload";
import SuccessScreen from "./SuccessScreen";
import Button from "@/components/ui/Button";
import { ArrowRight, ArrowLeft } from "lucide-react";
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
  heard_about_us: string;
  essay_answers: Record<string, string>;
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
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<FormData>({
    full_name: "",
    email: "",
    phone: "",
    program_major: "",
    year_of_study: "",
    linkedin_url: "",
    heard_about_us: "",
    essay_answers: {},
  });

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
      if (!resumeFile) errs.resume = "Resume is required";
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
    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    setSubmitting(true);

    try {
      // Upload resume first
      let resumeUrl = "";
      let resumeFilename = "";
      if (resumeFile) {
        const uploadData = new FormData();
        uploadData.append("file", resumeFile);
        uploadData.append("positionSlug", position.slug);
        uploadData.append("applicantName", formData.full_name);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });

        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          resumeUrl = uploadJson.fileUrl;
          resumeFilename = resumeFile.name;
        }
      }

      // Submit application
      const essayAnswers: EssayAnswer[] = position.essay_questions.map((q) => ({
        question_id: q.id,
        answer: formData.essay_answers[q.id] ?? "",
      }));

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
          resume_drive_url: resumeUrl || null,
          resume_filename: resumeFilename || null,
          essay_answers: essayAnswers,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const errData = await res.json();
        setErrors({ submit: errData.error || "Submission failed. Try again." });
      }
    } catch {
      setErrors({ submit: "Network error. Please try again." });
    }

    setSubmitting(false);
  };

  if (submitted) {
    return <SuccessScreen positionTitle={position.title} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <FormProgress
        currentStep={step}
        totalSteps={STEP_LABELS.length}
        labels={STEP_LABELS}
      />

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Year of Study"
                  name="year_of_study"
                  type="select"
                  value={formData.year_of_study}
                  onChange={(v) => updateField("year_of_study", v)}
                  required
                  error={errors.year_of_study}
                  options={YEAR_OPTIONS.map((y) => ({
                    value: String(y.value),
                    label: y.label,
                  }))}
                />
                <FormField
                  label="LinkedIn (optional)"
                  name="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(v) => updateField("linkedin_url", v)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <FormField
                label="How did you hear about us?"
                name="heard_about_us"
                type="select"
                value={formData.heard_about_us}
                onChange={(v) => updateField("heard_about_us", v)}
                required
                error={errors.heard_about_us}
                options={HEARD_ABOUT_OPTIONS.map((o) => ({
                  value: o,
                  label: o,
                }))}
              />
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
                  file={resumeFile}
                  onFileSelect={setResumeFile}
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
              <div className="glass-card p-6 md:p-8 space-y-4">
                <h3 className="text-lg font-semibold text-[#F1FFFF] mb-4">
                  Review your application
                </h3>

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
                  <ReviewRow label="LinkedIn" value={formData.linkedin_url} />
                )}
                <ReviewRow label="Heard via" value={formData.heard_about_us} />
                <ReviewRow
                  label="Resume"
                  value={resumeFile?.name ?? "Not uploaded"}
                />

                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="font-mono text-xs text-[#002FA7] mb-2 uppercase tracking-wider">
                    Essay Responses
                  </p>
                  {position.essay_questions.map((q) => (
                    <div key={q.id} className="mb-3">
                      <p className="text-xs text-[#9CA3AF] mb-1">
                        {q.question}
                      </p>
                      <p className="text-sm text-[#E5E7EB] whitespace-pre-wrap">
                        {formData.essay_answers[q.id] || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {errors.submit && (
                <p className="text-sm text-[#EF4444] mt-4 text-center">
                  {errors.submit}
                </p>
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
      <span className="text-sm text-[#E5E7EB]">{value}</span>
    </div>
  );
}
