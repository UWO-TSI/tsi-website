"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const SUBCLASS_OPTIONS: Record<string, string[]> = {
  ENGINEER: ["Frontend", "Backend", "Fullstack", "Mobile", "DevOps", "Data"],
  OPERATIVE: ["Events", "Outreach", "Content", "Design", "Analytics"],
  COMMANDER: ["Technical Lead", "Product Lead", "Client Relations"],
  WARDEN: ["Events", "Outreach", "Content", "Design", "Analytics"],
  ORACLE: ["Strategy", "Mentorship", "Operations"],
  STRATEGIST: ["Technical", "Product", "Process"],
  ARCHITECT: ["Everything"],
  INITIATE: ["Explorer", "Builder", "Designer", "Analyst"],
  SCOUT: ["Events", "Outreach", "Community"],
};

const BOOT_LINES = [
  "TETHOS INDUCTION PROTOCOL v3.2.1",
  "Scanning biometrics...",
  "Clearance: GRANTED",
  "Loading agent profile module...",
  "",
  ">> INITIATING NEW AGENT",
  ">> Complete all steps to unlock the system",
];

interface ProfileData {
  year: string;
  program: string;
  hometown: string;
  birthday: string;
  phone: string;
  preferred_email: string;
  uwo_email: string;
  gdrive_email: string;
  github_username: string;
  instagram: string;
  linkedin: string;
  discord_tag: string;
  favourite_music: string;
  dream_retirement: string;
  spirit_animal: string;
  fun_fact: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [subclass, setSubclass] = useState("");
  const [userClass, setUserClass] = useState("INITIATE");
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    year: "",
    program: "",
    hometown: "",
    birthday: "",
    phone: "",
    preferred_email: "",
    uwo_email: "",
    gdrive_email: "",
    github_username: "",
    instagram: "",
    linkedin: "",
    discord_tag: "",
    favourite_music: "",
    dream_retirement: "",
    spirit_animal: "",
    fun_fact: "",
  });
  const router = useRouter();

  // Load existing progress
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (profile.onboarding_completed) {
          router.push("/student/dashboard");
          return;
        }
        setStep(profile.onboarding_step || 0);
        setUserClass(profile.class || "INITIATE");
        if (profile.subclass) setSubclass(profile.subclass);

        // Restore saved profile fields
        setProfileData((prev) => ({
          ...prev,
          year: profile.year || "",
          program: profile.program || "",
          hometown: profile.hometown || "",
          birthday: profile.birthday || "",
          phone: profile.phone || "",
          preferred_email: profile.preferred_email || "",
          uwo_email: profile.uwo_email || "",
          gdrive_email: profile.gdrive_email || "",
          github_username: profile.github_username || "",
          instagram: profile.instagram || "",
          linkedin: profile.linkedin || "",
          discord_tag: profile.discord_tag || "",
          favourite_music: profile.favourite_music || "",
          dream_retirement: profile.dream_retirement || "",
          spirit_animal: profile.spirit_animal || "",
          fun_fact: profile.fun_fact || "",
        }));
      }
    }
    loadProgress();
  }, [router]);

  // Boot animation
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setBootComplete(true);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const saveProgress = useCallback(
    async (nextStep: number, extraData?: Record<string, unknown>) => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          onboarding_step: nextStep,
          ...extraData,
        })
        .eq("id", user.id);

      setStep(nextStep);
      setLoading(false);
    },
    []
  );

  async function completeOnboarding() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Award onboarding XP and TC
    await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_step: 4,
        xp: 500,
        tethos_coins: 500,
        level: 2,
      })
      .eq("id", user.id);

    // Log TC transaction
    await supabase.from("tc_transactions").insert({
      user_id: user.id,
      amount: 500,
      balance_after: 500,
      type: "earn_quest",
      description: "Onboarding completion bonus",
    });

    // Log XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: 500,
      type: "earn_quest",
      description: "Onboarding completion bonus",
    });

    // Create welcome notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "achievement",
      title: "Welcome to Tethos!",
      body: "You earned 500 XP and 500 TC for completing onboarding.",
    });

    router.push("/student/dashboard");
    router.refresh();
  }

  function updateField(field: keyof ProfileData, value: string) {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  }

  const inputClass =
    "w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_8px_rgba(0,47,167,0.2)] transition-all";

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Terminal Header */}
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5 mb-6 font-mono text-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--glass-border)]">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[var(--color-text-muted)] text-xs">
              tethos://onboarding
            </span>
          </div>
          {bootLines.map((line, i) => (
            <div
              key={i}
              className={`${
                line.startsWith(">>")
                  ? "text-[var(--color-brand-yellow)]"
                  : "text-[var(--color-text-muted)]"
              } ${line === "" ? "h-2" : ""}`}
            >
              {line && !line.startsWith(">>") && (
                <span className="text-[var(--color-accent-cyan)] mr-2">$</span>
              )}
              {line}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-all ${
                s <= step
                  ? "bg-[var(--color-brand-blue)]"
                  : "bg-white/[0.05]"
              }`}
            />
          ))}
          <span className="text-xs font-mono text-[var(--color-text-muted)] ml-2">
            {step + 1}/4
          </span>
        </div>

        {/* Steps */}
        <div
          className={`transition-opacity duration-300 ${
            bootComplete ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-text-primary)] mb-3">
                AGENT INDUCTION
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                Welcome to the Tethos system. You have been selected to join an
                elite collective of student developers, designers, and operators.
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Before you can access the full system, we need to initialize
                your agent profile. This data helps your team know who you are.
              </p>
              <div className="bg-[var(--color-brand-blue)]/5 border border-[var(--color-brand-blue)]/20 rounded-md p-3 mb-6">
                <p className="text-xs font-mono text-[var(--color-brand-blue)]">
                  REWARD: Complete all steps to earn 500 XP + 500 TC
                </p>
              </div>
              <button
                onClick={() => saveProgress(1)}
                disabled={loading}
                className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
              >
                {loading ? "Loading..." : "Begin Induction →"}
              </button>
            </div>
          )}

          {/* Step 1: Profile Info */}
          {step === 1 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-1">
                AGENT PROFILE
              </h2>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mb-5">
                Initialize your identity in the system
              </p>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Year
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.year}
                      onChange={(e) => updateField("year", e.target.value)}
                      placeholder="e.g., 2nd Year"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Program
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.program}
                      onChange={(e) => updateField("program", e.target.value)}
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Hometown
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.hometown}
                      onChange={(e) => updateField("hometown", e.target.value)}
                      placeholder="Your hometown"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Birthday
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={profileData.birthday}
                      onChange={(e) => updateField("birthday", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                    Phone
                  </label>
                  <input
                    className={inputClass}
                    value={profileData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Preferred Email
                    </label>
                    <input
                      type="email"
                      className={inputClass}
                      value={profileData.preferred_email}
                      onChange={(e) =>
                        updateField("preferred_email", e.target.value)
                      }
                      placeholder="you@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      UWO Email
                    </label>
                    <input
                      type="email"
                      className={inputClass}
                      value={profileData.uwo_email}
                      onChange={(e) => updateField("uwo_email", e.target.value)}
                      placeholder="you@uwo.ca"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                    Google Drive Email
                  </label>
                  <input
                    type="email"
                    className={inputClass}
                    value={profileData.gdrive_email}
                    onChange={(e) =>
                      updateField("gdrive_email", e.target.value)
                    }
                    placeholder="Personal Google account"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      GitHub Username
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.github_username}
                      onChange={(e) =>
                        updateField("github_username", e.target.value)
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Discord Tag
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.discord_tag}
                      onChange={(e) =>
                        updateField("discord_tag", e.target.value)
                      }
                      placeholder="user#1234"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Instagram
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.instagram}
                      onChange={(e) => updateField("instagram", e.target.value)}
                      placeholder="@handle"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      LinkedIn
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.linkedin}
                      onChange={(e) => updateField("linkedin", e.target.value)}
                      placeholder="Profile URL"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--glass-border)]">
                  <p className="text-[0.6rem] font-mono text-[var(--color-brand-yellow)] mb-3 uppercase">
                    // Fun fields — show your personality
                  </p>
                </div>

                <div>
                  <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                    Favourite Music
                  </label>
                  <input
                    className={inputClass}
                    value={profileData.favourite_music}
                    onChange={(e) =>
                      updateField("favourite_music", e.target.value)
                    }
                    placeholder="Genre, artist, or song"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Dream Retirement Location
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.dream_retirement}
                      onChange={(e) =>
                        updateField("dream_retirement", e.target.value)
                      }
                      placeholder="e.g., Mars"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                      Spirit Animal
                    </label>
                    <input
                      className={inputClass}
                      value={profileData.spirit_animal}
                      onChange={(e) =>
                        updateField("spirit_animal", e.target.value)
                      }
                      placeholder="e.g., Capybara"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.65rem] font-mono text-[var(--color-text-muted)] mb-1 uppercase">
                    Fun Fact
                  </label>
                  <input
                    className={inputClass}
                    value={profileData.fun_fact}
                    onChange={(e) => updateField("fun_fact", e.target.value)}
                    placeholder="Something people wouldn't guess about you"
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  saveProgress(2, {
                    ...profileData,
                  })
                }
                disabled={loading || !profileData.year || !profileData.program}
                className="w-full mt-5 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
              >
                {loading ? "Saving..." : "Save Profile Data →"}
              </button>
            </div>
          )}

          {/* Step 2: Subclass Selection */}
          {step === 2 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
              <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-1">
                SELECT YOUR SUBCLASS
              </h2>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mb-2">
                Your class:{" "}
                <span className="text-[var(--color-brand-blue)]">
                  {userClass}
                </span>
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                Choose your specialization. This defines your focus within your
                team.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {(SUBCLASS_OPTIONS[userClass] ?? ["General"]).map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setSubclass(sc)}
                    className={`px-4 py-3 rounded-md border font-mono text-sm transition-all ${
                      subclass === sc
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] shadow-[0_0_8px_rgba(0,47,167,0.2)]"
                        : "border-[var(--glass-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>

              <button
                onClick={() => saveProgress(3, { subclass })}
                disabled={loading || !subclass}
                className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
              >
                {loading ? "Saving..." : "Lock In Subclass →"}
              </button>
            </div>
          )}

          {/* Step 3: Completion */}
          {step === 3 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-heading font-bold text-[var(--color-text-primary)] mb-2">
                AGENT INITIALIZED
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                Welcome to Tethos,{" "}
                <span className="text-[var(--color-brand-blue)] font-mono">
                  {userClass}
                </span>
                .
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                Your profile is live. The system is yours to explore.
              </p>

              <div className="bg-[var(--color-brand-yellow)]/5 border border-[var(--color-brand-yellow)]/20 rounded-md p-4 mb-6">
                <p className="text-sm font-mono text-[var(--color-brand-yellow)]">
                  +500 XP earned
                </p>
                <p className="text-sm font-mono text-[var(--color-brand-yellow)]">
                  +500 ₮ Tethos Coins earned
                </p>
              </div>

              <button
                onClick={completeOnboarding}
                disabled={loading}
                className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 uppercase tracking-wider"
              >
                {loading ? "Launching..." : "Enter the System →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
