"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Edit3 } from "lucide-react";

interface Quest {
  id: string;
  title: string;
  description: string;
  quest_type: "daily" | "weekly" | "seasonal";
  xp_reward: number;
  tc_reward: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    quest_type: "daily" as "daily" | "weekly" | "seasonal",
    xp_reward: 50,
    tc_reward: 10,
    start_date: "",
    end_date: "",
  });

  async function fetchQuests() {
    const supabase = createClient();
    const { data } = await supabase
      .from("quests")
      .select("*")
      .order("created_at", { ascending: false });
    setQuests((data as Quest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchQuests();
  }, []);

  async function createQuest(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("quests").insert({
      ...formData,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      created_by: user.id,
      is_active: true,
    });

    setShowForm(false);
    setFormData({
      title: "",
      description: "",
      quest_type: "daily",
      xp_reward: 50,
      tc_reward: 10,
      start_date: "",
      end_date: "",
    });
    fetchQuests();
  }

  async function toggleActive(id: string, isActive: boolean) {
    const supabase = createClient();
    await supabase
      .from("quests")
      .update({ is_active: !isActive })
      .eq("id", id);
    setQuests((prev) =>
      prev.map((q) => (q.id === id ? { ...q, is_active: !isActive } : q))
    );
  }

  async function deleteQuest(id: string) {
    const supabase = createClient();
    await supabase.from("quests").delete().eq("id", id);
    setQuests((prev) => prev.filter((q) => q.id !== id));
  }

  const typeColors: Record<string, string> = {
    daily: "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10",
    weekly: "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10",
    seasonal:
      "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10",
  };

  const inputClass =
    "w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] transition-all";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Quest Management
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {quests.filter((q) => q.is_active).length} active quests
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm rounded-md transition-all"
        >
          <Plus size={16} />
          New Quest
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createQuest}
          className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5 mb-6 space-y-3"
        >
          <input
            className={inputClass}
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="Quest title"
            required
          />
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Description"
            required
          />
          <div className="flex items-center gap-3">
            <select
              className={inputClass + " w-auto"}
              value={formData.quest_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quest_type: e.target.value as "daily" | "weekly" | "seasonal",
                })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="seasonal">Seasonal</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                XP:
              </span>
              <input
                type="number"
                className={inputClass + " w-20"}
                value={formData.xp_reward}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    xp_reward: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                ₮:
              </span>
              <input
                type="number"
                className={inputClass + " w-20"}
                value={formData.tc_reward}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tc_reward: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-brand-blue)] text-white font-mono text-sm rounded-md transition-all"
            >
              Create Quest
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading...
        </p>
      ) : (
        <div className="space-y-2">
          {quests.map((quest) => (
            <div
              key={quest.id}
              className={`bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 flex items-center justify-between ${
                !quest.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${typeColors[quest.quest_type]}`}
                  >
                    {quest.quest_type}
                  </span>
                  {!quest.is_active && (
                    <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] bg-white/[0.05] px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {quest.title}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {quest.description}
                </p>
                <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)] mt-1">
                  +{quest.xp_reward} XP · +{quest.tc_reward} ₮
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => toggleActive(quest.id, quest.is_active)}
                  className="px-3 py-1.5 text-[0.65rem] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border)] rounded transition-colors"
                >
                  {quest.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => deleteQuest(quest.id)}
                  className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
