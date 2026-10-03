"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Loader2,
  Upload,
  Link as LinkIcon,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";
import type { Bounty, BountySubmission } from "@/lib/supabase/types";
import { Badge, Button, ErrorNote, Field, IconButton, Loading, Sheet, TextArea, type BadgeTone } from "@/components/gui";

interface BountySubmitModalProps {
  bounty: Bounty;
  onClose: () => void;
  onSubmitted: () => void;
}

const MAX_TEXT = 5000;
const MAX_ATTACHMENTS = 10;

// ─── BountySubmitModal ──────────────────────────────────────────────────────
// The sheet that lets the bounty claimant submit deliverables for admin review.
// Wired into /student/dashboard/bounty/page.tsx detail view, which mounts it
// only while it's open (so the Sheet is always open here; Escape, focus and the
// scrim come from the Sheet).
//
// - Fetches the user's existing submissions on mount so we can show the latest
//   status (pending/approved/revision_requested/rejected) + reviewer notes.
// - Form: description textarea + URL list + image/PDF upload (member-tier).
// - Submit POSTs /api/bounties/[id]/submit which inserts a new submission row
//   and flips the bounty status to "review". On revision_requested, the
//   resubmission creates a fresh row; the most recent one wins for review.
//
// Status transitions handled here:
//   bounty.claimed | in_progress  +  no submission     → "Submit for review"
//   bounty.review                 +  pending submission → read-only note
//   bounty.in_progress            +  revision_requested → "Resubmit" form
//   bounty.completed              +  approved          → approved note

export default function BountySubmitModal({
  bounty,
  onClose,
  onSubmitted,
}: BountySubmitModalProps) {
  const [submissions, setSubmissions] = useState<BountySubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bounties/${bounty.id}/submit`)
      .then((r) => (r.ok ? r.json() : { submissions: [] }))
      .then((d) => {
        if (!cancelled) setSubmissions(d.submissions ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bounty.id]);

  const latest = submissions[0] ?? null;
  const isPendingReview = latest?.status === "pending";
  const isApproved = latest?.status === "approved";
  const needsRevision = latest?.status === "revision_requested";

  // Submission form is shown when the user has NOT yet submitted (no latest)
  // OR the latest submission was marked revision_requested. Hidden when
  // pending review or already approved.
  const canSubmit = !latest || needsRevision;

  const handleAddLink = () => {
    const trimmed = linkDraft.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setSubmitError("That doesn’t look like a link. Paste the whole address, starting with https://");
      return;
    }
    if (links.length + attachments.length >= MAX_ATTACHMENTS) {
      setSubmitError(`You can add up to ${MAX_ATTACHMENTS} files and links.`);
      return;
    }
    setSubmitError(null);
    setLinks((prev) => [...prev, trimmed]);
    setLinkDraft("");
  };

  const handleRemoveLink = (i: number) => {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleRemoveAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (links.length + attachments.length >= MAX_ATTACHMENTS) {
      setUploadError(`You can add up to ${MAX_ATTACHMENTS} files and links.`);
      return;
    }

    setUploadBusy(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/bounties/${bounty.id}/submissions/upload`,
        { method: "POST", body: formData },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.url) {
        setUploadError(body.error ?? "That file didn’t upload. Try again.");
        return;
      }
      setAttachments((prev) => [...prev, body.url as string]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "That file didn’t upload. Try again.");
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setSubmitError("Describe your work in a few sentences.");
      return;
    }
    if (trimmed.length > MAX_TEXT) {
      setSubmitError(`Keep the description to ${MAX_TEXT.toLocaleString()} characters or fewer.`);
      return;
    }
    const attachment_urls = [...attachments, ...links];

    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/bounties/${bounty.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submission_text: trimmed,
          attachment_urls,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        submission?: BountySubmission;
        error?: string;
      };
      if (!res.ok) {
        setSubmitError(body.error ?? "Your work didn’t send. Try again.");
        return;
      }
      onSubmitted();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Your work didn’t send. Check your connection and try again.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const reviewing = bounty.status === "review" || bounty.status === "completed";

  return (
    <Sheet
      open
      onClose={onClose}
      title={bounty.title}
      eyebrow={reviewing ? "Your submission" : "Submit deliverables"}
      icon={<Send size={22} />}
      size="md"
      footer={
        <>
          <Button size="sm" variant="quiet" onClick={onClose}>
            {canSubmit ? "Cancel" : "Close"}
          </Button>
          {canSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={submitBusy || uploadBusy}>
              {submitBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : needsRevision ? (
                "Resubmit"
              ) : (
                "Submit for review"
              )}
            </Button>
          )}
        </>
      }
    >
      {/* Status notes */}
      {loadingHistory ? (
        <Loading label="Looking for your earlier submissions…" />
      ) : (
        <>
          {isPendingReview && latest && (
            <StatusNote tone="warn" icon={<Clock className="w-4 h-4" aria-hidden />} title="Submitted, waiting for review">
              An admin will look at it soon. If they ask for changes, you can send it again here.
            </StatusNote>
          )}
          {isApproved && (
            <StatusNote tone="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden />} title="Approved">
              Your reward has been paid out. Nice work.
            </StatusNote>
          )}
          {needsRevision && latest && (
            <StatusNote tone="danger" icon={<AlertCircle className="w-4 h-4" aria-hidden />} title="Changes requested">
              {latest.reviewer_notes ? (
                <>
                  <span style={{ color: "var(--gui-ink-2)" }}>
                    Reviewer feedback:
                  </span>{" "}
                  <span style={{ color: "var(--gui-ink-strong)" }}>
                    {latest.reviewer_notes}
                  </span>
                </>
              ) : (
                "An admin asked for changes. Update your submission below."
              )}
            </StatusNote>
          )}
        </>
      )}

      {/* Form (only if user can still submit) */}
      {canSubmit && !loadingHistory && (
        <div className="space-y-6">
          <div>
            <TextArea
              label="Describe your work"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What you built, how to test it, anything to watch out for…"
              rows={5}
              maxLength={MAX_TEXT}
            />
            <p className="text-xs mt-1.5 text-right" style={{ color: "var(--gui-muted)" }}>
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
            </p>
          </div>

          <div>
            {/* Link attachments */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <Field
                className="flex-1"
                label="Links to your work"
                hint="A repo, a doc or a live demo."
                type="url"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLink();
                  }
                }}
                placeholder="https://github.com/your/repo"
              />
              <Button variant="quiet" onClick={handleAddLink}>
                Add link
              </Button>
            </div>

            {/* File upload */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button size="sm" variant="quiet" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy}>
                {uploadBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" aria-hidden />
                    Upload an image or PDF
                  </>
                )}
              </Button>
              {uploadError && <ErrorNote className="mt-2">{uploadError}</ErrorNote>}
            </div>

            {/* Attachment list */}
            {(attachments.length > 0 || links.length > 0) && (
              <ul className="mt-4 space-y-2" aria-label="Attached so far">
                {attachments.map((url, i) => (
                  <AttachmentRow
                    key={`f-${i}`}
                    icon={<Paperclip className="w-4 h-4" />}
                    url={url}
                    label={fileLabel(url)}
                    onRemove={() => handleRemoveAttachment(i)}
                  />
                ))}
                {links.map((url, i) => (
                  <AttachmentRow
                    key={`l-${i}`}
                    icon={<LinkIcon className="w-4 h-4" />}
                    url={url}
                    label={url}
                    onRemove={() => handleRemoveLink(i)}
                  />
                ))}
              </ul>
            )}
          </div>

          {submitError && <ErrorNote>{submitError}</ErrorNote>}
        </div>
      )}

      {/* Past submissions (read-only) when there's history */}
      {!loadingHistory && submissions.length > 0 && (
        <section className={canSubmit ? "mt-8" : "mt-2"}>
          <h3 className="text-sm mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
            {submissions.length === 1
              ? "Your submission"
              : `Your submissions (${submissions.length})`}
          </h3>
          <div className="space-y-2">
            {submissions.map((s) => (
              <PastSubmissionRow key={s.id} submission={s} />
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Soft status paper: the tone's wash with its ink for the title (the Badge pairs, AA). */
const NOTE_TONES = {
  warn: { bg: "var(--gui-warn-soft)", ink: "var(--gui-warn)" },
  success: { bg: "var(--gui-success-soft)", ink: "var(--gui-success)" },
  danger: { bg: "var(--gui-danger-soft)", ink: "var(--gui-danger)" },
} as const;

function StatusNote({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof NOTE_TONES;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const t = NOTE_TONES[tone];
  return (
    <div
      className="text-sm mb-5"
      style={{
        background: t.bg,
        borderRadius: "var(--gui-r-card)",
        padding: "12px 16px",
        color: "var(--gui-ink)",
      }}
    >
      <p className="flex items-center gap-2 mb-1" style={{ color: t.ink, fontWeight: 800 }}>
        {icon}
        {title}
      </p>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function AttachmentRow({
  icon,
  url,
  label,
  onRemove,
}: {
  icon: ReactNode;
  url: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <li
      className="flex items-center gap-2.5 text-sm"
      style={{
        background: "var(--gui-paper-warm)",
        borderRadius: 16,
        padding: "4px 4px 4px 14px",
        boxShadow: "inset 0 0 0 1.5px var(--gui-paper-edge)",
      }}
    >
      <span className="shrink-0" style={{ color: "var(--gui-bark)" }} aria-hidden>
        {icon}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 truncate underline-offset-2 hover:underline"
        style={{ color: "var(--gui-ink)", fontWeight: 700 }}
      >
        {label}
      </a>
      <IconButton label="Remove attachment" size="sm" onClick={onRemove}>
        <X size={16} aria-hidden />
      </IconButton>
    </li>
  );
}

const SUBMISSION_STATUS: Record<BountySubmission["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "Waiting for review", tone: "warn" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not accepted", tone: "danger" },
  revision_requested: { label: "Changes requested", tone: "danger" },
};

function PastSubmissionRow({ submission }: { submission: BountySubmission }) {
  const meta = SUBMISSION_STATUS[submission.status];
  return (
    <div
      className="text-sm"
      style={{
        background: "var(--gui-paper-warm)",
        borderRadius: "var(--gui-r-card)",
        boxShadow: "inset 0 0 0 1.5px var(--gui-paper-edge)",
        padding: "10px 14px 12px",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span className="text-xs" style={{ color: "var(--gui-muted)" }}>
          {new Date(submission.created_at).toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Toronto",
          })}
        </span>
      </div>
      <p
        className="leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--gui-ink)" }}
      >
        {submission.submission_text}
      </p>
      {submission.attachment_urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {submission.attachment_urls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              style={{ color: "var(--gui-teal-ink)", fontWeight: 700 }}
            >
              <LinkIcon className="w-3.5 h-3.5" aria-hidden />
              {fileLabel(u)}
            </a>
          ))}
        </div>
      )}
      {submission.reviewer_notes && (
        <p
          className="mt-2 leading-relaxed"
          style={{ color: "var(--gui-ink-2)" }}
        >
          <span style={{ color: "var(--gui-muted)", fontWeight: 800 }}>Reviewer:</span>{" "}
          {submission.reviewer_notes}
        </p>
      )}
    </div>
  );
}

function fileLabel(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).pop() ?? url;
    return decodeURIComponent(tail).slice(0, 50);
  } catch {
    return url.slice(0, 50);
  }
}
