"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { must, settle } from "@/lib/portal/load";
import {
  Sword,
  Clock,
  CalendarDays,
  Flame,
  Star,
  Check,
  Zap,
} from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, Empty, ErrorNote, Loading, Tabs } from "@/components/gui";

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

const tabLabels: Record<(typeof questTabs)[number], string> = {
  daily: "Daily",
  weekly: "Weekly",
  seasonal: "Seasonal",
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [tab, setTab] = useState<(typeof questTabs)[number]>("daily");
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    setUserId(user.id);

    const [questsData, progressData] = await Promise.all([
      supabase.from("quests").select("*").eq("is_active", true).order("quest_type"),
      supabase
        .from("quest_progress")
        .select("id, quest_id, status, progress, accepted_at, completed_at")
        .eq("user_id", user.id),
    ]);

    setQuests((must(questsData) as Quest[]) ?? []);
    setProgress((must(progressData) as QuestProgress[]) ?? []);
    return true;
  }, []);

  useEffect(() => {
    void settle(fetchData).then(setState);
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

  if (state !== "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {state === "loading" ? <Loading label="Pinning up the quests…" />
            : state === "signed-out" ? <Empty icon={<Sword size={32} />} title="Sign in to see the quests">The quest board opens once you’re signed in.</Empty>
            : <ErrorNote onRetry={() => { setState("loading"); void settle(fetchData).then(setState); }}>The quest board didn’t load.</ErrorNote>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Banner title="Quest board" icon={<Sword size={26} />} tone="butter">
          Finish quests to earn XP and Gems.
        </Banner>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Tabs
            label="Quest type"
            value={tab}
            onChange={setTab}
            tabs={questTabs.map((t) => {
              const Icon = tabIcons[t];
              return { id: t, label: tabLabels[t], icon: <Icon size={16} aria-hidden /> };
            })}
          />
          <div className="flex items-center gap-2">
            <Badge tone="info"><Zap size={14} aria-hidden /> {activeCount} active</Badge>
            <Badge tone="success"><Check size={14} aria-hidden /> {completedCount} done</Badge>
          </div>
        </div>

        {/* Quest Cards */}
        <div className="space-y-3">
          {filteredQuests.map((quest) => {
            const status = getQuestStatus(quest.id);
            const isCompleted = status?.status === "completed";
            const isAccepted = status?.status === "accepted";

            return (
              <Card
                key={quest.id}
                as="article"
                tone={isCompleted ? "warm" : isAccepted ? "butter" : "paper"}
                style={{ padding: "16px 18px" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1" style={{ minWidth: 200 }}>
                    <div className="flex flex-wrap items-center gap-2">
                      {isCompleted && (
                        <Check size={18} aria-hidden className="shrink-0" style={{ color: "var(--gui-success)" }} />
                      )}
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: isCompleted ? "var(--gui-muted)" : "var(--gui-ink-strong)",
                          textDecoration: isCompleted ? "line-through" : "none",
                        }}
                      >
                        {quest.title}
                      </h3>
                      {isAccepted && <Badge tone="info">In progress</Badge>}
                    </div>

                    {quest.description && (
                      <p className="text-sm mt-1" style={{ color: isCompleted ? "var(--gui-muted)" : "var(--gui-ink-2)" }}>
                        {quest.description}
                      </p>
                    )}

                    {/* Rewards */}
                    {(quest.xp_reward > 0 || quest.tc_reward > 0) && (
                      <div className="flex flex-wrap items-center gap-3 mt-2.5 text-sm" style={{ color: "var(--gui-ink)", fontWeight: 800 }}>
                        {quest.xp_reward > 0 && (
                          <span className="flex items-center gap-1">
                            <Star size={14} aria-hidden style={{ color: "var(--gui-wood)" }} />
                            {quest.xp_reward} XP
                          </span>
                        )}
                        {quest.tc_reward > 0 && <Amount n={quest.tc_reward} currency="gems" size={16} />}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {isCompleted ? (
                      <Badge tone="success">Completed</Badge>
                    ) : isAccepted ? (
                      <Button size="sm" onClick={() => completeQuest(quest.id)}>
                        <Check size={16} aria-hidden />
                        Mark complete
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => acceptQuest(quest.id)}>
                        Accept quest
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredQuests.length === 0 && (
            <Empty icon={<Sword size={32} />} title={`No ${tab} quests right now`}>
              New ones go up regularly. Check back soon.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
