"use client";

import { Users } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

interface TeamData {
  id: string;
  name: string;
  side: string;
  portfolio: string | null;
  npo_partner: string | null;
  members: {
    id: string;
    display_name: string;
    class: string | null;
    level: number;
  }[];
}

export default function TeamWidget({
  team,
  profile,
}: {
  team: TeamData | null;
  profile: Profile;
}) {
  if (!team) {
    return (
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            Team
          </h3>
        </div>
        <div className="text-center py-4">
          <Users
            size={24}
            className="mx-auto text-[var(--color-text-muted)]/30 mb-2"
          />
          <p className="text-xs font-mono text-[var(--color-text-muted)]">
            No team assigned
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Team
        </h3>
        <span className="text-[0.6rem] font-mono text-[var(--color-accent-cyan)] uppercase">
          {team.side}
        </span>
      </div>

      <p className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
        {team.name}
      </p>
      {team.npo_partner && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] mb-3">
          Partner: {team.npo_partner}
        </p>
      )}
      {team.portfolio && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] mb-3">
          Portfolio: {team.portfolio}
        </p>
      )}

      <div className="space-y-2">
        {team.members?.slice(0, 5).map((member) => (
          <div key={member.id} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.55rem] font-mono ${
                member.id === profile.id
                  ? "bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)] border border-[var(--color-brand-blue)]/30"
                  : "bg-white/[0.05] text-[var(--color-text-muted)]"
              }`}
            >
              {member.display_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] truncate">
              {member.display_name}
            </span>
            <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)] ml-auto">
              LV{member.level}
            </span>
          </div>
        ))}
        {team.members && team.members.length > 5 && (
          <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
            +{team.members.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
