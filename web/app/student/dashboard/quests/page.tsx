"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sword,
  Clock,
  CalendarDays,
  Flame,
  Star,
  Check,
  Coins,
  Zap,
} from "lucide-react";

interface Quest {
  id: string;
  title: string;
  description: string | null;
  quest_type: "daily" | "weekly" | "seasonal";
  xp_reward: number;
  tc_reward: number;
  is_active: boolean;
}

interface QuestProgress {
  id: string;
  quest_id: string;
  status: "accepted" | "completed";
  progress: number;
  accepted_at: string;
  completed_at: string | null;
}

const questTabs = ["daily", "weekly", "seasonal"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabIcons: Record<string, any> = {
  daily: Clock,
  weekly: CalendarDays,
  seasonal: Flame,
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof questTabs)[number]>("daily");
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: questsData }, { data: progressData }] = await Promise.all([
      supabase.from("quests").select("*").eq("is_active", true).order("quest_type"),
      supabase
        .from("quest_progress")
        .select("id, quest_id, status, progress, accepted_at, completed_at")
        .eq("user_id", user.id),
    ]);

    setQuests((questsData as Quest[]) ?? []);
    setProgress((progressData as QuestProgress[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    fetchData();
  }, [fetchData]);

  const getQuestStatus = (questId: string) => {
    return progress.find((p) => p.quest_id === questId);
  };

  const acceptQuest = async (questId: string) => {
    if (!userId) return;
    const supabase = createClient();

    const { data } = await supabase
      .from("quest_progress")
      .insert({ quest_id: questId, user_id: userId, status: "accepted", progress: 0 })
      .select()
      .single();

    if (data) {
      setProgress((prev) => [...prev, data as QuestProgress]);
    }
  };

  const completeQuest = async (questId: string) => {
    if (!userId) return;
    const supabase = createClient();
    const prog = getQuestStatus(questId);
    if (!prog) return;

    const { data } = await supabase
      .from("quest_progress")
      .update({ status: "completed", progress: 100, completed_at: new Date().toISOString() })
      .eq("id", prog.id)
      .select()
      .single();

    if (data) {
      setProgress((prev) =>
        prev.map((p) => (p.id === prog.id ? (data as QuestProgress) : p))
      );
    }
  };

  const filteredQuests = quests.filter((q) => q.quest_type === tab);
  const activeCount = progress.filter((p) => p.status === "accepted").length;
  const completedCount = progress.filter((p) => p.status === "completed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading quests...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Sword size={24} className="text-[var(--color-brand-blue)]" />
            Quest Board
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            Complete quests to earn XP and Tethos Coins
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm font-mono">
            <Zap size={14} className="text-[var(--color-brand-blue)]" />
            <span className="text-[var(--color-text-muted)]">Active:</span>
            <span className="text-[var(--color-brand-blue)] font-bold">{activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-mono">
            <Check size={14} className="text-green-400" />
            <span className="text-[var(--color-text-muted)]">Done:</span>
            <span className="text-green-400 font-bold">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1 mb-6 w-fit">
        {questTabs.map((t) => {
          const Icon = tabIcons[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono transition-all capitalize ${
                tab === t
                  ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon size={14} />
              {t}
            </button>
          );
        })}
      </div>

      {/* Quest Cards */}
      <div className="space-y-3">
        {filteredQuests.map((quest) => {
          const status = getQuestStatus(quest.id);
          const isCompleted = status?.status === "completed";
          const isAccepted = status?.status === "accepted";

          return (
            <div
              key={quest.id}
              className={`bg-[var(--color-bg-alt)] border rounded-lg p-4 transition-all ${
                isCompleted
                  ? "border-[var(--glass-border)] opacity-60"
                  : isAccepted
                  ? "border-[var(--color-brand-blue)]/30 shadow-[0_0_16px_rgba(0,47,167,0.12)]"
                  : "border-[var(--glass-border)] hover:border-[var(--color-brand-blue)]/20"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <Check size={16} className="text-green-400 shrink-0" />
                    )}
                    <h3
                      className={`text-sm font-heading font-bold ${
                        isCompleted
                          ? "text-[var(--color-text-muted)] line-through"
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {quest.title}
                    </h3>
                    {isAccepted && (
                      <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {quest.description && (
                    <p
                      className={`text-xs mt-1 ${
                        isCompleted
                          ? "text-[var(--color-text-muted)]"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {quest.description}
                    </p>
                  )}

                  {/* Rewards */}
                  <div className="flex items-center gap-3 mt-2.5">
                    {quest.xp_reward > 0 && (
                      <span className="flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-brand-blue)]">
                        <Star size={12} />
                        {quest.xp_reward} XP
                      </span>
                    )}
                    {quest.tc_reward > 0 && (
                      <span className="flex items-center gap-1 text-[0.65rem] font-mono text-[var(--color-brand-yellow)]">
                        <Coins size={12} />
                        {quest.tc_reward} &#x20AE;
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0">
                  {isCompleted ? (
                    <span className="text-[0.65rem] font-mono text-green-400 px-3 py-1.5 rounded border border-green-500/20 bg-green-500/5">
                      Completed
                    </span>
                  ) : isAccepted ? (
                    <button
                      onClick={() => completeQuest(quest.id)}
                      className="text-xs font-mono px-3 py-1.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                    >
                      Complete
                    </button>
                  ) : (
                    <button
                      onClick={() => acceptQuest(quest.id)}
                      className="text-xs font-mono px-3 py-1.5 rounded bg-[var(--color-brand-blue)] text-white hover:bg-[var(--color-brand-blue)]/80 transition-colors"
                    >
                      Accept Quest
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredQuests.length === 0 && (
          <div className="text-center py-12">
            <Sword size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="font-mono text-sm text-[var(--color-text-muted)]">
              No {tab} quests available right now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
