"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield } from "lucide-react";

interface ElectionResult {
  candidate: string;
  vote_count: number;
}

export default function AdminElectionPage() {
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [userTier, setUserTier] = useState<number>(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();

      if (profile) setUserTier(profile.tier);

      if (profile && profile.tier <= 2) {
        const [electionRes, profileCount] = await Promise.all([
          supabase.rpc("get_election_results"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
        ]);

        const data: ElectionResult[] = electionRes.data ?? [];
        setResults(data);
        setTotalVotes(data.reduce((sum, r) => sum + r.vote_count, 0));
        setTotalProfiles(profileCount.count ?? 0);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading results...
        </p>
      </div>
    );
  }

  if (userTier > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto text-[var(--color-text-muted)]/20 mb-4"
          />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-sm font-mono text-[var(--color-text-muted)]">
            T1/T2 clearance required for election results.
          </p>
        </div>
      </div>
    );
  }

  const maxVotes = results.length > 0 ? results[0].vote_count : 0;
  const participationRate =
    totalProfiles > 0 ? ((totalVotes / totalProfiles) * 100).toFixed(1) : "0";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Election Results
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Presidential Election · Live tallies
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4">
          <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            Total Votes
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
            {totalVotes}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4">
          <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            Total Members
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
            {totalProfiles}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4">
          <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            Participation
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-accent-cyan)]">
            {participationRate}%
          </p>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--glass-border)]">
          <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            Candidates
          </p>
        </div>
        <div className="divide-y divide-[var(--glass-border)]">
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-mono text-[var(--color-text-muted)]">
                No votes cast yet.
              </p>
            </div>
          ) : (
            results.map((r, i) => {
              const pct =
                totalVotes > 0
                  ? ((r.vote_count / totalVotes) * 100).toFixed(1)
                  : "0";
              const barWidth =
                maxVotes > 0 ? (r.vote_count / maxVotes) * 100 : 0;
              const isLeader = i === 0;

              return (
                <div key={r.candidate} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-mono font-bold ${
                          isLeader
                            ? "text-[var(--color-brand-yellow)]"
                            : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {isLeader && "★ "}
                        {r.candidate}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-[var(--color-text-muted)]">
                        {pct}%
                      </span>
                      <span className="text-[var(--color-text-primary)] font-bold">
                        {r.vote_count}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isLeader
                          ? "bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-accent-cyan)]"
                          : "bg-[var(--color-brand-blue)]/60"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
