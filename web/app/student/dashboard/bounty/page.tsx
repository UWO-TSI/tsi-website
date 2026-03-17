"use client";

import { useState, useEffect, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Skull,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Send,
  Loader2,
  SlidersHorizontal,
  DollarSign,
  Coins,
  Tag,
  FileText,
  Users,
  AlertCircle,
} from "lucide-react";

/* ─── Types ─── */

type BountyStatus =
  | "OPEN"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "REVIEW"
  | "COMPLETED"
  | "EXPIRED";

interface Bounty {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  pay_cad: number | null;
  pay_tc: number | null;
  deadline: string | null;
  difficulty: number; // 1-5
  tech_stack: string[];
  status: BountyStatus;
  deliverables: string | null;
  assigned_members: string[] | null;
  created_at: string;
}

/* ─── Status config ─── */

const STATUS_STYLES: Record<
  BountyStatus,
  { bg: string; text: string; glow: string }
> = {
  OPEN: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.3)]",
  },
  CLAIMED: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
  },
  IN_PROGRESS: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    glow: "shadow-[0_0_8px_rgba(59,130,246,0.3)]",
  },
  REVIEW: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.3)]",
  },
  COMPLETED: {
    bg: "bg-gray-500/15",
    text: "text-gray-400",
    glow: "",
  },
  EXPIRED: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    glow: "",
  },
};

const ALL_STATUSES: BountyStatus[] = [
  "OPEN",
  "CLAIMED",
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETED",
  "EXPIRED",
];

/* ─── Helpers ─── */

function SkullRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" title={`Difficulty: ${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={
            i < rating
              ? "text-[var(--color-brand-yellow)] drop-shadow-[0_0_4px_rgba(255,209,102,0.6)]"
              : "text-[var(--color-text-muted)] opacity-30"
          }
        >
          ☠
        </span>
      ))}
    </span>
  );
}

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (days < 0) return { label: `${formatted} (overdue)`, urgent: true };
  if (days <= 3) return { label: `${formatted} (${days}d left)`, urgent: true };
  return { label: `${formatted} (${days}d left)`, urgent: false };
}

/* ─── Main Component ─── */

export default function BountyBoardPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BountyStatus | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    fetchBounties();
  }, []);

  async function fetchBounties() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .neq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBounties(data as Bounty[]);
    }
    setLoading(false);
  }

  async function claimBounty(bountyId: string) {
    setClaiming(bountyId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setClaiming(null);
      return;
    }

    await supabase
      .from("bounties")
      .update({
        status: "CLAIMED",
        assigned_members: [user.id],
      })
      .eq("id", bountyId)
      .eq("status", "OPEN");

    setClaiming(null);
    fetchBounties();
  }

  const filtered = bounties.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (difficultyFilter !== null && b.difficulty !== difficultyFilter)
      return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)] tracking-tight">
            ⚔ Bounty Board
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            Claim a contract. Deliver the goods. Collect your reward.
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
            bg-[var(--color-brand-blue)] text-white text-sm font-mono font-medium
            hover:brightness-110 transition-all cursor-pointer
            shadow-[0_0_12px_var(--glow-blue)]"
        >
          <Plus size={16} />
          Post Bounty
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-muted)]
            hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <SlidersHorizontal size={14} />
          Filters
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showFilters && (
          <div
            className="mt-3 p-4 rounded-xl border border-[var(--glass-border-soft)]
              bg-[var(--color-surface)]/60 backdrop-blur-md flex flex-wrap gap-4"
          >
            {/* Status filter */}
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(["ALL", ...ALL_STATUSES] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer
                      ${
                        statusFilter === s
                          ? "bg-[var(--color-brand-blue)] text-white"
                          : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border-soft)]"
                      }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty filter */}
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">
                Difficulty
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDifficultyFilter(null)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer
                    ${
                      difficultyFilter === null
                        ? "bg-[var(--color-brand-blue)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border-soft)]"
                    }`}
                >
                  ALL
                </button>
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(d)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer
                      ${
                        difficultyFilter === d
                          ? "bg-[var(--color-brand-yellow)]/20 text-[var(--color-brand-yellow)] border border-[var(--color-brand-yellow)]/30"
                          : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border-soft)]"
                      }`}
                  >
                    {"☠".repeat(d)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2
            className="animate-spin text-[var(--color-accent-cyan)]"
            size={28}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[var(--color-text-muted)] font-mono text-sm">
            No bounties match your filters.
          </p>
        </div>
      )}

      {/* Bounty cards */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((bounty) => {
            const isExpanded = expandedId === bounty.id;
            const status = STATUS_STYLES[bounty.status];
            const deadline = bounty.deadline
              ? formatDeadline(bounty.deadline)
              : null;

            return (
              <div
                key={bounty.id}
                className={`rounded-xl border transition-all duration-200
                  ${
                    isExpanded
                      ? "border-[var(--color-brand-yellow)]/30 shadow-[0_0_20px_var(--glow-gold)]"
                      : "border-[var(--glass-border-soft)] hover:border-[var(--glass-border-strong)]"
                  }
                  bg-[var(--color-surface)]`}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : bounty.id)
                  }
                  className="w-full text-left p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Top row: status + difficulty */}
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest
                            ${status.bg} ${status.text} ${status.glow}`}
                        >
                          {bounty.status.replace("_", " ")}
                        </span>
                        <SkullRating rating={bounty.difficulty} />
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-heading font-semibold text-[var(--color-text-primary)] truncate">
                        {bounty.title}
                      </h3>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {bounty.client_name}
                        </span>

                        {(bounty.pay_cad || bounty.pay_tc) && (
                          <span className="flex items-center gap-1 text-[var(--color-brand-yellow)]">
                            {bounty.pay_cad != null && (
                              <>
                                <DollarSign size={12} />
                                {bounty.pay_cad.toLocaleString()} CAD
                              </>
                            )}
                            {bounty.pay_cad != null &&
                              bounty.pay_tc != null && (
                                <span className="text-[var(--color-text-muted)] mx-0.5">
                                  +
                                </span>
                              )}
                            {bounty.pay_tc != null && (
                              <>
                                <Coins size={12} />
                                {bounty.pay_tc.toLocaleString()} ₮C
                              </>
                            )}
                          </span>
                        )}

                        {deadline && (
                          <span
                            className={`flex items-center gap-1 ${
                              deadline.urgent
                                ? "text-[var(--color-error)]"
                                : ""
                            }`}
                          >
                            <Clock size={12} />
                            {deadline.label}
                          </span>
                        )}
                      </div>

                      {/* Tech stack tags */}
                      {bounty.tech_stack && bounty.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {bounty.tech_stack.map((tech) => (
                            <span
                              key={tech}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono
                                bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)]
                                border border-[var(--color-accent-cyan)]/20"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expand chevron */}
                    <div className="pt-1 text-[var(--color-text-muted)]">
                      {isExpanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--glass-border-soft)]">
                    <div className="pt-4 space-y-4">
                      {/* Description */}
                      {bounty.description && (
                        <div>
                          <h4 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <FileText size={12} />
                            Mission Brief
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                            {bounty.description}
                          </p>
                        </div>
                      )}

                      {/* Deliverables */}
                      {bounty.deliverables && (
                        <div>
                          <h4 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Tag size={12} />
                            Deliverables
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                            {bounty.deliverables}
                          </p>
                        </div>
                      )}

                      {/* Assigned members */}
                      {bounty.assigned_members &&
                        bounty.assigned_members.length > 0 && (
                          <div>
                            <h4 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Users size={12} />
                              Assigned Operatives
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {bounty.assigned_members.map((member, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-md text-xs font-mono
                                    bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]
                                    border border-[var(--color-brand-blue)]/20"
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Claim button */}
                      {bounty.status === "OPEN" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            claimBounty(bounty.id);
                          }}
                          disabled={claiming === bounty.id}
                          className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-lg
                            bg-emerald-500/15 text-emerald-400 text-sm font-mono font-semibold
                            border border-emerald-500/30
                            hover:bg-emerald-500/25 hover:shadow-[0_0_16px_rgba(34,197,94,0.25)]
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all cursor-pointer"
                        >
                          {claiming === bounty.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Skull size={16} />
                          )}
                          {claiming === bounty.id
                            ? "Claiming..."
                            : "Claim Bounty"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Bounty Modal */}
      {showSubmitModal && (
        <SubmitBountyModal
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => {
            setShowSubmitModal(false);
            fetchBounties();
          }}
        />
      )}
    </div>
  );
}

/* ─── Submit Bounty Modal ─── */

function SubmitBountyModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [payCad, setPayCad] = useState("");
  const [payTc, setPayTc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [techStack, setTechStack] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) {
      setError("Title and client name are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("bounties").insert({
      title: title.trim(),
      description: description.trim() || null,
      client_name: clientName.trim(),
      pay_cad: payCad ? parseFloat(payCad) : null,
      pay_tc: payTc ? parseInt(payTc, 10) : null,
      deadline: deadline || null,
      tech_stack: techStack
        ? techStack
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      status: "pending",
      difficulty: 1,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[var(--color-brand-yellow)]/25
          bg-[var(--color-bg-alt)] shadow-[0_0_40px_var(--glow-gold)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--glass-border-soft)]">
          <div>
            <h2 className="text-xl font-heading font-bold text-[var(--color-text-primary)]">
              Post a Bounty
            </h2>
            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
              Submitted bounties are reviewed before going live.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)]
              hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm font-mono text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-lg p-3 border border-[var(--color-error)]/20">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Redesign nonprofit landing page"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-[var(--color-surface)] text-[var(--color-text-primary)]
                border border-[var(--glass-border-soft)]
                placeholder:text-[var(--color-text-muted)]/50
                focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                focus:shadow-[0_0_8px_var(--glow-gold)]
                transition-all"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Client Name *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. London Food Bank"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-[var(--color-surface)] text-[var(--color-text-primary)]
                border border-[var(--glass-border-soft)]
                placeholder:text-[var(--color-text-muted)]/50
                focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                focus:shadow-[0_0_8px_var(--glow-gold)]
                transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none
                bg-[var(--color-surface)] text-[var(--color-text-primary)]
                border border-[var(--glass-border-soft)]
                placeholder:text-[var(--color-text-muted)]/50
                focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                focus:shadow-[0_0_8px_var(--glow-gold)]
                transition-all"
            />
          </div>

          {/* Pay row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Pay (CAD)
              </label>
              <div className="relative">
                <DollarSign
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payCad}
                  onChange={(e) => setPayCad(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm font-mono
                    bg-[var(--color-surface)] text-[var(--color-text-primary)]
                    border border-[var(--glass-border-soft)]
                    placeholder:text-[var(--color-text-muted)]/50
                    focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                    focus:shadow-[0_0_8px_var(--glow-gold)]
                    transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Pay (₮C)
              </label>
              <div className="relative">
                <Coins
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="number"
                  min="0"
                  value={payTc}
                  onChange={(e) => setPayTc(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm font-mono
                    bg-[var(--color-surface)] text-[var(--color-text-primary)]
                    border border-[var(--glass-border-soft)]
                    placeholder:text-[var(--color-text-muted)]/50
                    focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                    focus:shadow-[0_0_8px_var(--glow-gold)]
                    transition-all"
                />
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-[var(--color-surface)] text-[var(--color-text-primary)]
                border border-[var(--glass-border-soft)]
                focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                focus:shadow-[0_0_8px_var(--glow-gold)]
                transition-all"
            />
          </div>

          {/* Tech stack */}
          <div>
            <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Tech Stack
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="React, Figma, Supabase"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-[var(--color-surface)] text-[var(--color-text-primary)]
                border border-[var(--glass-border-soft)]
                placeholder:text-[var(--color-text-muted)]/50
                focus:outline-none focus:border-[var(--color-brand-yellow)]/40
                focus:shadow-[0_0_8px_var(--glow-gold)]
                transition-all"
            />
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">
              Comma-separated
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-[var(--color-brand-yellow)]/15 text-[var(--color-brand-yellow)] text-sm font-mono font-semibold
              border border-[var(--color-brand-yellow)]/30
              hover:bg-[var(--color-brand-yellow)]/25 hover:shadow-[0_0_16px_var(--glow-gold)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all cursor-pointer"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
