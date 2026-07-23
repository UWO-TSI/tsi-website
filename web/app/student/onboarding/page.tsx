"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft, Sparkles, User } from "lucide-react";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year+"];
const SKILL_PRESETS = ["React", "TypeScript", "Python", "Node.js", "Figma", "UI/UX", "Data Science", "ML", "Java", "Go", "Swift", "Flutter", "C++", "SQL", "AWS", "Docker"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [year, setYear] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");

  // Load existing profile data
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("profiles").select("display_name, bio, year, skills, social_links, onboarding_completed").eq("id", user.id).single().then(({ data }) => {
          if (!data) return;
          if (data.onboarding_completed) { router.replace("/student/dashboard"); return; }
          if (data.display_name) setDisplayName(data.display_name);
          if (data.bio) setBio(data.bio);
          if (data.year) setYear(String(data.year));
          if (data.skills) setSkills(data.skills);
          const sl = data.social_links as Record<string, string> | null;
          if (sl?.github) setGithub(sl.github);
          if (sl?.linkedin) setLinkedin(sl.linkedin);
          if (sl?.website) setWebsite(sl.website);
        });
      });
    } catch {
      // Supabase not configured — proceed with empty defaults
    }
  }, [router]);

  /**
   * Soft-lock fix (David report, 2026-07-22). The old finish PATCHed
   * /api/profile with `onboarding_completed: true` — but that field isn't
   * in ProfileUpdateSchema, so zod silently STRIPPED it (and numeric
   * `year` failed validation outright). The flag never persisted, the
   * middleware bounced /student/dashboard back here, and the button spun
   * on "Saving..." forever.
   *
   * The real contract is POST /api/onboarding: a sequential 4-step machine
   * that sets onboarding_completed at step 4 and awards the sanctioned
   * 100 TC welcome bonus. Walk it from wherever the member left off, send
   * profile basics on step 2 (year stays a STRING — "1st Year"), and send
   * skills + social links via the profile PATCH (those ARE in its schema,
   * best-effort). Any hard failure re-enables the button with an error.
   */
  const handleFinish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Best-effort: skills + socials (valid ProfileUpdateSchema fields).
      // Not worth blocking entry to the game if this one fails.
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: skills.length > 0 ? skills : undefined,
          social_links: { github: github || undefined, linkedin: linkedin || undefined, website: website || undefined },
        }),
      }).catch(() => {});

      // Where did this member leave off?
      const statusRes = await fetch("/api/onboarding");
      if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);
      const status = (await statusRes.json()) as { completed: boolean; current_step: number; total_steps: number };
      if (status.completed) {
        router.push("/student/dashboard");
        return;
      }

      // Advance sequentially to the final step (the API enforces order).
      for (let s = (status.current_step ?? 0) + 1; s <= (status.total_steps ?? 4); s++) {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: s,
            profile_data:
              s === 2
                ? {
                    display_name: displayName || undefined,
                    bio: bio || undefined,
                    year: year || undefined,
                  }
                : undefined,
          }),
        });
        // 409 = already completed (double-click / another tab) — that's a win.
        if (res.status === 409) break;
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? `step ${s} failed (${res.status})`);
        }
      }

      router.push("/student/dashboard");
    } catch (e) {
      setSaving(false);
      setSaveError(
        e instanceof Error && e.message
          ? `Couldn't save: ${e.message}. Try again — your answers are still here.`
          : "Couldn't save your profile. Try again — your answers are still here."
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "var(--color-bg-main)" }}>
      {/* Step Progress */}
      <StepIndicator current={step} total={3} />

      {/* Step Content */}
      <div className="w-full" style={{ maxWidth: 560 }}>
        {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
        {step === 2 && (
          <ProfileStep
            displayName={displayName} setDisplayName={setDisplayName}
            bio={bio} setBio={setBio}
            year={year} setYear={setYear}
            skills={skills} setSkills={setSkills}
            github={github} setGithub={setGithub}
            linkedin={linkedin} setLinkedin={setLinkedin}
            website={website} setWebsite={setWebsite}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <AvatarStep
            onBack={() => setStep(2)}
            onFinish={handleFinish}
            saving={saving}
          />
        )}
        {saveError && (
          <div
            role="alert"
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{ background: "rgba(229, 72, 77, 0.12)", border: "1px solid rgba(229, 72, 77, 0.4)", color: "#E5484D" }}
          >
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                background: done || active ? "#002fa7" : "transparent",
                border: done || active ? "2px solid #002fa7" : "2px solid var(--glass-border-soft)",
                color: done || active ? "#f1ffff" : "var(--color-text-subtle)",
              }}
            >
              {done ? <Check className="w-4 h-4" /> : stepNum}
            </div>
            {i < total - 1 && (
              <div className="w-10 h-0.5" style={{ background: done ? "#002fa7" : "var(--glass-border-soft)" }} />
            )}
          </div>
        );
      })}
      <span className="ml-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>Step {current} of {total}</span>
    </div>
  );
}

// ─── Step 1: Welcome ────────────────────────────────────────────
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: "rgba(0, 47, 167, 0.1)" }}>
        <Sparkles className="w-8 h-8" style={{ color: "#4A7AFF" }} />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "var(--color-text-main)" }}>
        Welcome to Tethos
      </h1>
      <p className="font-mono text-base italic mb-6" style={{ color: "var(--color-text-muted)" }}>
        Technology That Moves People Forward
      </p>
      <p className="text-base mb-10 mx-auto leading-relaxed" style={{ color: "var(--color-text-soft)", maxWidth: 480 }}>
        You&apos;re about to enter a campus where students build real software for real impact.
        Set up your profile, choose your look, and start your journey.
      </p>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
        style={{ height: 48, padding: "0 28px", background: "#002fa7", color: "#f1ffff" }}
      >
        Let&apos;s Go <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 2: Profile Setup ──────────────────────────────────────
function ProfileStep({ displayName, setDisplayName, bio, setBio, year, setYear, skills, setSkills, github, setGithub, linkedin, setLinkedin, website, setWebsite, onBack, onNext }: {
  displayName: string; setDisplayName: (v: string) => void;
  bio: string; setBio: (v: string) => void;
  year: string; setYear: (v: string) => void;
  skills: string[]; setSkills: (v: string[]) => void;
  github: string; setGithub: (v: string) => void;
  linkedin: string; setLinkedin: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const inputStyle = {
    height: 40,
    padding: "0 12px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--glass-border-soft)",
    borderRadius: 8,
    color: "var(--color-text-main)",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  const toggleSkill = (s: string) => {
    setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : skills.length < 10 ? [...skills, s] : skills);
  };

  return (
    <div className="rounded-3xl" style={{ background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", padding: 32 }}>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-main)" }}>Set Up Your Profile</h2>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>Tell us about yourself. You can always change this later.</p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>Display Name *</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 30))} placeholder="What should we call you?" style={inputStyle} />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>{displayName.length}/30</p>
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} placeholder="A short intro about you..." rows={2} style={{ ...inputStyle, height: "auto", padding: 12, minHeight: 80 }} />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>{bio.length}/200</p>
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>Year *</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">Select your year</option>
            {YEAR_OPTIONS.map((y, i) => <option key={y} value={String(i + 1)}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>Skills <span style={{ color: "var(--color-text-subtle)" }}>({skills.length}/10)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSkill(s)}
                className="text-xs rounded-full transition-colors"
                style={{
                  padding: "4px 10px",
                  background: skills.includes(s) ? "rgba(0, 47, 167, 0.15)" : "rgba(255,255,255,0.04)",
                  color: skills.includes(s) ? "#4A7AFF" : "var(--color-text-muted)",
                  border: skills.includes(s) ? "1px solid #002fa7" : "1px solid var(--glass-border-soft)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>GitHub</label>
            <input type="text" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>LinkedIn</label>
            <input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="profile URL" style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>Website</label>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" style={inputStyle} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!displayName.trim()}
          className="flex items-center gap-2 rounded-xl text-sm font-semibold transition-all"
          style={{ height: 40, padding: "0 20px", background: displayName.trim() ? "#002fa7" : "rgba(255,255,255,0.06)", color: displayName.trim() ? "#f1ffff" : "var(--color-text-subtle)" }}
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Avatar (placeholder) ───────────────────────────────
function AvatarStep({ onBack, onFinish, saving }: { onBack: () => void; onFinish: () => void; saving: boolean }) {
  return (
    <div className="rounded-3xl text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", padding: 32 }}>
      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-main)" }}>Choose Your Look</h2>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>Avatar customization is coming soon. For now, you&apos;ll get a default character.</p>

      <div className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: "rgba(0, 47, 167, 0.1)", border: "2px solid #002fa7" }}>
        <User className="w-12 h-12" style={{ color: "#4A7AFF" }} />
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{ height: 44, padding: "0 24px", background: "#002fa7", color: "#f1ffff", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : "Enter Campus"} <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
