"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

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
const MBTI_TO_CLASS: Record<string, { class: string; subclass: string; color: string }> = {
  ENTJ: { class: "Warrior", subclass: "Tactical Commander", color: "#ef4444" },
  ESTJ: { class: "Warrior", subclass: "Iron Marshal", color: "#ef4444" },
  ESTP: { class: "Warrior", subclass: "Vanguard Striker", color: "#ef4444" },
  ENTP: { class: "Warrior", subclass: "Battle Strategist", color: "#ef4444" },
  INTJ: { class: "Mage", subclass: "Arcane Architect", color: "#002fa7" },
  INTP: { class: "Mage", subclass: "Lore Seeker", color: "#002fa7" },
  INFJ: { class: "Mage", subclass: "Oracle Sage", color: "#002fa7" },
  INFP: { class: "Mage", subclass: "Dream Weaver", color: "#002fa7" },
  ENFJ: { class: "Healer", subclass: "Beacon Guide", color: "#22c55e" },
  ENFP: { class: "Healer", subclass: "Spirit Catalyst", color: "#22c55e" },
  ESFJ: { class: "Healer", subclass: "Shield Warden", color: "#22c55e" },
  ISFJ: { class: "Healer", subclass: "Sanctuary Keeper", color: "#22c55e" },
  ISTP: { class: "Rogue", subclass: "Shadow Tinker", color: "#ffd166" },
  ISFP: { class: "Rogue", subclass: "Wandering Artisan", color: "#ffd166" },
  ISTJ: { class: "Rogue", subclass: "Silent Sentinel", color: "#ffd166" },
  ESFP: { class: "Rogue", subclass: "Blaze Performer", color: "#ffd166" },
};

const CLASS_ICONS: Record<string, string> = {
  Warrior: "⚔️", Mage: "🔮", Healer: "💚", Rogue: "🗡️",
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: "You lead with strategy and action. Your strength lies in turning plans into reality.",
  Mage: "You think deeply and create brilliantly. Your power is insight and innovation.",
  Healer: "You connect and uplift others. Your gift is building teams that thrive.",
  Rogue: "You adapt and craft with precision. Your edge is resourcefulness and independence.",
};

type Phase = "quiz" | "scoring" | "reveal";

export default function OraclePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ mbti: string; class: string; subclass: string; color: string } | null>(null);
  const [revealStage, setRevealStage] = useState(0);
  const [existingClass, setExistingClass] = useState<string | null>(null);

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

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (newAnswers.length >= QUESTIONS.length) {
      // All questions answered — score and reveal
      setPhase("scoring");
      const mbti = score(newAnswers);
      const classInfo = MBTI_TO_CLASS[mbti] ?? MBTI_TO_CLASS.ENTJ;
      setResult({ mbti, ...classInfo });

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
      setTimeout(() => setQIndex(newAnswers.length), 300);
    }
  };

  const startQuiz = () => {
    setPhase("quiz");
    setQIndex(0);
    setAnswers([]);
    setResult(null);
    setRevealStage(0);
    setExistingClass(null);
  };

  // Already has a class — show result page
  if (existingClass && phase === "quiz" && answers.length === 0) {
    const info = Object.values(MBTI_TO_CLASS).find((c) => c.class === existingClass);
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-6xl mb-4">{CLASS_ICONS[existingClass] ?? "⚔️"}</p>
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ background: "radial-gradient(ellipse at center, rgba(0, 47, 167, 0.1) 0%, transparent 50%)" }}>
        {revealStage < 2 && (
          <p className="text-lg font-mono italic animate-pulse" style={{ color: "var(--color-text-muted)", opacity: revealStage >= 1 ? 1 : 0, transition: "opacity 0.5s" }}>
            The Oracle has spoken...
          </p>
        )}
        {revealStage >= 2 && result && (
          <>
            <p className="text-6xl mb-4" style={{ opacity: revealStage >= 2 ? 1 : 0, transition: "opacity 0.5s" }}>
              {CLASS_ICONS[result.class]}
            </p>
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
          <p className="text-2xl italic mb-6" style={{ color: "var(--color-text-soft)", opacity: revealStage >= 3 ? 1 : 0, transition: "opacity 0.5s" }}>
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
        {revealStage >= 5 && (
          <button
            onClick={() => router.push("/student/dashboard")}
            className="flex items-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{ height: 44, padding: "0 24px", background: "#002fa7", color: "#f1ffff", opacity: revealStage >= 5 ? 1 : 0, transition: "opacity 0.5s" }}
          >
            Enter the Campus <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Quiz phase
  const q = QUESTIONS[qIndex];
  if (!q) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: "radial-gradient(ellipse at center, rgba(0, 47, 167, 0.04) 0%, transparent 60%)" }}>
      {/* Question */}
      <h2
        key={qIndex}
        className="text-xl md:text-2xl font-medium text-center mb-8 max-w-[720px]"
        style={{ color: "var(--color-text-main)", lineHeight: 1.3, animation: "fadeInUp 0.4s ease-out" }}
      >
        {q.text}
      </h2>

      {/* Answer Cards */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {q.answers.map((a, i) => (
          <button
            key={`${qIndex}-${i}`}
            onClick={() => handleAnswer(a.value)}
            className="text-left transition-all hover:translate-y-[-4px] hover:border-[rgba(0,47,167,0.4)]"
            style={{
              width: 180,
              minHeight: 160,
              padding: 24,
              background: "var(--color-surface)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              color: "var(--color-text-soft)",
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.5,
              cursor: "pointer",
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
          <div className="h-full rounded-full transition-all" style={{ width: `${(qIndex / QUESTIONS.length) * 100}%`, background: "#002fa7", transitionDuration: "0.4s" }} />
        </div>
        <p className="text-right mt-1.5 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{qIndex + 1} of {QUESTIONS.length}</p>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
