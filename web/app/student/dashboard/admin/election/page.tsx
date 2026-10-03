"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, Vote } from "lucide-react";
import { Badge, Card, Empty, ErrorNote, Loading, Progress } from "@/components/gui";
import { must, settle } from "@/lib/portal/load";

interface ElectionResult {
  candidate: string;
  vote_count: number;
}

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function AdminElectionPage() {
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [userTier, setUserTier] = useState<number>(4);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const profile = must(await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .maybeSingle());

      if (profile) setUserTier(profile.tier);

      if (profile && profile.tier <= 2) {
        const [electionRes, profileCount] = await Promise.all([
          supabase.rpc("get_election_results"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
        ]);

        const data: ElectionResult[] = must(electionRes) ?? [];
        must(profileCount);
        setResults(data);
        setTotalVotes(data.reduce((sum, r) => sum + r.vote_count, 0));
        setTotalProfiles(profileCount.count ?? 0);
      }
      return true;
    }
    void settle(fetchData).then(setState);
  }, [reload]);

  if (state === "loading" || state === "error") {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        {state === "loading" ? <Loading label="Counting the votes…" />
          : <ErrorNote onRetry={() => { setState("loading"); setReload((n) => n + 1); }}>The results didn’t load.</ErrorNote>}
      </div>
    );
  }

  if (state === "signed-out" || userTier > 2) {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          Election results are only open to the club’s admins.
        </Empty>
      </div>
    );
  }

  const maxVotes = results.length > 0 ? results[0].vote_count : 0;
  const participationRate =
    totalProfiles > 0 ? ((totalVotes / totalProfiles) * 100).toFixed(1) : "0";

  return (
    <div className={PAGE}>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Election results</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">
          The presidential election, counted live.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { label: "Votes cast", value: totalVotes },
          { label: "Members", value: totalProfiles },
          { label: "Turnout", value: `${participationRate}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm font-bold text-[var(--gui-ink-2)]">{stat.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--gui-ink-strong)]">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Results Table */}
      <Card style={{ padding: 0 }} className="overflow-hidden">
        <h2 className="border-b-2 border-dashed border-[var(--gui-paper-edge)] px-5 py-3 text-base font-extrabold text-[var(--gui-ink-strong)]">
          Candidates
        </h2>
        {results.length === 0 ? (
          <Empty icon={<Vote size={32} />} title="No votes yet">
            Results show here as members vote.
          </Empty>
        ) : (
          <ul>
            {results.map((r, i) => {
              const pct =
                totalVotes > 0
                  ? ((r.vote_count / totalVotes) * 100).toFixed(1)
                  : "0";
              const isLeader = i === 0;

              return (
                <li
                  key={r.candidate}
                  className="border-t-2 border-dashed border-[var(--gui-paper-edge)] px-5 py-4 first:border-t-0"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                        {r.candidate}
                      </span>
                      {isLeader && <Badge tone="gold">Leading</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--gui-muted)]">{pct}%</span>
                      <span className="font-extrabold text-[var(--gui-ink-strong)]">
                        {r.vote_count} {r.vote_count === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={r.vote_count}
                    max={maxVotes}
                    kind={isLeader ? "mastery" : "plain"}
                    label={`${r.candidate}: ${r.vote_count} of ${totalVotes} votes`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
