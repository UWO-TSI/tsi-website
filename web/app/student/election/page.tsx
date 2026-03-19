"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const CANDIDATES = [
  { name: "Marco Chen", code: "MC" },
  { name: "Eleanor Liu", code: "EL" },
  { name: "Anthony Lam", code: "AL" },
  { name: "Scott McLaughlin", code: "SM" },
  { name: "Alice Nguyen", code: "AN" },
];

const ASCII_BALLOT = `
 ╔══════════════════════════════════════════╗
 ║  ████████╗███████╗████████╗██╗  ██╗     ║
 ║  ╚══██╔══╝██╔════╝╚══██╔══╝██║  ██║     ║
 ║     ██║   █████╗     ██║   ███████║     ║
 ║     ██║   ██╔══╝     ██║   ██╔══██║     ║
 ║     ██║   ███████╗   ██║   ██║  ██║     ║
 ║     ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝     ║
 ╠══════════════════════════════════════════╣
 ║   PRESIDENTIAL ELECTION — W26           ║
 ║   ANONYMOUS · IMMUTABLE · FINAL         ║
 ╚══════════════════════════════════════════╝`;

const BOOT_LINES = [
  { text: "$ tethos --election --init", delay: 0 },
  { text: "Loading election module...", delay: 80 },
  { text: "Cryptographic ballot initialized", delay: 160 },
  { text: "Anonymity layer: ACTIVE", delay: 240 },
  { text: "Verifying voter eligibility...", delay: 320 },
  { text: "Status: ELIGIBLE", delay: 480 },
  { text: "Candidates loaded: 5", delay: 560 },
  { text: ">> IDENTIFY YOURSELF, THEN VOTE", delay: 720 },
];

type Step = "name" | "vote" | "confirm";

export default function ElectionPage() {
  const [step, setStep] = useState<Step>("name");
  const [fullName, setFullName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bootStep, setBootStep] = useState(0);
  const [bootDone, setBootDone] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Boot sequence animation
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const timers: NodeJS.Timeout[] = [];
    BOOT_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setBootStep(i + 1);
          if (i === BOOT_LINES.length - 1) {
            setTimeout(() => {
              if (cancelled) return;
              setBootDone(true);
              setTimeout(() => nameInputRef.current?.focus(), 100);
            }, 300);
          }
        }, line.delay)
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [loading]);

  // Auto-scroll terminal log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [bootStep]);

  // Check if user already voted on mount
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/student/login";
        return;
      }

      const { data: existingVote } = await supabase
        .from("election_votes")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existingVote) {
        window.location.href = "/under-construction";
        return;
      }

      // Pre-fill name from profile if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        setFullName(profile.display_name);
      }

      setLoading(false);
    }
    check();
  }, []);

  function handleNameSubmit() {
    const trimmed = fullName.trim();
    if (!trimmed) return;
    setStep("vote");
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNameSubmit();
    }
  }

  async function submitVote() {
    if (!selected) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Ensure profile exists (upsert), then save full name
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
          display_name: fullName.trim(),
        },
        { onConflict: "id" }
      );

    if (upsertErr) {
      setError("Profile error: " + upsertErr.message);
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("election_votes")
      .insert({ user_id: user.id, candidate: selected });

    if (insertErr) {
      if (insertErr.code === "23505") {
        window.location.href = "/under-construction";
        return;
      }
      setError("Vote failed: " + insertErr.message);
      setSubmitting(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ has_voted: true })
      .eq("id", user.id);

    setVoteSuccess(true);
    setTimeout(() => {
      window.location.href = "/under-construction";
    }, 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-5 h-5 border-2 border-[var(--color-brand-blue)]/30 border-t-[var(--color-brand-blue)] rounded-full animate-spin mb-3" />
          <p className="font-mono text-xs text-[var(--color-text-muted)]">
            Initializing election protocol...
          </p>
        </div>
      </div>
    );
  }

  // Success screen after voting
  if (voteSuccess) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              boxShadow: "0 0 40px rgba(34, 197, 94, 0.15)",
            }}
          >
            <span className="text-2xl text-[var(--color-success)]">✓</span>
          </div>
          <pre className="font-mono text-[0.55rem] text-[var(--color-success)] mb-4 leading-tight">
{`╔═══════════════════════════╗
║   VOTE RECORDED           ║
║   BALLOT: SEALED          ║
║   STATUS: IMMUTABLE       ║
╚═══════════════════════════╝`}
          </pre>
          <p className="font-mono text-sm text-[var(--color-text-primary)] mb-2">
            Your vote has been cast, {fullName.split(" ")[0]}.
          </p>
          <p className="font-mono text-xs text-[var(--color-text-muted)]">
            The dashboard is under construction. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  const selectedCandidate = CANDIDATES.find((c) => c.name === selected);

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 py-12">
      {/* Subtle background glow */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: selected
            ? "radial-gradient(circle, rgba(0,47,167,0.08) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)",
          transition: "background 0.8s ease",
        }}
      />

      <div className="w-full max-w-xl relative z-10">
        {/* Terminal Window */}
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border-soft)] rounded-lg overflow-hidden mb-6">
          {/* Window Chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--glass-border-soft)]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="flex-1" />
            <span className="font-mono text-[0.6rem] text-[var(--color-text-subtle)] tracking-wider">
              tethos://election/ballot
            </span>
          </div>

          {/* Boot Log */}
          <div ref={logRef} className="px-4 py-3 font-mono text-xs leading-relaxed">
            {BOOT_LINES.slice(0, bootStep).map((line, i) => (
              <div
                key={i}
                className={`transition-opacity duration-200 ${
                  line.text.startsWith("$")
                    ? "text-[var(--color-accent-cyan)]"
                    : line.text.startsWith(">>")
                      ? "text-[var(--color-brand-yellow)]"
                      : line.text.includes("ELIGIBLE")
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-muted)]"
                }`}
              >
                {line.text}
              </div>
            ))}
            {!bootDone && bootStep > 0 && (
              <span className="text-[var(--color-accent-cyan)] animate-pulse">█</span>
            )}
          </div>
        </div>

        {/* Main Ballot Card */}
        <div
          className="transition-all duration-500"
          style={{
            opacity: bootDone ? 1 : 0,
            transform: bootDone ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border-soft)] rounded-lg overflow-hidden">
            {/* ASCII Header */}
            <div className="px-6 pt-6 pb-0">
              <pre className="text-[0.4rem] sm:text-[0.5rem] leading-tight font-mono text-[var(--color-brand-blue)] overflow-x-auto whitespace-pre select-none">
                {ASCII_BALLOT}
              </pre>
            </div>

            <div className="px-6 pb-6">
              <div className="border-t border-[var(--glass-border-soft)] mt-4 pt-5">

                {/* ── Step 1: Full Name ── */}
                {step === "name" && (
                  <>
                    <div className="mb-6">
                      <p className="font-mono text-[0.65rem] text-[var(--color-accent-cyan)] mb-1.5 tracking-wide">
                        {">"} Identify yourself before casting your ballot.
                      </p>
                      <p className="font-mono text-xs text-[var(--color-text-subtle)]">
                        Enter your full name as it appears on your membership.
                      </p>
                    </div>

                    <div className="mb-6">
                      <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border-soft)] rounded-lg px-4 py-3.5 font-mono text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-subtle)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.2)] transition-all"
                        placeholder="e.g. Jane Doe"
                        autoFocus
                      />
                    </div>

                    <button
                      onClick={handleNameSubmit}
                      disabled={!fullName.trim()}
                      className="w-full py-3.5 rounded-lg font-mono text-sm uppercase tracking-[0.12em] transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
                      style={{
                        background: fullName.trim()
                          ? "var(--color-brand-blue)"
                          : "transparent",
                        color: fullName.trim()
                          ? "#fff"
                          : "var(--color-text-subtle)",
                        border: fullName.trim()
                          ? "1px solid var(--color-brand-blue)"
                          : "1px solid rgba(241,255,255,0.08)",
                        boxShadow: fullName.trim()
                          ? "0 0 30px rgba(0,47,167,0.25)"
                          : "none",
                      }}
                    >
                      {fullName.trim() ? "[ Continue to Ballot ]" : "[ Enter your name ]"}
                    </button>
                  </>
                )}

                {/* ── Step 2: Vote ── */}
                {step === "vote" && (
                  <>
                    {/* Voter identity bar */}
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5 font-mono text-xs"
                      style={{
                        background: "rgba(34,211,238,0.04)",
                        border: "1px solid rgba(34,211,238,0.1)",
                      }}
                    >
                      <span className="text-[var(--color-accent-cyan)]">Voter:</span>
                      <span className="text-[var(--color-text-main)]">{fullName}</span>
                      <button
                        onClick={() => setStep("name")}
                        className="ml-auto text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] transition-colors"
                      >
                        edit
                      </button>
                    </div>

                    <div className="mb-6">
                      <p className="font-mono text-[0.65rem] text-[var(--color-accent-cyan)] mb-1.5 tracking-wide">
                        {">"} Select your candidate for President.
                      </p>
                      <p className="font-mono text-xs text-[var(--color-text-subtle)]">
                        One vote per member. Anonymous and irreversible.
                      </p>
                    </div>

                    {/* Candidate Cards */}
                    <div className="space-y-2">
                      {CANDIDATES.map((candidate, i) => {
                        const isSelected = selected === candidate.name;
                        const isHovered = hoveredIdx === i;
                        return (
                          <button
                            key={candidate.name}
                            onClick={() => setSelected(candidate.name)}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{
                              transition: "all 0.2s ease",
                              ...(isSelected
                                ? {
                                    borderColor: "var(--color-brand-blue)",
                                    boxShadow: "0 0 20px rgba(0,47,167,0.15), inset 0 0 30px rgba(0,47,167,0.05)",
                                  }
                                : isHovered
                                  ? { borderColor: "rgba(241,255,255,0.2)" }
                                  : {}),
                            }}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-lg border font-mono text-left ${
                              isSelected
                                ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/[0.06]"
                                : "border-[var(--glass-border-soft)] hover:bg-white/[0.02]"
                            }`}
                          >
                            <div
                              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold tracking-wider transition-all duration-200"
                              style={{
                                background: isSelected
                                  ? "rgba(0,47,167,0.15)"
                                  : "rgba(241,255,255,0.04)",
                                color: isSelected
                                  ? "var(--color-brand-blue)"
                                  : "var(--color-text-subtle)",
                                border: `1px solid ${
                                  isSelected
                                    ? "rgba(0,47,167,0.3)"
                                    : "rgba(241,255,255,0.06)"
                                }`,
                              }}
                            >
                              {candidate.code}
                            </div>

                            <span
                              className={`text-sm tracking-wide transition-colors duration-200 ${
                                isSelected
                                  ? "text-[var(--color-text-main)]"
                                  : "text-[var(--color-text-muted)]"
                              }`}
                            >
                              {candidate.name}
                            </span>

                            <div className="ml-auto">
                              <div
                                className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                                style={{
                                  borderColor: isSelected
                                    ? "var(--color-brand-blue)"
                                    : "rgba(241,255,255,0.12)",
                                }}
                              >
                                {isSelected && (
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      background: "var(--color-brand-blue)",
                                      boxShadow: "0 0 6px rgba(0,47,167,0.5)",
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => selected && setStep("confirm")}
                      disabled={!selected}
                      className="w-full mt-6 py-3.5 rounded-lg font-mono text-sm uppercase tracking-[0.12em] transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
                      style={{
                        background: selected
                          ? "var(--color-brand-blue)"
                          : "transparent",
                        color: selected
                          ? "#fff"
                          : "var(--color-text-subtle)",
                        border: selected
                          ? "1px solid var(--color-brand-blue)"
                          : "1px solid rgba(241,255,255,0.08)",
                        boxShadow: selected
                          ? "0 0 30px rgba(0,47,167,0.25)"
                          : "none",
                      }}
                    >
                      {selected ? "[ Cast Ballot ]" : "[ Select a candidate ]"}
                    </button>
                  </>
                )}

                {/* ── Step 3: Confirm ── */}
                {step === "confirm" && (
                  <div className="py-6">
                    {/* Warning Banner */}
                    <div
                      className="rounded-lg px-4 py-3 mb-6 font-mono text-xs"
                      style={{
                        background: "rgba(255,209,102,0.06)",
                        border: "1px solid rgba(255,209,102,0.15)",
                      }}
                    >
                      <span className="text-[var(--color-brand-yellow)]">
                        {"["} CONFIRMATION REQUIRED {"]"}
                      </span>
                      <span className="text-[var(--color-text-muted)] ml-2">
                        This action is permanent.
                      </span>
                    </div>

                    {/* Selected Candidate Display */}
                    <div className="text-center mb-8">
                      <p className="font-mono text-[0.65rem] text-[var(--color-text-subtle)] uppercase tracking-[0.15em] mb-3">
                        Your vote for President
                      </p>
                      <div
                        className="inline-flex items-center gap-3 px-6 py-4 rounded-lg"
                        style={{
                          background: "rgba(0,47,167,0.08)",
                          border: "1px solid rgba(0,47,167,0.2)",
                          boxShadow: "0 0 40px rgba(0,47,167,0.1)",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-md flex items-center justify-center font-mono text-xs font-bold tracking-wider"
                          style={{
                            background: "rgba(0,47,167,0.2)",
                            color: "var(--color-brand-blue)",
                            border: "1px solid rgba(0,47,167,0.3)",
                          }}
                        >
                          {selectedCandidate?.code}
                        </div>
                        <span className="font-mono text-lg font-bold text-[var(--color-text-main)] tracking-wide">
                          {selected}
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div
                        className="rounded-lg px-4 py-3 mb-4 font-mono text-xs"
                        style={{
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.15)",
                        }}
                      >
                        <span className="text-[var(--color-error)]">{error}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep("vote")}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-lg font-mono text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all duration-200 border border-[var(--glass-border-soft)] hover:border-[rgba(241,255,255,0.2)]"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={submitVote}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-lg font-mono text-xs uppercase tracking-[0.1em] text-white transition-all duration-200 disabled:opacity-50"
                        style={{
                          background: "var(--color-brand-blue)",
                          boxShadow: "0 0 30px rgba(0,47,167,0.3)",
                        }}
                      >
                        {submitting ? "Sealing ballot..." : "Confirm Vote"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <p className="font-mono text-[0.55rem] text-[var(--color-text-subtle)]/50 tracking-wider">
            TSI-SYS v3.2.1 · ELECTION MODULE · ENCRYPTED · ONE VOTE PER AGENT
          </p>
        </div>
      </div>
    </div>
  );
}
