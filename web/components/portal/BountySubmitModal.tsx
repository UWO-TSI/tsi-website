"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  Upload,
  Link as LinkIcon,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { Bounty, BountySubmission } from "@/lib/supabase/types";

interface BountySubmitModalProps {
  bounty: Bounty;
  onClose: () => void;
  onSubmitted: () => void;
}

const MAX_TEXT = 5000;
const MAX_ATTACHMENTS = 10;

// ─── BountySubmitModal ──────────────────────────────────────────────────────
// Modal that lets the bounty claimant submit deliverables for admin review.
// Wired into /student/dashboard/bounty/page.tsx detail view.
//
// - Fetches the user's existing submissions on mount so we can show the latest
//   status (pending/approved/revision_requested/rejected) + reviewer notes.
// - Form: description textarea + URL list + image/PDF upload (member-tier).
// - Submit POSTs /api/bounties/[id]/submit which inserts a new submission row
//   and flips the bounty status to "review". On revision_requested, the
//   resubmission creates a fresh row; the most recent one wins for review.
//
// Status transitions handled here:
//   bounty.claimed | in_progress  +  no submission     → "Submit Deliverables"
//   bounty.review                 +  pending submission → read-only banner
//   bounty.in_progress            +  revision_requested → "Resubmit" form
//   bounty.completed              +  approved          → success banner

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

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      setSubmitError("That link doesn't look like a valid URL.");
      return;
    }
    if (links.length + attachments.length >= MAX_ATTACHMENTS) {
      setSubmitError(`Max ${MAX_ATTACHMENTS} attachments total.`);
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
      setUploadError(`Max ${MAX_ATTACHMENTS} attachments total.`);
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
        setUploadError(body.error ?? "Upload failed");
        return;
      }
      setAttachments((prev) => [...prev, body.url as string]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
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
      setSubmitError(`Description is too long (max ${MAX_TEXT} chars).`);
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
        setSubmitError(body.error ?? "Could not submit. Try again.");
        return;
      }
      onSubmitted();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxWidth: 640,
          maxHeight: "90vh",
          background: "#0d1b2a",
          border: "1px solid rgba(0, 47, 167, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="min-w-0">
            <p
              className="text-[11px] font-mono uppercase tracking-wider"
              style={{ color: "var(--color-text-subtle)" }}
            >
              Submit deliverables
            </p>
            <h2
              className="text-base sm:text-lg font-semibold truncate"
              style={{ color: "var(--color-text-main)" }}
            >
              {bounty.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 ml-3 rounded-lg p-1.5 hover:bg-white/5"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
          {/* Status banners */}
          {loadingHistory ? (
            <div
              className="flex items-center gap-2 text-sm mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking submission status...
            </div>
          ) : (
            <>
              {isPendingReview && latest && (
                <StatusBanner
                  icon={<Clock className="w-4 h-4" />}
                  title="Submitted — awaiting review"
                  bg="rgba(255, 209, 102, 0.08)"
                  border="rgba(255, 209, 102, 0.3)"
                  color="#ffd166"
                >
                  An admin will review your work shortly. You&apos;ll be able to
                  resubmit if changes are requested.
                </StatusBanner>
              )}
              {isApproved && (
                <StatusBanner
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  title="Approved"
                  bg="rgba(34, 197, 94, 0.08)"
                  border="rgba(34, 197, 94, 0.3)"
                  color="#22c55e"
                >
                  Your reward has been credited. Nice work.
                </StatusBanner>
              )}
              {needsRevision && latest && (
                <StatusBanner
                  icon={<AlertCircle className="w-4 h-4" />}
                  title="Revisions requested"
                  bg="rgba(239, 68, 68, 0.08)"
                  border="rgba(239, 68, 68, 0.3)"
                  color="#ef4444"
                >
                  {latest.reviewer_notes ? (
                    <>
                      <span style={{ color: "var(--color-text-soft)" }}>
                        Reviewer feedback:
                      </span>{" "}
                      <span style={{ color: "var(--color-text-main)" }}>
                        {latest.reviewer_notes}
                      </span>
                    </>
                  ) : (
                    "An admin requested changes. Update your submission below."
                  )}
                </StatusBanner>
              )}
            </>
          )}

          {/* Form (only if user can still submit) */}
          {canSubmit && !loadingHistory && (
            <>
              <label
                className="block text-[11px] font-mono uppercase tracking-wider mb-2"
                style={{ color: "var(--color-text-subtle)" }}
              >
                Describe your work
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What you built, how to test it, any caveats..."
                rows={5}
                maxLength={MAX_TEXT}
                className="w-full rounded-lg text-sm resize-y"
                style={{
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--color-text-main)",
                  padding: "10px 12px",
                  minHeight: 120,
                  fontFamily: "inherit",
                }}
              />
              <div
                className="text-[11px] font-mono mt-1"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {text.length} / {MAX_TEXT}
              </div>

              {/* Link attachments */}
              <label
                className="block text-[11px] font-mono uppercase tracking-wider mt-5 mb-2"
                style={{ color: "var(--color-text-subtle)" }}
              >
                Link to deliverables (repo, doc, demo...)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
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
                  className="flex-1 rounded-lg text-sm"
                  style={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "var(--color-text-main)",
                    padding: "10px 12px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="rounded-lg text-sm font-medium px-4 py-2"
                  style={{
                    background: "rgba(0, 47, 167, 0.15)",
                    border: "1px solid rgba(0, 47, 167, 0.3)",
                    color: "var(--color-text-main)",
                  }}
                >
                  Add link
                </button>
              </div>

              {/* File upload */}
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBusy}
                  className="inline-flex items-center gap-2 rounded-lg text-sm font-medium px-3 py-2 disabled:opacity-50"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  {uploadBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload image or PDF
                    </>
                  )}
                </button>
                {uploadError && (
                  <p
                    className="text-xs mt-1.5"
                    style={{ color: "#ef4444" }}
                  >
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Attachment list */}
              {(attachments.length > 0 || links.length > 0) && (
                <div className="mt-4 space-y-1.5">
                  {attachments.map((url, i) => (
                    <AttachmentRow
                      key={`f-${i}`}
                      icon={<Paperclip className="w-3.5 h-3.5" />}
                      url={url}
                      label={fileLabel(url)}
                      onRemove={() => handleRemoveAttachment(i)}
                    />
                  ))}
                  {links.map((url, i) => (
                    <AttachmentRow
                      key={`l-${i}`}
                      icon={<LinkIcon className="w-3.5 h-3.5" />}
                      url={url}
                      label={url}
                      onRemove={() => handleRemoveLink(i)}
                    />
                  ))}
                </div>
              )}

              {submitError && (
                <p
                  className="text-sm mt-4 rounded-lg"
                  style={{
                    color: "#ef4444",
                    background: "rgba(239, 68, 68, 0.08)",
                    padding: "8px 12px",
                  }}
                >
                  {submitError}
                </p>
              )}
            </>
          )}

          {/* Past submissions (read-only) when there's history */}
          {!loadingHistory && submissions.length > 0 && (
            <div className="mt-6">
              <p
                className="text-[11px] font-mono uppercase tracking-wider mb-2"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {submissions.length === 1
                  ? "Submission"
                  : `Previous submissions (${submissions.length})`}
              </p>
              <div className="space-y-2">
                {submissions.map((s) => (
                  <PastSubmissionRow key={s.id} submission={s} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2"
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg text-sm font-medium px-4 py-2"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--color-text-soft)",
            }}
          >
            {canSubmit ? "Cancel" : "Close"}
          </button>
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitBusy || uploadBusy}
              className="rounded-lg text-sm font-semibold px-4 py-2 disabled:opacity-50"
              style={{
                background: "#002fa7",
                color: "#f1ffff",
              }}
            >
              {submitBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </span>
              ) : needsRevision ? (
                "Resubmit"
              ) : (
                "Submit for review"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBanner({
  icon,
  title,
  children,
  bg,
  border,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  bg: string;
  border: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg text-sm mb-4"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        padding: "10px 12px",
        color: "var(--color-text-soft)",
      }}
    >
      <div
        className="flex items-center gap-2 font-semibold mb-1"
        style={{ color }}
      >
        {icon}
        {title}
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function AttachmentRow({
  icon,
  url,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  url: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg text-xs"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "6px 10px",
      }}
    >
      <span style={{ color: "var(--color-text-subtle)" }}>{icon}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 truncate hover:underline"
        style={{ color: "var(--color-text-soft)" }}
      >
        {label}
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="rounded p-1 hover:bg-white/5"
        style={{ color: "var(--color-text-muted)" }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function PastSubmissionRow({ submission }: { submission: BountySubmission }) {
  const statusMeta: Record<
    BountySubmission["status"],
    { label: string; color: string; bg: string }
  > = {
    pending: {
      label: "Pending",
      color: "#ffd166",
      bg: "rgba(255, 209, 102, 0.1)",
    },
    approved: {
      label: "Approved",
      color: "#22c55e",
      bg: "rgba(34, 197, 94, 0.1)",
    },
    rejected: {
      label: "Rejected",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
    },
    revision_requested: {
      label: "Revisions requested",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
    },
  };
  const meta = statusMeta[submission.status];
  return (
    <div
      className="rounded-lg text-xs"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: 10,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="font-mono uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            background: meta.bg,
            color: meta.color,
            fontSize: 10,
          }}
        >
          {meta.label}
        </span>
        <span style={{ color: "var(--color-text-subtle)" }}>
          {new Date(submission.created_at).toLocaleString()}
        </span>
      </div>
      <p
        className="text-xs leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--color-text-soft)" }}
      >
        {submission.submission_text}
      </p>
      {submission.attachment_urls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {submission.attachment_urls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--color-accent-cyan)" }}
            >
              <LinkIcon className="w-3 h-3" />
              {fileLabel(u)}
            </a>
          ))}
        </div>
      )}
      {submission.reviewer_notes && (
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span style={{ color: "var(--color-text-subtle)" }}>Reviewer:</span>{" "}
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
