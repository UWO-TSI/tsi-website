"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, X, Skull } from "lucide-react";

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

export default function AdminBountiesPage() {
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
            Bounty Approval
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {bounties.filter((b) => b.status === "pending").length} pending
            review
          </p>
        </div>
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
      </div>

      {loading ? (
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
