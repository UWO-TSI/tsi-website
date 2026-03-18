"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─── ASCII Art ───────────────────────────────────────────────
const ASCII_WELCOME = `
 ╔══════════════════════════════════════════╗
 ║  ████████╗███████╗████████╗██╗  ██╗     ║
 ║  ╚══██╔══╝██╔════╝╚══██╔══╝██║  ██║     ║
 ║     ██║   █████╗     ██║   ███████║     ║
 ║     ██║   ██╔══╝     ██║   ██╔══██║     ║
 ║     ██║   ███████╗   ██║   ██║  ██║     ║
 ║     ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝     ║
 ╠══════════════════════════════════════════╣
 ║   INDUCTION PROTOCOL v3.2.1             ║
 ║   STATUS: AWAITING NEW AGENT            ║
 ╚══════════════════════════════════════════╝`;

const ASCII_CHARACTER = [
  "     ╭━━━╮     ",
  "     ┃ ◉ ◉┃     ",
  "     ┃  ▽ ┃     ",
  "     ╰┳━┳╯     ",
  "    ╭━╋━╋━╮    ",
  "    ┃ ┃ ┃ ┃    ",
  "    ╰━╋━╋━╯    ",
  "      ┃ ┃      ",
  "     ╭╯ ╰╮     ",
  "     ╰━━━╯     ",
];

const ASCII_COMPLETE = `
 ╔══════════════════════════════════════════╗
 ║         ★ AGENT INITIALIZED ★           ║
 ╠══════════════════════════════════════════╣
 ║                                          ║
 ║   ┌─────────────────────────────────┐   ║
 ║   │  ⚡ +500 XP EARNED              │   ║
 ║   │  ₮  +500 TETHOS COINS           │   ║
 ║   │  🏆 RANK: INITIATE → SCOUT      │   ║
 ║   │  📊 LEVEL UP! → LV.2            │   ║
 ║   └─────────────────────────────────┘   ║
 ║                                          ║
 ║   Your journey begins now.              ║
 ╚══════════════════════════════════════════╝`;

const QUEST_SECTIONS = [
  { label: "// CHAPTER 1: IDENTITY", startIndex: 0, endIndex: 2 },
  { label: "// CHAPTER 2: CONTACT", startIndex: 2, endIndex: 8 },
  { label: "// CHAPTER 3: SOCIALS", startIndex: 8, endIndex: 12 },
  { label: "// CHAPTER 4: PERSONALITY", startIndex: 12, endIndex: 16 },
];

// ─── Question Definitions ────────────────────────────────────
type QuestionType = "text" | "select" | "buttons" | "date" | "email";

interface Question {
  key: string;
  label: string;
  prompt: string; // RPG-flavored terminal prompt
  placeholder?: string;
  required?: boolean;
  type?: QuestionType;
  options?: string[];
}

const QUESTIONS: Question[] = [
  {
    key: "year",
    label: "Year",
    prompt: "How many cycles have you trained, agent?",
    required: true,
    type: "buttons",
    options: ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year+"],
  },
  {
    key: "program",
    label: "Program",
    prompt: "What discipline were you forged in?",
    required: true,
    type: "select",
    options: [
      "Computer Science",
      "Software Engineering",
      "Data Science",
      "Computer Engineering",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Medical Sciences",
      "Business (Ivey)",
      "Business (BMOS)",
      "Economics",
      "Mathematics",
      "Physics",
      "Biology",
      "Chemistry",
      "Psychology",
      "Political Science",
      "Media & Information Studies",
      "Arts & Humanities",
      "Music",
      "Other",
    ],
  },
  { key: "hometown", label: "Origin", prompt: "Where does your story begin?", placeholder: "Your hometown" },
  { key: "birthday", label: "Birth Date", prompt: "When were you brought online?", type: "date" },
  { key: "phone", label: "Comms", prompt: "Secure communication channel?", placeholder: "+1 (555) 000-0000" },
  { key: "uwo_email", label: "UWO Email", prompt: "Your institutional signal address?", placeholder: "you@uwo.ca", type: "email" },
  { key: "preferred_email", label: "Email", prompt: "Preferred hailing frequency?", placeholder: "you@email.com", type: "email" },
  { key: "gdrive_email", label: "Drive", prompt: "Google Drive access node?", placeholder: "Personal Google account", type: "email" },
  { key: "github_username", label: "GitHub", prompt: "Your codex archive handle?", placeholder: "@username" },
  { key: "discord_tag", label: "Discord", prompt: "Discord relay tag?", placeholder: "user#1234" },
  { key: "instagram", label: "Instagram", prompt: "Visual log transmitter?", placeholder: "@handle" },
  { key: "linkedin", label: "LinkedIn", prompt: "Professional dossier link?", placeholder: "Profile URL" },
  { key: "favourite_music", label: "Music", prompt: "What frequencies resonate with your core?", placeholder: "Genre, artist, or song" },
  { key: "dream_retirement", label: "Retirement", prompt: "Where will you rest when the mission ends?", placeholder: "e.g., Mars" },
  { key: "spirit_animal", label: "Spirit", prompt: "What creature embodies your essence?", placeholder: "e.g., Capybara" },
  { key: "fun_fact", label: "Fun Fact", prompt: "Deploy one classified detail about yourself.", placeholder: "Something people wouldn't guess" },
];

const TOTAL_STEPS = QUESTIONS.length + 2;

// ─── Helpers ─────────────────────────────────────────────────
function getCurrentChapter(qIndex: number): string {
  for (const section of QUEST_SECTIONS) {
    if (qIndex >= section.startIndex && qIndex < section.endIndex) {
      return section.label;
    }
  }
  return "";
}

function getXpForQuestion(qIndex: number): number {
  const q = QUESTIONS[qIndex];
  return q?.required ? 25 : 15;
}

// ─── Component ───────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = useState("");
  const [displayName, setDisplayName] = useState("AGENT");
  const [showXpGain, setShowXpGain] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Running XP counter for visual feedback
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const accumulatedXp = Object.keys(answers).reduce((sum, key) => {
    if (!answers[key]) return sum;
    const idx = QUESTIONS.findIndex((q) => q.key === key);
    return sum + (idx >= 0 ? getXpForQuestion(idx) : 0);
  }, 0);

  // ─── Terminal Log ────────────────────────────────────────
  const terminalLines: { text: string; color: "muted" | "yellow" | "cyan" | "green" | "blue" | "white" }[] = [];

  // Boot sequence
  terminalLines.push({ text: "$ tethos --init-agent", color: "cyan" });
  terminalLines.push({ text: "TETHOS INDUCTION PROTOCOL v3.2.1", color: "muted" });
  terminalLines.push({ text: "Scanning biometrics... GRANTED", color: "muted" });
  terminalLines.push({ text: "", color: "muted" });

  // Answered questions grouped by chapter
  let lastChapter = "";
  for (let i = 0; i < QUESTIONS.length; i++) {
    if (i >= step - 1) break;
    const chapter = getCurrentChapter(i);
    if (chapter !== lastChapter) {
      terminalLines.push({ text: "", color: "muted" });
      terminalLines.push({ text: chapter, color: "yellow" });
      lastChapter = chapter;
    }
    const q = QUESTIONS[i];
    const val = answers[q.key];
    if (val) {
      terminalLines.push({ text: `  ${q.label}: ${val}`, color: "green" });
    } else {
      terminalLines.push({ text: `  ${q.label}: [skipped]`, color: "muted" });
    }
  }

  // Auto-scroll terminal
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [step, answers]);

  // ─── Load Progress ───────────────────────────────────────
  useEffect(() => {
    async function loadProgress() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/student/login");
        return;
      }

      setDisplayName(user.user_metadata?.display_name || user.email?.split("@")[0] || "AGENT");

      let { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email || "",
            display_name: user.user_metadata?.display_name || user.email || "Agent",
          })
          .select("*")
          .single();
        profile = created;
      }

      if (profile) {
        if (profile.onboarding_completed) {
          router.push("/student/dashboard");
          return;
        }
        const savedStep = profile.onboarding_step || 0;
        setStep(savedStep);

        const restored: Record<string, string> = {};
        for (const q of QUESTIONS) {
          if (profile[q.key]) restored[q.key] = profile[q.key];
        }
        setAnswers(restored);

        const qIndex = savedStep - 1;
        if (qIndex >= 0 && qIndex < QUESTIONS.length) {
          const key = QUESTIONS[qIndex].key;
          if (profile[key]) setCurrentValue(profile[key]);
        }
      }
    }
    loadProgress();
  }, [router]);

  // ─── Boot Animation ──────────────────────────────────────
  useEffect(() => {
    const lines = [
      "$ tethos --init-agent",
      "TETHOS INDUCTION PROTOCOL v3.2.1",
      "Scanning biometrics...",
      "Clearance: GRANTED",
      "Loading agent profile module...",
      ">> AWAITING INPUT",
    ];
    let cancelled = false;
    const timers: NodeJS.Timeout[] = [];
    lines.forEach((line, idx) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setBootLines((prev) => [...prev, line]);
          if (idx === lines.length - 1) {
            setTimeout(() => !cancelled && setBootComplete(true), 120);
          }
        }, idx * 120)
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Auto-focus inputs
  useEffect(() => {
    if (!bootComplete || step < 1 || step > QUESTIONS.length) return;
    const q = QUESTIONS[step - 1];
    const t = q.type || "text";
    if (t === "text" || t === "email" || t === "date") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [step, bootComplete]);

  // ─── Save / Navigate ────────────────────────────────────
  const saveProgress = useCallback(
    async (nextStep: number, extraData?: Record<string, unknown>) => {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email || "",
        display_name: user.user_metadata?.display_name || user.email || "Agent",
        onboarding_step: nextStep,
        ...extraData,
      });

      setStep(nextStep);
      setCurrentValue("");
      setLoading(false);
    },
    []
  );

  function goToStep(target: number) {
    if (target < 0) return;
    if (target >= 1 && target <= QUESTIONS.length) {
      const key = QUESTIONS[target - 1].key;
      setCurrentValue(answers[key] || "");
    }
    setStep(target);
    saveProgress(target);
  }

  function submitAnswer(key: string, value: string) {
    const nextStep = step + 1;
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);

    // XP gain flash
    const idx = QUESTIONS.findIndex((q) => q.key === key);
    if (idx >= 0 && value) {
      const xp = getXpForQuestion(idx);
      setShowXpGain(xp);
      setTimeout(() => setShowXpGain(null), 1200);
    }

    if (nextStep - 1 < QUESTIONS.length) {
      const nextKey = QUESTIONS[nextStep - 1].key;
      setCurrentValue(newAnswers[nextKey] || "");
    }

    saveProgress(nextStep, { [key]: value || null });
  }

  function handleNext() {
    const qIndex = step - 1;
    if (qIndex < 0 || qIndex >= QUESTIONS.length) return;
    const question = QUESTIONS[qIndex];
    const value = currentValue.trim();
    if (question.required && !value) return;
    submitAnswer(question.key, value);
  }

  function handleButtonSelect(value: string) {
    const qIndex = step - 1;
    if (qIndex < 0 || qIndex >= QUESTIONS.length) return;
    setCurrentValue(value);
    submitAnswer(QUESTIONS[qIndex].key, value);
  }

  function handleSelectChange(value: string) {
    setCurrentValue(value);
    if (!value) return;
    const qIndex = step - 1;
    if (qIndex < 0 || qIndex >= QUESTIONS.length) return;
    submitAnswer(QUESTIONS[qIndex].key, value);
  }

  function handleSkip() {
    const nextStep = step + 1;
    if (nextStep - 1 < QUESTIONS.length) {
      const nextKey = QUESTIONS[nextStep - 1].key;
      setCurrentValue(answers[nextKey] || "");
    }
    saveProgress(nextStep);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  }

  async function completeOnboarding() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || "",
      display_name: user.user_metadata?.display_name || user.email || "Agent",
      onboarding_completed: true,
      onboarding_step: TOTAL_STEPS,
      xp: 500,
      tethos_coins: 500,
      level: 2,
    });

    if (upsertErr) {
      setError("Could not complete onboarding: " + upsertErr.message);
      setLoading(false);
      return;
    }

    try {
      await Promise.allSettled([
        supabase.from("tc_transactions").insert({
          user_id: user.id, amount: 500, balance_after: 500,
          type: "earn_quest", description: "Onboarding completion bonus",
        }),
        supabase.from("xp_transactions").insert({
          user_id: user.id, amount: 500,
          type: "earn_quest", description: "Onboarding completion bonus",
        }),
        supabase.from("notifications").insert({
          user_id: user.id, type: "achievement",
          title: "Welcome to Tethos!",
          body: "You earned 500 XP and 500 TC for completing onboarding.",
        }),
      ]);
    } catch {
      // Non-critical
    }

    window.location.href = "/student/election";
  }

  // ─── Derived State ───────────────────────────────────────
  const questionIndex = step - 1;
  const currentQuestion =
    questionIndex >= 0 && questionIndex < QUESTIONS.length ? QUESTIONS[questionIndex] : null;
  const isCompletionStep = step === QUESTIONS.length + 1;
  const progressFraction = step / TOTAL_STEPS;
  const qType = currentQuestion?.type || "text";
  const chapter = currentQuestion ? getCurrentChapter(questionIndex) : "";

  const inputClass =
    "w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_8px_rgba(0,47,167,0.2)] transition-all";

  const colorMap: Record<string, string> = {
    muted: "text-[var(--color-text-muted)]",
    yellow: "text-[var(--color-brand-yellow)]",
    cyan: "text-[var(--color-accent-cyan)]",
    blue: "text-[var(--color-brand-blue)]",
    green: "text-green-400",
    white: "text-[var(--color-text-primary)]",
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">

        {/* ─── Top HUD ─────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            {/* Mini Character Avatar */}
            <div className="w-10 h-10 rounded border border-[var(--color-brand-blue)]/30 bg-[var(--color-bg-alt)] flex items-center justify-center font-mono text-[0.5rem] leading-none text-[var(--color-accent-cyan)] overflow-hidden">
              <pre className="text-[3px] leading-[3.5px]">{ASCII_CHARACTER.join("\n")}</pre>
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-[var(--color-text-primary)] uppercase">
                {displayName}
              </p>
              <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                LV.1 INITIATE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[0.65rem] font-mono">
            <div className="flex items-center gap-1">
              <span className="text-[var(--color-accent-cyan)]">XP</span>
              <span className="text-[var(--color-text-primary)]">{accumulatedXp}</span>
              {showXpGain && (
                <span className="text-green-400 animate-pulse">+{showXpGain}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[var(--color-brand-yellow)]">{"\u20AE"}</span>
              <span className="text-[var(--color-text-primary)]">0</span>
            </div>
            <div className="text-[var(--color-text-muted)]">
              {answeredCount}/{QUESTIONS.length}
            </div>
          </div>
        </div>

        {/* ─── XP Progress Bar ─────────────────────── */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden border border-white/[0.03]">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-accent-cyan)]"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
          <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] shrink-0">
            {Math.round(progressFraction * 100)}%
          </span>
        </div>

        {/* ─── Terminal Log ─────────────────────────── */}
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-5 font-mono text-xs">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--glass-border)]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-auto text-[var(--color-text-muted)] text-[0.6rem]">
              tethos://onboarding
            </span>
          </div>
          <div ref={logRef} className="max-h-32 overflow-y-auto scrollbar-subtle space-y-px">
            {step === 0 ? (
              // Show boot animation lines before starting
              bootLines.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("$")
                      ? "text-[var(--color-accent-cyan)]"
                      : line.startsWith(">>")
                        ? "text-[var(--color-brand-yellow)]"
                        : "text-[var(--color-text-muted)]"
                  }
                >
                  {line}
                </div>
              ))
            ) : (
              terminalLines.map((line, i) => (
                <div
                  key={i}
                  className={`${colorMap[line.color]} ${line.text === "" ? "h-1.5" : ""}`}
                >
                  {line.text}
                </div>
              ))
            )}
            {bootComplete && step === 0 && (
              <span className="text-[var(--color-text-muted)] animate-pulse">█</span>
            )}
          </div>
        </div>

        {/* ─── Step Content ─────────────────────────── */}
        <div
          className={`transition-opacity duration-300 ${
            bootComplete ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* ── Welcome ── */}
          {step === 0 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              {/* ASCII Art Banner */}
              <pre className="text-[0.45rem] sm:text-[0.55rem] leading-tight font-mono text-[var(--color-brand-blue)] mb-5 overflow-x-auto whitespace-pre">
                {ASCII_WELCOME}
              </pre>

              <div className="border-t border-[var(--glass-border)] pt-4">
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  You have been selected to join an elite collective of student
                  developers, designers, and operators.
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                  Complete the induction to initialize your agent profile and
                  unlock the system.
                </p>

                <div className="bg-[var(--color-brand-yellow)]/5 border border-[var(--color-brand-yellow)]/20 rounded-md p-3 mb-5 font-mono text-xs">
                  <div className="flex items-center gap-2 text-[var(--color-brand-yellow)] mb-1">
                    <span>{"["} QUEST REWARD {"]"}</span>
                  </div>
                  <p className="text-[var(--color-text-muted)]">
                    +500 XP &middot; +500 {"\u20AE"} &middot; Rank Up to LV.2
                  </p>
                </div>

                <button
                  onClick={() => saveProgress(1)}
                  disabled={loading}
                  className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
                >
                  {loading ? "Initializing..." : "[ ACCEPT QUEST ]"}
                </button>
              </div>
            </div>
          )}

          {/* ── Question Steps ── */}
          {currentQuestion && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              {/* Chapter + Question Counter */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[0.6rem] font-mono text-[var(--color-brand-yellow)] uppercase tracking-wider">
                  {chapter}
                </span>
                <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                  [{questionIndex + 1}/{QUESTIONS.length}]
                  {currentQuestion.required && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                </span>
              </div>

              {/* RPG Prompt */}
              <div className="mb-5">
                <p className="text-[0.65rem] font-mono text-[var(--color-accent-cyan)] mb-1">
                  {">"} {currentQuestion.prompt}
                </p>
                <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                  {currentQuestion.label}
                </h2>
              </div>

              {/* XP Preview */}
              <div className="flex items-center gap-2 mb-4 text-[0.6rem] font-mono">
                <span className="text-[var(--color-text-muted)]">Reward:</span>
                <span className="text-[var(--color-accent-cyan)]">+{getXpForQuestion(questionIndex)} XP</span>
              </div>

              {/* Button Selection */}
              {qType === "buttons" && currentQuestion.options && (
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleButtonSelect(opt)}
                      disabled={loading}
                      className={`px-4 py-3 rounded-md border font-mono text-sm transition-all ${
                        currentValue === opt
                          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] shadow-[0_0_8px_rgba(0,47,167,0.2)]"
                          : "border-[var(--glass-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Dropdown Select */}
              {qType === "select" && currentQuestion.options && (
                <select
                  className={inputClass + " appearance-none"}
                  value={currentValue}
                  onChange={(e) => handleSelectChange(e.target.value)}
                >
                  <option value="">Choose...</option>
                  {currentQuestion.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {/* Text / Email / Date */}
              {(qType === "text" || qType === "email" || qType === "date") && (
                <input
                  ref={inputRef}
                  type={qType}
                  className={inputClass}
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion.placeholder}
                  autoFocus
                />
              )}

              {/* Navigation */}
              <div className="flex items-center gap-3 mt-5">
                {step > 1 && (
                  <button
                    onClick={() => goToStep(step - 1)}
                    disabled={loading}
                    className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--glass-border)] rounded-md hover:border-[var(--color-text-muted)]"
                  >
                    {"\u2190"} BACK
                  </button>
                )}
                {qType !== "buttons" && qType !== "select" && (
                  <button
                    onClick={handleNext}
                    disabled={loading || (currentQuestion.required && !currentValue.trim())}
                    className="flex-1 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-xs py-2.5 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
                  >
                    {loading ? "Saving..." : "NEXT \u2192"}
                  </button>
                )}
                {!currentQuestion.required && qType !== "buttons" && (
                  <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    SKIP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Completion ── */}
          {isCompletionStep && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              <pre className="text-[0.45rem] sm:text-[0.5rem] leading-tight font-mono text-[var(--color-brand-yellow)] mb-5 overflow-x-auto whitespace-pre">
                {ASCII_COMPLETE}
              </pre>

              <div className="border-t border-[var(--glass-border)] pt-4 text-center">
                <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                  Welcome to Tethos, <span className="text-[var(--color-brand-blue)] font-mono">{displayName}</span>.
                  Your profile is initialized and the system is ready.
                </p>

                {error && (
                  <p className="text-xs font-mono text-red-400 mb-4">{error}</p>
                )}

                <button
                  onClick={completeOnboarding}
                  disabled={loading}
                  className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
                >
                  {loading ? "[ LAUNCHING... ]" : "[ ENTER THE SYSTEM ]"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Bottom Flavor ───────────────────────── */}
        <div className="mt-4 text-center">
          <p className="text-[0.55rem] font-mono text-[var(--color-text-muted)]/40">
            TSI-SYS v3.2.1 &middot; TETHOS INDUCTION MODULE &middot; CLASSIFIED
          </p>
        </div>
      </div>
    </div>
  );
}
