"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

interface PendingBounty {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  pay_cad: number | null;
  pay_tc: number | null;
  deadline: string | null;
  tech_stack: string[] | null;
  status: string;
  created_at: string;
  submitted_by: string;
  submitter?: { display_name: string } | null;
}

interface SubmissionRow {
  id: string;
  bounty_id: string;
  submission_text: string;
  attachment_urls: string[] | null;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  reviewer_notes: string | null;
  created_at: string;
  bounty?: { title: string; pay_tc: number | null } | null;
  author?: { display_name: string } | null;
}

export default function AdminBountiesPage() {
  const [view, setView] = useState<"postings" | "submissions">("postings");
  const [bounties, setBounties] = useState<PendingBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function fetchBounties() {
    const supabase = createClient();
    let query = supabase
      .from("bounties")
      .select("*, submitter:profiles!submitted_by(display_name)")
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("status", "pending");
    }

    const { data } = await query;
    setBounties((data as unknown as PendingBounty[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    fetchBounties();
  }, [filter]);

  async function approveBounty(id: string, difficulty: number) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("bounties")
      .update({
        status: "open",
        difficulty,
        approved_by: user.id,
      })
      .eq("id", id);

    setBounties((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "open" } : b
      )
    );
  }

  async function rejectBounty(id: string) {
    const supabase = createClient();
    await supabase.from("bounties").delete().eq("id", id);
    setBounties((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            {view === "postings" ? "Bounty Approval" : "Submission Review"}
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {view === "postings"
              ? `${bounties.filter((b) => b.status === "pending").length} pending review`
              : "Deliverables awaiting TC payout decisions"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
            {(["postings", "submissions"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  view === v
                    ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {view === "postings" && (
            <div className="flex gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
              {(["pending", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    filter === f
                      ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "submissions" ? (
        <SubmissionsReview />
      ) : loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading...
        </p>
      ) : bounties.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">
            {filter === "pending"
              ? "No bounties pending approval"
              : "No bounties yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bounties.map((bounty) => (
            <div
              key={bounty.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {bounty.title}
                  </h3>
                  {bounty.client_name && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Client: {bounty.client_name}
                    </p>
                  )}
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Submitted by:{" "}
                    {bounty.submitter?.display_name ?? "Unknown"}
                  </p>
                </div>
                <span
                  className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                    bounty.status === "pending"
                      ? "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10"
                      : bounty.status === "open"
                      ? "text-green-400 bg-green-400/10"
                      : "text-[var(--color-text-muted)] bg-white/[0.05]"
                  }`}
                >
                  {bounty.status}
                </span>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-3">
                {bounty.description}
              </p>

              <div className="flex items-center gap-4 text-xs font-mono text-[var(--color-text-muted)] mb-3">
                {bounty.pay_cad && <span>${bounty.pay_cad} CAD</span>}
                {bounty.pay_tc && <span>₮{bounty.pay_tc}</span>}
                {bounty.deadline && (
                  <span>
                    Due: {new Date(bounty.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>

              {bounty.tech_stack && bounty.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {bounty.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className="text-[0.6rem] font-mono text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10 px-2 py-0.5 rounded"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {bounty.status === "pending" && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--glass-border)]">
                  <span className="text-xs font-mono text-[var(--color-text-muted)] mr-2">
                    Set difficulty:
                  </span>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={() => approveBounty(bounty.id, d)}
                      className="flex items-center gap-0.5 px-2 py-1 border border-[var(--glass-border)] rounded text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-brand-yellow)] hover:border-[var(--color-brand-yellow)]/30 transition-all"
                      title={`Approve with ${d} skull difficulty`}
                    >
                      {Array.from({ length: d }).map((_, i) => (
                        <span key={i} className="text-[0.6rem]">
                          ☠
                        </span>
                      ))}
                    </button>
                  ))}
                  <button
                    onClick={() => rejectBounty(bounty.id)}
                    className="ml-auto p-1.5 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    title="Reject"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submissions review (Round 4+ queue item) ────────────────────────────────
// Deliverable review for claimed bounties. Approve pays TC via the existing
// PATCH /api/bounties/[id]/review (awardRewards, xp always 0 per principle #3).
// bounty_submissions SELECT is open to authenticated users (migration 006);
// the write path is the T1-T3-gated review API, and middleware gates this
// route to T1-T3 anyway.

const SUB_STATUS_STYLE: Record<SubmissionRow["status"], string> = {
  pending: "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10",
  approved: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
  revision_requested: "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10",
};

function SubmissionsReview() {
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subFilter, setSubFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchSubs() {
      const supabase = createClient();
      let query = supabase
        .from("bounty_submissions")
        .select(
          "id, bounty_id, submission_text, attachment_urls, status, reviewer_notes, created_at, bounty:bounties(title, pay_tc), author:profiles!user_id(display_name)"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (subFilter === "pending") query = query.eq("status", "pending");
      const { data } = await query;
      if (!cancelled) {
        setSubs((data as unknown as SubmissionRow[]) ?? []);
        setLoading(false);
      }
    }
    fetchSubs();
    return () => {
      cancelled = true;
    };
  }, [subFilter]);

  async function review(
    sub: SubmissionRow,
    status: "approved" | "rejected" | "revision_requested"
  ) {
    setBusy(sub.id);
    setError(null);
    try {
      const res = await fetch(`/api/bounties/${sub.bounty_id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: sub.id,
          status,
          reviewer_notes: notes[sub.id]?.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Review failed (${res.status})`);
        return;
      }
      setSubs((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? { ...s, status, reviewer_notes: notes[sub.id]?.trim() || null }
            : s
        )
      );
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSubFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                subFilter === f
                  ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-xs font-mono text-red-400">{error}</p>
        )}
      </div>

      {loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading...
        </p>
      ) : subs.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">
            {subFilter === "pending"
              ? "No submissions awaiting review"
              : "No submissions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((sub) => (
            <div
              key={sub.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {sub.bounty?.title ?? "Unknown bounty"}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {sub.author?.display_name ?? "Unknown"} ·{" "}
                    {new Date(sub.created_at).toLocaleDateString()}
                    {sub.bounty?.pay_tc ? ` · pays ₮${sub.bounty.pay_tc}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${SUB_STATUS_STYLE[sub.status]}`}
                >
                  {sub.status.replace("_", " ")}
                </span>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] mb-3 whitespace-pre-wrap">
                {sub.submission_text}
              </p>

              {(sub.attachment_urls?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1 mb-3">
                  {sub.attachment_urls!.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[var(--color-accent-cyan)] hover:underline truncate"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}

              {sub.reviewer_notes && sub.status !== "pending" && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mb-3">
                  Notes: {sub.reviewer_notes}
                </p>
              )}

              {sub.status === "pending" && (
                <div className="pt-3 border-t border-[var(--glass-border)]">
                  <input
                    type="text"
                    value={notes[sub.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [sub.id]: e.target.value }))
                    }
                    placeholder="Reviewer notes (optional, sent to the member)"
                    maxLength={2000}
                    className="w-full mb-2 px-3 py-2 rounded text-xs bg-[var(--color-surface)] border border-[var(--glass-border)] text-[var(--color-text-primary)] outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => review(sub, "approved")}
                      disabled={busy === sub.id}
                      className="px-3 py-1.5 rounded text-xs font-mono text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-all disabled:opacity-50"
                    >
                      Approve + pay TC
                    </button>
                    <button
                      onClick={() => review(sub, "revision_requested")}
                      disabled={busy === sub.id}
                      className="px-3 py-1.5 rounded text-xs font-mono text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10 hover:bg-[var(--color-accent-cyan)]/20 transition-all disabled:opacity-50"
                    >
                      Request revision
                    </button>
                    <button
                      onClick={() => review(sub, "rejected")}
                      disabled={busy === sub.id}
                      className="ml-auto px-3 py-1.5 rounded text-xs font-mono text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
