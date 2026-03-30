"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Users, Shield, Star, Crown } from "lucide-react";

interface TeamRanking {
  id: string;
  name: string;
  side: string;
  total_xp: number;
  member_count: number;
}

interface MemberRanking {
  id: string;
  display_name: string;
  xp: number;
  level: number;
  class: string | null;
  rank: string;
  team_name: string | null;
}

const podiumColors = [
  "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30", // Gold
  "from-gray-300/15 to-gray-400/5 border-gray-400/30",       // Silver
  "from-amber-700/15 to-amber-800/5 border-amber-700/30",    // Bronze
];

const podiumTextColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
const podiumIcons = [Crown, Trophy, Trophy];

export default function LeaderboardPage() {
  const [teams, setTeams] = useState<TeamRanking[]>([]);
  const [members, setMembers] = useState<MemberRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"teams" | "individual">("teams");
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", user.id)
        .single();
      setUserTeamId(profile?.team_id ?? null);
    }

    // Fetch teams with aggregated XP from members
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, side, members:profiles(xp)")
      .order("name");

    if (teamsData) {
      const ranked: TeamRanking[] = teamsData
        .map((t) => {
          const membersList = (t.members as unknown as { xp: number }[]) ?? [];
          return {
            id: t.id,
            name: t.name,
            side: t.side ?? "unknown",
            total_xp: membersList.reduce((sum, m) => sum + (m.xp ?? 0), 0),
            member_count: membersList.length,
          };
        })
        .sort((a, b) => b.total_xp - a.total_xp);
      setTeams(ranked);
    }

    // Fetch individual members
    const { data: membersData } = await supabase
      .from("profiles")
      .select("id, display_name, xp, level, class, rank, team:teams(name)")
      .eq("is_active", true)
      .eq("is_alumni", false)
      .order("xp", { ascending: false })
      .limit(50);

    if (membersData) {
      setMembers(
        membersData.map((m) => ({
          ...m,
          team_name: (m.team as unknown as { name: string } | null)?.name ?? null,
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading leaderboard...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Trophy size={24} className="text-[var(--color-brand-yellow)]" />
          Leaderboard
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Rankings across all teams and agents
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1 mb-6 w-fit">
        {(["teams", "individual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono transition-all capitalize ${
              tab === t
                ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t === "teams" ? <Shield size={14} /> : <Star size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* Teams Tab */}
      {tab === "teams" && (
        <div className="space-y-2">
          {teams.map((team, idx) => {
            const isTop3 = idx < 3;
            const isUserTeam = team.id === userTeamId;
            const PodiumIcon = isTop3 ? podiumIcons[idx] : Trophy;

            return (
              <div
                key={team.id}
                className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                  isTop3
                    ? `bg-gradient-to-r ${podiumColors[idx]} border`
                    : isUserTeam
                    ? "bg-[var(--color-brand-blue)]/5 border border-[var(--color-brand-blue)]/20"
                    : "bg-[var(--color-bg-alt)] border border-[var(--glass-border)]"
                }`}
              >
                {/* Rank */}
                <div className="w-10 text-center shrink-0">
                  {isTop3 ? (
                    <PodiumIcon size={20} className={podiumTextColors[idx]} />
                  ) : (
                    <span className="text-lg font-heading font-bold text-[var(--color-text-muted)]">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Team Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-heading font-bold ${
                        isTop3
                          ? podiumTextColors[idx]
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {team.name}
                    </h3>
                    <span
                      className={`text-[0.55rem] font-mono px-1.5 py-0.5 rounded uppercase ${
                        team.side === "ops"
                          ? "bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)]"
                          : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
                      {team.side}
                    </span>
                    {isUserTeam && (
                      <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]">
                        YOUR TEAM
                      </span>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Users size={12} className="text-[var(--color-text-muted)]" />
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {team.member_count}
                  </span>
                </div>

                {/* XP */}
                <div className="text-right shrink-0 w-24">
                  <span
                    className={`text-sm font-heading font-bold ${
                      isTop3
                        ? podiumTextColors[idx]
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {team.total_xp.toLocaleString()}
                  </span>
                  <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] ml-1">
                    XP
                  </span>
                </div>
              </div>
            );
          })}

          {teams.length === 0 && (
            <div className="text-center py-12">
              <Shield size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                No teams found.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Individual Tab */}
      {tab === "individual" && (
        <div className="space-y-2">
          {members.map((member, idx) => {
            const isTop3 = idx < 3;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-4 rounded-lg p-3.5 transition-all ${
                  isTop3
                    ? `bg-gradient-to-r ${podiumColors[idx]} border`
                    : "bg-[var(--color-bg-alt)] border border-[var(--glass-border)]"
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {isTop3 ? (
                    <span className={`text-lg font-heading font-bold ${podiumTextColors[idx]}`}>
                      {idx + 1}
                    </span>
                  ) : (
                    <span className="text-sm font-heading text-[var(--color-text-muted)]">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-mono text-[var(--color-brand-blue)]">
                    {member.display_name?.[0]?.toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-heading font-bold ${
                        isTop3
                          ? podiumTextColors[idx]
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {member.display_name}
                    </span>
                    <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)]">
                      LV{member.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                    {member.class && <span>{member.class}</span>}
                    {member.team_name && (
                      <>
                        <span>&middot;</span>
                        <span>{member.team_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-heading font-bold ${
                      isTop3
                        ? podiumTextColors[idx]
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {member.xp.toLocaleString()}
                  </span>
                  <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] ml-1">
                    XP
                  </span>
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-12">
              <Star size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                No members found.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
