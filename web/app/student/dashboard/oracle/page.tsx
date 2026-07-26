"use client";

import { useState, useEffect, useCallback } from "react";
import { AudioManager } from "@/lib/game/audio";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Sword,
  Heart,
  Wrench,
  X,
  // subclass icons
  Crown,
  Shield,
  Zap,
  Brain,
  Compass,
  BookOpen,
  Eye,
  Feather,
  Sun,
  Flame,
  HeartHandshake,
  Home,
  Cog,
  Palette,
  Anchor,
  Mic,
  type LucideIcon,
} from "lucide-react";

// ─── Question Bank (specs/oracle-questions.md) ──────────────────
interface Answer { text: string; value: "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P" }
interface Question { id: number; axis: string; text: string; answers: Answer[] }

const QUESTIONS: Question[] = [
  { id: 1, axis: "EI", text: "When you join a new team or club, you tend to...", answers: [
    { text: "Jump in, introduce yourself, and start talking to everyone", value: "E" },
    { text: "Observe first, then connect with one or two people you click with", value: "I" },
    { text: "Look for a role or task to do — you connect through work", value: "I" },
    { text: "Bring energy to the room and rally people around an idea", value: "E" },
  ]},
  { id: 2, axis: "EI", text: "After a long day of meetings and collaboration, you recharge by...", answers: [
    { text: "Going out with friends — more people, more energy", value: "E" },
    { text: "Spending time alone with music, a book, or a personal project", value: "I" },
  ]},
  { id: 3, axis: "EI", text: "In a brainstorm session, your natural role is...", answers: [
    { text: "Throwing out ideas quickly and building on others' suggestions out loud", value: "E" },
    { text: "Listening carefully, then offering one well-thought-out idea", value: "I" },
    { text: "Facilitating — making sure everyone's voice is heard", value: "E" },
    { text: "Sketching or writing notes quietly, then sharing a synthesis", value: "I" },
  ]},
  { id: 4, axis: "SN", text: "When learning a new technology or framework, you prefer to...", answers: [
    { text: "Follow the official tutorial step by step, building something concrete", value: "S" },
    { text: "Skim the docs to understand the big picture, then experiment", value: "N" },
    { text: "Look at real-world examples and replicate what works", value: "S" },
    { text: "Imagine what you could build with it, then learn what you need as you go", value: "N" },
  ]},
  { id: 5, axis: "SN", text: "When planning a project, you focus first on...", answers: [
    { text: "What's been done before that works — proven patterns and templates", value: "S" },
    { text: "What's possible — new approaches nobody has tried yet", value: "N" },
  ]},
  { id: 6, axis: "SN", text: "A teammate says 'this feature is 80% done.' You think...", answers: [
    { text: "What specific tasks are left? Show me the checklist.", value: "S" },
    { text: "Is the remaining 20% the critical part that makes it actually good?", value: "N" },
    { text: "Let me test what's built so far — I trust what I can see", value: "S" },
    { text: "What could we add to make it 10× better instead of just finishing it?", value: "N" },
  ]},
  { id: 7, axis: "TF", text: "Two teammates disagree on a technical approach. You...", answers: [
    { text: "Evaluate both options on merit — data, performance, maintainability", value: "T" },
    { text: "Consider how each person feels about their approach and find a compromise", value: "F" },
    { text: "Pick the one that ships faster — efficiency matters most", value: "T" },
    { text: "Make sure neither person feels dismissed, even if one approach is clearly better", value: "F" },
  ]},
  { id: 8, axis: "TF", text: "When giving feedback on someone's work, you prioritize...", answers: [
    { text: "Being direct and specific — they need to know exactly what to fix", value: "T" },
    { text: "Being encouraging first, then gently suggesting improvements", value: "F" },
  ]},
  { id: 9, axis: "TF", text: "A nonprofit client requests a feature that's technically simple but you think is bad UX. You...", answers: [
    { text: "Present the data and logic for why it's bad UX — let the evidence decide", value: "T" },
    { text: "Understand why they want it — there might be user needs you're missing", value: "F" },
    { text: "Build both options and A/B test — remove opinions from the equation", value: "T" },
    { text: "Find a middle ground that respects their vision while improving the experience", value: "F" },
  ]},
  { id: 10, axis: "JP", text: "Your ideal project workflow looks like...", answers: [
    { text: "Clear milestones, deadlines, and a structured plan from day one", value: "J" },
    { text: "A rough direction, then adapt as you learn and discover", value: "P" },
    { text: "Sprints with defined goals, but flexibility within each sprint", value: "J" },
    { text: "Work on whatever feels most important right now — plans change anyway", value: "P" },
  ]},
  { id: 11, axis: "JP", text: "It's Friday and your weekend is free. You...", answers: [
    { text: "Already have plans — you like knowing what's happening", value: "J" },
    { text: "Keep it open — the best weekends are spontaneous", value: "P" },
  ]},
  { id: 12, axis: "JP", text: "A deadline just moved up by a week. Your reaction...", answers: [
    { text: "Immediately restructure the plan — reprioritize tasks, cut scope, notify the team", value: "J" },
    { text: "Stay calm — you work well under pressure and figure it out as you go", value: "P" },
    { text: "Check what's already done and make a checklist of what absolutely must ship", value: "J" },
    { text: "Get excited — constraints force creativity and the best work happens fast", value: "P" },
  ]},
];

// ─── Class Mapping ──────────────────────────────────────────────
// Colors per specs/ux-classes.md §1: Warrior #EF4444, Mage #6366F1, Healer #22C55E, Rogue #F59E0B
const MBTI_TO_CLASS: Record<string, { class: string; subclass: string; color: string }> = {
  ENTJ: { class: "Warrior", subclass: "Tactical Commander", color: "#EF4444" },
  ESTJ: { class: "Warrior", subclass: "Iron Marshal", color: "#EF4444" },
  ESTP: { class: "Warrior", subclass: "Vanguard Striker", color: "#EF4444" },
  ENTP: { class: "Warrior", subclass: "Battle Strategist", color: "#EF4444" },
  INTJ: { class: "Mage", subclass: "Arcane Architect", color: "#6366F1" },
  INTP: { class: "Mage", subclass: "Lore Seeker", color: "#6366F1" },
  INFJ: { class: "Mage", subclass: "Oracle Sage", color: "#6366F1" },
  INFP: { class: "Mage", subclass: "Dream Weaver", color: "#6366F1" },
  ENFJ: { class: "Healer", subclass: "Beacon Guide", color: "#22C55E" },
  ENFP: { class: "Healer", subclass: "Spirit Catalyst", color: "#22C55E" },
  ESFJ: { class: "Healer", subclass: "Shield Warden", color: "#22C55E" },
  ISFJ: { class: "Healer", subclass: "Sanctuary Keeper", color: "#22C55E" },
  ISTP: { class: "Rogue", subclass: "Shadow Tinker", color: "#F59E0B" },
  ISFP: { class: "Rogue", subclass: "Wandering Artisan", color: "#F59E0B" },
  ISTJ: { class: "Rogue", subclass: "Silent Sentinel", color: "#F59E0B" },
  ESFP: { class: "Rogue", subclass: "Blaze Performer", color: "#F59E0B" },
};

// Lucide icons for the 4 main classes (specs/ux-classes.md §1).
const CLASS_ICONS: Record<string, LucideIcon> = {
  Warrior: Sword,
  Mage: Sparkles,
  Healer: Heart,
  Rogue: Wrench,
};

// Lucide icons for the 16 subclasses — semantic picks per name:
//   Warrior: Crown (commander) / Shield (marshal) / Zap (striker) / Brain (strategist)
//   Mage:    Compass (architect) / BookOpen (seeker) / Eye (sage) / Feather (weaver)
//   Healer:  Sun (beacon) / Flame (catalyst) / HeartHandshake (warden) / Home (keeper)
//   Rogue:   Cog (tinker) / Palette (artisan) / Anchor (sentinel) / Mic (performer)
const SUBCLASS_ICONS: Record<string, LucideIcon> = {
  "Tactical Commander": Crown,
  "Iron Marshal": Shield,
  "Vanguard Striker": Zap,
  "Battle Strategist": Brain,
  "Arcane Architect": Compass,
  "Lore Seeker": BookOpen,
  "Oracle Sage": Eye,
  "Dream Weaver": Feather,
  "Beacon Guide": Sun,
  "Spirit Catalyst": Flame,
  "Shield Warden": HeartHandshake,
  "Sanctuary Keeper": Home,
  "Shadow Tinker": Cog,
  "Wandering Artisan": Palette,
  "Silent Sentinel": Anchor,
  "Blaze Performer": Mic,
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: "You lead with strategy and action. Your strength lies in turning plans into reality.",
  Mage: "You think deeply and create brilliantly. Your power is insight and innovation.",
  Healer: "You connect and uplift others. Your gift is building teams that thrive.",
  Rogue: "You adapt and craft with precision. Your edge is resourcefulness and independence.",
};

// ─── Progress persistence ───────────────────────────────────────
// Per spec ux-oracle-v2 §7.2: "Leave quiz? Your progress will be saved."
// No quiz_progress table yet — localStorage is the cosmetic-tier home.
const PROGRESS_KEY = "tsi.oracle.progress.v1";
interface SavedProgress { qIndex: number; answers: string[]; savedAt: number }

function loadProgress(): SavedProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (typeof parsed?.qIndex !== "number" || !Array.isArray(parsed?.answers)) return null;
    if (parsed.qIndex < 0 || parsed.qIndex >= QUESTIONS.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress(qIndex: number, answers: string[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedProgress = { qIndex, answers, savedAt: Date.now() };
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
  } catch {
    /* quota or private mode — silent */
  }
}

function clearProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* silent */
  }
}

type Phase = "quiz" | "scoring" | "reveal";

export default function OraclePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("quiz");
  // Lazy initializers read saved progress on first render. loadProgress() is
  // SSR-safe (returns null when window is undefined). We gate rendering of the
  // quiz UI on `hydrated` to avoid SSR/client mismatch.
  const [qIndex, setQIndex] = useState<number>(() => loadProgress()?.qIndex ?? 0);
  const [answers, setAnswers] = useState<string[]>(() => loadProgress()?.answers ?? []);
  const [result, setResult] = useState<{ mbti: string; class: string; subclass: string; color: string } | null>(null);
  const [revealStage, setRevealStage] = useState(0);
  const [existingClass, setExistingClass] = useState<string | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Mark hydrated after first mount — gates rendering past SSR placeholder
  // so the localStorage-derived qIndex/answers don't cause a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-mount flag; localStorage isn't available server-side
    setHydrated(true);
  }, []);

  // Check if user already has a class
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d: Record<string, unknown> | null) => {
        if (!d) return;
        const p = (d.profile ?? d) as Record<string, unknown>;
        if (p?.class) setExistingClass(p.class as string);
      })
      .catch(() => {});
  }, []);

  const score = useCallback((ans: string[]) => {
    const counts: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    ans.forEach((v) => { if (v in counts) counts[v]++; });
    const ei = counts.E >= counts.I ? "E" : "I";
    const sn = counts.S >= counts.N ? "S" : "N";
    const tf = counts.T >= counts.F ? "T" : "F";
    const jp = counts.J >= counts.P ? "J" : "P";
    return ei + sn + tf + jp;
  }, []);

  // Loop iter 20 (2026-07-24): answer-pick beat — the chosen card presses
  // in with an indigo glow + a soft note, then the quiz advances after a
  // 260ms beat instead of hard-swapping.
  const [picked, setPicked] = useState<number | null>(null);
  const handleAnswer = (value: string, pickedIdx?: number) => {
    if (picked !== null) return; // ignore double-clicks during the beat
    if (typeof pickedIdx === "number") {
      setPicked(pickedIdx);
      AudioManager.playSFX("blip2");
      window.setTimeout(() => {
        setPicked(null);
        commitAnswer(value);
      }, 260);
      return;
    }
    commitAnswer(value);
  };
  const commitAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (newAnswers.length >= QUESTIONS.length) {
      // All questions answered — score and reveal
      setPhase("scoring");
      const mbti = score(newAnswers);
      const classInfo = MBTI_TO_CLASS[mbti] ?? MBTI_TO_CLASS.ENTJ;
      setResult({ mbti, ...classInfo });

      // Quiz done — clear saved progress.
      clearProgress();

      // Save to profile
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: classInfo.class, subclass: classInfo.subclass }),
      }).catch(() => {});

      // Reveal animation timeline
      setTimeout(() => setPhase("reveal"), 500);
      setTimeout(() => setRevealStage(1), 800);
      setTimeout(() => setRevealStage(2), 2000);
      setTimeout(() => setRevealStage(3), 2500);
      setTimeout(() => setRevealStage(4), 3300);
      setTimeout(() => setRevealStage(5), 4500);
    } else {
      // Persist progress before advancing so a refresh/exit resumes here.
      saveProgress(newAnswers.length, newAnswers);
      setTimeout(() => setQIndex(newAnswers.length), 300);
    }
  };

  const startQuiz = () => {
    clearProgress();
    setPhase("quiz");
    setQIndex(0);
    setAnswers([]);
    setResult(null);
    setRevealStage(0);
    setExistingClass(null);
  };

  const confirmExit = () => {
    // Persist current state defensively in case user opened the modal mid-question.
    saveProgress(qIndex, answers);
    setExitConfirmOpen(false);
    router.push("/student/dashboard");
  };

  // Already has a class — show result page
  if (existingClass && phase === "quiz" && answers.length === 0) {
    const info = Object.values(MBTI_TO_CLASS).find((c) => c.class === existingClass);
    const ExistingClassIcon = CLASS_ICONS[existingClass] ?? Sword;
    const existingColor = info?.color ?? "var(--color-text-main)";
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <ExistingClassIcon className="w-16 h-16 mb-4" style={{ color: existingColor }} aria-label={`${existingClass} class`} />
        <h1 className="text-4xl font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-main)" }}>{existingClass}</h1>
        {info && <p className="text-xl italic mb-4" style={{ color: "var(--color-text-soft)" }}>{info.subclass}</p>}
        <p className="text-base mb-8 max-w-md" style={{ color: "var(--color-text-muted)" }}>{CLASS_DESCRIPTIONS[existingClass]}</p>
        <button onClick={startQuiz} className="text-sm font-medium rounded-lg" style={{ padding: "8px 16px", border: "1px solid var(--glass-border-soft)", color: "var(--color-text-muted)" }}>
          Retake Quiz
        </button>
      </div>
    );
  }

  // Scoring / Reveal
  if (phase === "scoring" || phase === "reveal") {
    const RevealClassIcon = result ? CLASS_ICONS[result.class] : null;
    const SubIcon = result ? SUBCLASS_ICONS[result.subclass] : null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.1) 0%, transparent 50%)" }}>
        {revealStage < 2 && (
          <p className="text-lg font-mono italic animate-pulse" style={{ color: "var(--color-text-muted)", opacity: revealStage >= 1 ? 1 : 0, transition: "opacity 0.5s" }}>
            The Oracle has spoken...
          </p>
        )}
        {revealStage >= 2 && result && RevealClassIcon && (
          <>
            <RevealClassIcon
              className="w-16 h-16 mb-4"
              style={{ color: result.color, opacity: revealStage >= 2 ? 1 : 0, transition: "opacity 0.5s" }}
              aria-label={`${result.class} class`}
            />
            <h1
              className="text-5xl md:text-6xl font-bold uppercase tracking-widest mb-3"
              style={{
                color: "var(--color-text-main)",
                textShadow: `0 0 40px ${result.color}80, 0 0 80px ${result.color}33`,
                opacity: revealStage >= 2 ? 1 : 0,
                transition: "opacity 0.5s",
              }}
            >
              {result.class}
            </h1>
          </>
        )}
        {revealStage >= 3 && result && (
          <p className="text-2xl italic mb-6 flex items-center gap-2" style={{ color: "var(--color-text-soft)", opacity: revealStage >= 3 ? 1 : 0, transition: "opacity 0.5s" }}>
            {SubIcon ? <SubIcon className="w-5 h-5" style={{ color: result.color }} aria-hidden /> : null}
            {result.subclass}
          </p>
        )}
        {revealStage >= 4 && result && (
          <div style={{ opacity: revealStage >= 4 ? 1 : 0, transition: "opacity 0.5s" }}>
            <p className="text-base mb-2 max-w-md" style={{ color: "var(--color-text-muted)" }}>
              {CLASS_DESCRIPTIONS[result.class]}
            </p>
            <p className="text-sm font-mono mb-8" style={{ color: "var(--color-text-subtle)" }}>
              {result.mbti}
            </p>
          </div>
        )}
        {revealStage >= 5 && result && (
          <button
            onClick={() => router.push("/student/dashboard")}
            className="flex items-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{ height: 44, padding: "0 24px", background: result.color, color: "#ffffff", opacity: revealStage >= 5 ? 1 : 0, transition: "opacity 0.5s" }}
          >
            Enter the Campus <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Quiz phase — wait for localStorage hydration so qIndex matches resumed value.
  if (!hydrated) return null;
  const q = QUESTIONS[qIndex];
  if (!q) return null;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8 relative"
      style={{ background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.04) 0%, transparent 60%)" }}
    >
      {/* Top bar: Exit (left) + Stage indicator (right) — spec ux-oracle-v2 §7.1/7.2 */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between"
        style={{
          height: 48,
          padding: "0 16px",
          background: "rgba(10, 10, 26, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 15,
        }}
      >
        <button
          onClick={() => setExitConfirmOpen(true)}
          className="flex items-center gap-1.5 rounded-lg text-sm transition-colors hover:border-[var(--color-text-soft)]"
          style={{
            height: 28,
            padding: "0 10px",
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "var(--color-text-muted)",
          }}
          aria-label="Exit quiz"
        >
          <X className="w-4 h-4" />
          <span>Exit</span>
        </button>
        <span className="text-xs sm:text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>
          Stage {qIndex + 1} / {QUESTIONS.length}
        </span>
      </div>

      {/* Question */}
      <h2
        key={qIndex}
        className="text-xl md:text-2xl font-medium text-center mb-8 max-w-[720px] mt-12"
        style={{ color: "var(--color-text-main)", lineHeight: 1.3, animation: "fadeInUp 0.4s ease-out" }}
      >
        {q.text}
      </h2>

      {/* Answer Cards */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {q.answers.map((a, i) => (
          <button
            key={`${qIndex}-${i}`}
            onClick={() => handleAnswer(a.value, i)}
            className="text-left transition-all hover:translate-y-[-4px] hover:border-[rgba(99,102,241,0.4)]"
            style={{
              width: 180,
              minHeight: 160,
              padding: 24,
              background: picked === i ? "rgba(99, 102, 241, 0.12)" : "var(--color-surface)",
              border: picked === i ? "1px solid rgba(99, 102, 241, 0.65)" : "1px solid var(--glass-border-soft)",
              borderRadius: 16,
              color: "var(--color-text-soft)",
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.5,
              cursor: "pointer",
              transform: picked === i ? "scale(0.96)" : undefined,
              boxShadow: picked === i ? "0 0 18px rgba(99, 102, 241, 0.35)" : undefined,
              opacity: picked !== null && picked !== i ? 0.45 : 1,
              animation: `fadeInUp 0.3s ease-out ${i * 0.08}s both`,
            }}
          >
            {a.text}
          </button>
        ))}
      </div>

      {/* Progress Bar */}
      <div style={{ width: "min(400px, 80vw)" }}>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#27272a" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(qIndex / QUESTIONS.length) * 100}%`, background: "#6366F1", transitionDuration: "0.4s" }} />
        </div>
        <p className="text-right mt-1.5 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{qIndex + 1} of {QUESTIONS.length}</p>
      </div>

      {/* Exit confirmation modal */}
      {exitConfirmOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ background: "rgba(0, 0, 0, 0.6)", zIndex: 30 }}
          onClick={() => setExitConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="oracle-exit-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="oracle-exit-title" className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-main)" }}>
              Leave quiz?
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
              Your progress will be saved. You can pick up where you left off later.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setExitConfirmOpen(false)}
                className="text-sm font-medium rounded-lg"
                style={{ height: 36, padding: "0 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--color-text-soft)" }}
              >
                Stay
              </button>
              <button
                onClick={confirmExit}
                className="text-sm font-semibold rounded-lg"
                style={{ height: 36, padding: "0 16px", background: "#6366F1", color: "#ffffff" }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
