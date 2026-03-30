"use client";

import { xpForLevel, type Profile } from "@/lib/supabase/types";

export default function XPWidget({ profile }: { profile: Profile }) {
  const currentLevelXP = xpForLevel(profile.level);
  const nextLevelXP = xpForLevel(profile.level + 1);
  const progress =
    ((profile.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Experience
        </h3>
        <span className="text-xs font-mono text-[var(--color-brand-yellow)]">
          {profile.rank}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-mono font-bold text-[var(--color-text-primary)]">
          {profile.level}
        </span>
        <span className="text-sm font-mono text-[var(--color-text-muted)]">
          LEVEL
        </span>
      </div>

      {/* XP Bar */}
      <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-accent-cyan)] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <div className="flex justify-between text-[0.65rem] font-mono text-[var(--color-text-muted)]">
        <span>{profile.xp.toLocaleString()} XP</span>
        <span>{nextLevelXP.toLocaleString()} XP</span>
      </div>
    </div>
  );
}
