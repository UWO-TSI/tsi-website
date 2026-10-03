"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Inbox, Skull } from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorNote, Field, Loading, Tabs, type BadgeTone } from "@/components/gui";

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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

/** A posting's status as a tag: waiting is honey, open is green, the rest plain. */
const postingStatus = (status: string): { tone: BadgeTone; label: string } =>
  status === "pending" ? { tone: "warn", label: "Pending" }
    : status === "open" ? { tone: "success", label: "Open" }
    : { tone: "neutral", label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") };

export default function AdminBountiesPage() {
  const [view, setView] = useState<"postings" | "submissions">("postings");
  const [bounties, setBounties] = useState<PendingBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [confirmReject, setConfirmReject] = useState<PendingBounty | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const { error: deleteError } = await supabase.from("bounties").delete().eq("id", id);
    if (deleteError) return setError("That posting wasn’t rejected. Try again.");
    setError(null);
    setBounties((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className={PAGE}>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
          {view === "postings" ? "Bounty approval" : "Submission review"}
        </h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">
          {view === "postings"
            ? `${bounties.filter((b) => b.status === "pending").length} waiting for approval`
            : "Delivered work waiting for a decision on its Gems"}
        </p>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs
          label="Bounty admin"
          value={view}
          onChange={setView}
          tabs={[
            { id: "postings", label: "Postings" },
            { id: "submissions", label: "Submissions" },
          ]}
        />
        {view === "postings" && (
          <Tabs
            label="Which postings"
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "pending", label: "Pending" },
              { id: "all", label: "All" },
            ]}
          />
        )}
      </div>

      {error && view === "postings" && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {view === "submissions" ? (
        <SubmissionsReview />
      ) : loading ? (
        <Loading label="Getting the postings…" />
      ) : bounties.length === 0 ? (
        <Empty icon={<Inbox size={32} />} title={filter === "pending" ? "Nothing waiting for approval" : "No bounties yet"}>
          {filter === "pending"
            ? "New postings wait here before they go up on the board."
            : "Postings from partners and members show up here."}
        </Empty>
      ) : (
        <div className="space-y-3">
          {bounties.map((bounty) => {
            const status = postingStatus(bounty.status);
            return (
              <Card key={bounty.id} as="article">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                      {bounty.title}
                    </h3>
                    {bounty.client_name && (
                      <p className="text-sm text-[var(--gui-ink-2)]">
                        For {bounty.client_name}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-[var(--gui-muted)]">
                      Posted by {bounty.submitter?.display_name ?? "an unknown member"}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                <p className="mb-3 line-clamp-3 text-sm text-[var(--gui-ink)]">
                  {bounty.description}
                </p>

                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--gui-ink-2)]">
                  {bounty.pay_tc ? (
                    <span className="inline-flex items-center gap-1.5">
                      Pays <Amount n={bounty.pay_tc} currency="gems" />
                    </span>
                  ) : null}
                  {bounty.deadline && <span>Due {day(bounty.deadline)}</span>}
                </div>

                {bounty.tech_stack && bounty.tech_stack.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {bounty.tech_stack.map((tech) => (
                      <Badge key={tech}>{tech}</Badge>
                    ))}
                  </div>
                )}

                {bounty.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-[var(--gui-paper-edge)] pt-3">
                    <span className="mr-1 text-sm font-bold text-[var(--gui-ink-2)]">
                      Approve at difficulty
                    </span>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant="quiet"
                        onClick={() => approveBounty(bounty.id, d)}
                        aria-label={`Approve at difficulty ${d} of 5`}
                        title={`Approve at difficulty ${d} of 5`}
                      >
                        <span className="inline-flex items-center gap-0.5" aria-hidden>
                          {Array.from({ length: d }).map((_, i) => (
                            <Skull key={i} size={14} />
                          ))}
                        </span>
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      onClick={() => setConfirmReject(bounty)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmReject !== null}
        danger
        title="Reject this posting?"
        confirmLabel="Reject and delete"
        cancelLabel="Keep it"
        onCancel={() => setConfirmReject(null)}
        onConfirm={() => {
          if (confirmReject) void rejectBounty(confirmReject.id);
          setConfirmReject(null);
        }}
      >
        “{confirmReject?.title}” is deleted and never goes up on the board.
      </ConfirmDialog>
    </div>
  );
}

// ─── Submissions review (Round 4+ queue item) ────────────────────────────────
// Deliverable review for claimed bounties. Approve pays TC via the existing
// PATCH /api/bounties/[id]/review (awardRewards, xp always 0 per principle #3).
// bounty_submissions SELECT is open to authenticated users (migration 006);
// the write path is the T1-T3-gated review API, and middleware gates this
// route to T1-T3 anyway.

const SUB_STATUS: Record<SubmissionRow["status"], { tone: BadgeTone; label: string }> = {
  pending: { tone: "warn", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  revision_requested: { tone: "info", label: "Revision requested" },
};

function SubmissionsReview() {
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subFilter, setSubFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<SubmissionRow | null>(null);

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
        setError(body?.error ?? `The review didn’t save (error ${res.status}).`);
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
      setError("Couldn’t reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Tabs
          label="Which submissions"
          value={subFilter}
          onChange={setSubFilter}
          tabs={[
            { id: "pending", label: "Pending" },
            { id: "all", label: "All" },
          ]}
        />
      </div>
      {error && <ErrorNote className="sticky top-16 z-10 mb-4 shadow-[var(--gui-shadow-md)]">{error}</ErrorNote>}

      {loading ? (
        <Loading label="Getting the submissions…" />
      ) : subs.length === 0 ? (
        <Empty icon={<Inbox size={32} />} title={subFilter === "pending" ? "Nothing waiting for review" : "No submissions yet"}>
          {subFilter === "pending"
            ? "Delivered work lands here for a decision."
            : "Deliverables show up here once members send them."}
        </Empty>
      ) : (
        <div className="space-y-3">
          {subs.map((sub) => (
            <Card key={sub.id} as="article">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                    {sub.bounty?.title ?? "Unknown bounty"}
                  </h3>
                  <p className="mt-0.5 text-sm text-[var(--gui-muted)]">
                    {sub.author?.display_name ?? "Unknown"} · {day(sub.created_at)}
                    {sub.bounty?.pay_tc ? (
                      <> · pays <Amount n={sub.bounty.pay_tc} currency="gems" /></>
                    ) : null}
                  </p>
                </div>
                <Badge tone={SUB_STATUS[sub.status]?.tone ?? "neutral"}>
                  {SUB_STATUS[sub.status]?.label ?? sub.status}
                </Badge>
              </div>

              <p className="mb-3 whitespace-pre-wrap text-sm text-[var(--gui-ink)]">
                {sub.submission_text}
              </p>

              {(sub.attachment_urls?.length ?? 0) > 0 && (
                <div className="mb-3 flex flex-col gap-1">
                  {sub.attachment_urls!.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-bold text-[var(--gui-teal-ink)] underline"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}

              {sub.reviewer_notes && sub.status !== "pending" && (
                <p className="mb-3 text-sm text-[var(--gui-ink-2)]">
                  <b className="font-extrabold">Notes:</b> {sub.reviewer_notes}
                </p>
              )}

              {sub.status === "pending" && (
                <div className="space-y-3 border-t-2 border-dashed border-[var(--gui-paper-edge)] pt-3">
                  <Field
                    label="Notes for the member"
                    hint="Optional. They see these with your decision."
                    value={notes[sub.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [sub.id]: e.target.value }))
                    }
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => review(sub, "approved")}
                      disabled={busy === sub.id}
                    >
                      Approve and pay the Gems
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => review(sub, "revision_requested")}
                      disabled={busy === sub.id}
                    >
                      Ask for a revision
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      onClick={() => setConfirmReject(sub)}
                      disabled={busy === sub.id}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmReject !== null}
        danger
        title="Reject this submission?"
        confirmLabel="Reject"
        cancelLabel="Not now"
        onCancel={() => setConfirmReject(null)}
        onConfirm={() => {
          if (confirmReject) void review(confirmReject, "rejected");
          setConfirmReject(null);
        }}
      >
        {confirmReject?.author?.display_name ?? "The member"} gets no Gems for “{confirmReject?.bounty?.title ?? "this bounty"}”. To let them fix it, ask for a revision instead.
      </ConfirmDialog>
    </div>
  );
}
