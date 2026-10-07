"use client";

import { useState, useEffect, type ReactNode } from "react";
import { CircleCheck, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Banner, Button, Card, ErrorNote, Field, List, ListRow, Loading } from "@/components/gui";

const CANDIDATES = [
  { name: "Marco Chen", code: "MC" },
  { name: "Eleanor Liu", code: "EL" },
  { name: "Anthony Lam", code: "AL" },
  { name: "Scott McLaughlin", code: "SM" },
  { name: "Alice Nguyen", code: "AN" },
];

type Step = "name" | "vote" | "confirm";

export default function ElectionPage() {
  const [step, setStep] = useState<Step>("name");
  const [fullName, setFullName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [voteSuccess, setVoteSuccess] = useState(false);

  // Check if user already voted on mount
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/student";
        return;
      }

      const { data: existingVote } = await supabase
        .from("election_votes")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Pre-fill name from profile if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        setFullName(profile.display_name);
      }

      if (existingVote) {
        setVoteSuccess(true);
        setLoading(false);
        return;
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

    // Save full name (the profile row is created at sign-up by handle_new_user)
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ display_name: fullName.trim() })
      .eq("id", user.id);

    if (profileErr) {
      setError("Profile error: " + profileErr.message);
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

    // has_voted is server-only now; election_votes (unique per user) is the record.
    setVoteSuccess(true);
  }

  if (loading) {
    return (
      <Shell>
        <Loading label="Loading the ballot…" />
      </Shell>
    );
  }

  // Success screen after voting
  if (voteSuccess) {
    return (
      <Shell>
        <Card pinned className="text-center" style={{ padding: "36px 28px 30px" }}>
          <span
            aria-hidden
            className="inline-grid place-items-center mb-4"
            style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gui-sage-soft)", color: "var(--gui-sage)" }}
          >
            <CircleCheck size={34} />
          </span>
          <h1 style={{ margin: "0 0 8px", fontSize: "var(--gui-text-2xl)", fontWeight: 900, color: "var(--gui-ink-strong)" }}>
            Your vote has been cast, {fullName.split(" ")[0]}.
          </h1>
          <p style={{ margin: 0, fontSize: "var(--gui-text-md)", color: "var(--gui-ink-2)" }}>
            Thank you for participating in the election.
          </p>
        </Card>
      </Shell>
    );
  }

  const selectedCandidate = CANDIDATES.find((c) => c.name === selected);

  return (
    <Shell>
      <Banner title="Presidential election" icon={<Vote size={26} />} tone="sage">
        W26. Anonymous, one vote per member, and final.
      </Banner>

      <Card style={{ padding: "24px 22px" }}>
        {/* ── Step 1: Full Name ── */}
        {step === "name" && (
          <>
            <Heading>Tell us who you are before you vote.</Heading>
            <Field
              label="Full name"
              hint="As it appears on your membership."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder="e.g. Jane Doe"
              autoComplete="name"
              autoFocus
            />
            <Button className="w-full mt-5" onClick={handleNameSubmit} disabled={!fullName.trim()}>
              {fullName.trim() ? "Continue to the ballot" : "Enter your name"}
            </Button>
          </>
        )}

        {/* ── Step 2: Vote ── */}
        {step === "vote" && (
          <>
            <div className="flex items-center gap-2 mb-5" style={{ fontSize: "var(--gui-text-sm)", color: "var(--gui-ink-2)" }}>
              <span>
                Voting as <strong style={{ color: "var(--gui-ink-strong)" }}>{fullName}</strong>
              </span>
              <Button variant="quiet" size="sm" className="ml-auto" onClick={() => setStep("name")}>
                Edit
              </Button>
            </div>

            <Heading sub="One vote per member. It’s anonymous and can’t be changed.">Choose your candidate for President.</Heading>

            <List label="Candidates">
              {CANDIDATES.map((candidate) => (
                <ListRow
                  key={candidate.name}
                  icon={<Initials code={candidate.code} on={selected === candidate.name} />}
                  title={candidate.name}
                  selected={selected === candidate.name}
                  onClick={() => setSelected(candidate.name)}
                />
              ))}
            </List>

            <Button className="w-full mt-6" onClick={() => selected && setStep("confirm")} disabled={!selected}>
              {selected ? "Cast ballot" : "Choose a candidate"}
            </Button>
          </>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && (
          <>
            <p className="flex items-center gap-2" style={{ margin: "0 0 20px", fontSize: "var(--gui-text-sm)", color: "var(--gui-ink-2)" }}>
              <Badge tone="warn">Confirm</Badge> This is permanent.
            </p>

            <div className="text-center mb-6">
              <p style={{ margin: "0 0 10px", fontSize: "var(--gui-text-sm)", fontWeight: 800, color: "var(--gui-muted)" }}>
                Your vote for President
              </p>
              <Card tone="butter" className="inline-flex items-center gap-3" style={{ padding: "14px 22px" }}>
                <Initials code={selectedCandidate?.code ?? ""} on />
                <span style={{ fontSize: "var(--gui-text-lg)", fontWeight: 900, color: "var(--gui-ink-strong)" }}>{selected}</span>
              </Card>
            </div>

            {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep("vote")} disabled={submitting}>
                Go back
              </Button>
              <Button className="flex-1" onClick={submitVote} disabled={submitting}>
                {submitting ? "Sealing your ballot…" : "Confirm vote"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </Shell>
  );
}

/** The cream page every step sits on (the check-in page's paper notice layout). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="gui" style={{ minHeight: "100dvh", padding: "96px 16px 48px", background: "var(--gui-confetti) var(--gui-page)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 style={{ margin: 0, fontSize: "var(--gui-text-lg)", fontWeight: 900, color: "var(--gui-ink-strong)" }}>{children}</h2>
      {sub && <p style={{ margin: "4px 0 0", fontSize: "var(--gui-text-sm)", color: "var(--gui-ink-2)" }}>{sub}</p>}
    </div>
  );
}

function Initials({ code, on }: { code: string; on?: boolean }) {
  return (
    <span
      className="inline-grid place-items-center shrink-0"
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        fontSize: "var(--gui-text-sm)",
        fontWeight: 900,
        background: on ? "var(--gui-sage-soft)" : "var(--gui-paper-deep)",
        color: on ? "var(--gui-sage)" : "var(--gui-ink-2)",
      }}
    >
      {code}
    </span>
  );
}
