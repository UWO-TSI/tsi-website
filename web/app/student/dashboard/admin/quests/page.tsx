"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Target, Trash2 } from "lucide-react";
import { Amount } from "@/components/economy/Amount";
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorNote, Field, IconButton, Loading, Select, TextArea, type BadgeTone } from "@/components/gui";

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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

const TYPES: Record<string, { tone: BadgeTone; label: string }> = {
  daily: { tone: "info", label: "Daily" },
  weekly: { tone: "sage", label: "Weekly" },
  seasonal: { tone: "gold", label: "Seasonal" },
};

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Quest | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
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
    const { error: deleteError } = await supabase.from("quests").delete().eq("id", id);
    if (deleteError) return setError("That quest wasn’t deleted. Try again.");
    setError(null);
    setQuests((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className={PAGE}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Quests</h1>
          <p className="mt-1 text-sm text-[var(--gui-muted)]">
            {quests.filter((q) => q.is_active).length} active
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
          <Plus size={16} aria-hidden />
          New quest
        </Button>
      </div>

      {showForm && (
        <Card as="section" className="mb-6" aria-label="New quest">
          <form onSubmit={createQuest} className="space-y-4">
            <Field
              label="Quest title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
            <TextArea
              label="Description"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-base font-bold text-[var(--gui-ink)]">
                Repeats
                <Select
                  className="w-full"
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
                </Select>
              </label>
              <Field
                label="XP"
                type="number"
                value={formData.xp_reward}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    xp_reward: parseInt(e.target.value) || 0,
                  })
                }
              />
              <Field
                label="Gems"
                type="number"
                value={formData.tc_reward}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tc_reward: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit">
                Create quest
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {loading ? (
        <Loading label="Getting the quests…" />
      ) : quests.length === 0 ? (
        <Empty icon={<Target size={32} />} title="No quests yet">
          Make one and it shows up on members’ quest list.
        </Empty>
      ) : (
        <div className="space-y-2">
          {quests.map((quest) => (
            <Card
              key={quest.id}
              as="article"
              tone={quest.is_active ? "paper" : "warm"}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={TYPES[quest.quest_type]?.tone ?? "neutral"}>
                    {TYPES[quest.quest_type]?.label ?? quest.quest_type}
                  </Badge>
                  {!quest.is_active && <Badge>Off</Badge>}
                </div>
                <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                  {quest.title}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--gui-ink-2)]">
                  {quest.description}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--gui-ink)]">
                  +{quest.xp_reward} XP · +<Amount n={quest.tc_reward} currency="gems" />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => toggleActive(quest.id, quest.is_active)}
                >
                  {quest.is_active ? "Turn off" : "Turn on"}
                </Button>
                <IconButton
                  size="sm"
                  label={`Delete ${quest.title}`}
                  onClick={() => setConfirmDelete(quest)}
                  style={{ color: "var(--gui-danger)" }}
                >
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title="Delete this quest?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteQuest(confirmDelete.id);
          setConfirmDelete(null);
        }}
      >
        “{confirmDelete?.title}” and everyone’s progress on it go for good. To pause it instead, turn it off.
      </ConfirmDialog>
    </div>
  );
}
