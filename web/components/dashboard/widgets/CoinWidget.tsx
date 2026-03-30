"use client";

import type { Profile } from "@/lib/supabase/types";

export default function CoinWidget({ profile }: { profile: Profile }) {
  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Tethos Coins
        </h3>
        <span className="text-lg text-[var(--color-brand-yellow)]">₮</span>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-mono font-bold text-[var(--color-brand-yellow)]">
          {profile.tethos_coins.toLocaleString()}
        </span>
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          TC
        </span>
      </div>

      <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
        ≈ ${(profile.tethos_coins / 100).toFixed(2)} CAD value
      </p>
    </div>
  );
}
