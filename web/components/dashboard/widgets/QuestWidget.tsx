"use client";

import Link from "next/link";
import { Target } from "lucide-react";

interface QuestProgress {
  id: string;
  status: string;
  progress: number;
  quest: {
    id: string;
    title: string;
    quest_type: string;
    xp_reward: number;
    tc_reward: number;
  };
}

export default function QuestWidget({ quests }: { quests: QuestProgress[] }) {
  const typeColors: Record<string, string> = {
    daily: "text-[var(--color-accent-cyan)]",
    weekly: "text-[var(--color-brand-blue)]",
    seasonal: "text-[var(--color-brand-yellow)]",
  };

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Active Quests
        </h3>
        <Link
          href="/student/dashboard/quests"
          className="text-xs font-mono text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors"
        >
          View All
        </Link>
      </div>

      {quests.length === 0 ? (
        <div className="text-center py-4">
          <Target
            size={24}
            className="mx-auto text-[var(--color-text-muted)]/30 mb-2"
          />
          <p className="text-xs font-mono text-[var(--color-text-muted)]">
            No active quests
          </p>
          <Link
            href="/student/dashboard/quests"
            className="text-xs font-mono text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors mt-1 inline-block"
          >
            Browse quests →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quests.map((qp) => (
            <div key={qp.id} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-blue)] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">
                  {qp.quest.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-[0.6rem] font-mono uppercase ${
                      typeColors[qp.quest.quest_type] ??
                      "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {qp.quest.quest_type}
                  </span>
                  <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                    +{qp.quest.xp_reward} XP · +{qp.quest.tc_reward} TC
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
