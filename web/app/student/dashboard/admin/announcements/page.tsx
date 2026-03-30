"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Pin } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  urgency: "info" | "warning" | "critical";
  is_banner: boolean;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    urgency: "info" as "info" | "warning" | "critical",
    is_banner: false,
    expires_at: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    const supabase = createClient();
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
    setLoading(false);
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("announcements").insert({
      ...formData,
      expires_at: formData.expires_at || null,
      created_by: user.id,
    });

    setShowForm(false);
    setFormData({
      title: "",
      body: "",
      urgency: "info",
      is_banner: false,
      expires_at: "",
    });
    fetchAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    const supabase = createClient();
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  async function togglePin(id: string, isPinned: boolean) {
    const supabase = createClient();
    await supabase
      .from("announcements")
      .update({ is_pinned: !isPinned })
      .eq("id", id);
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_pinned: !isPinned } : a))
    );
  }

  const urgencyColors: Record<string, string> = {
    info: "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10",
    warning:
      "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10",
    critical: "text-red-400 bg-red-400/10",
  };

  const inputClass =
    "w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-brand-blue)] transition-all";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Announcements
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {announcements.length} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm rounded-md transition-all"
        >
          <Plus size={16} />
          New Announcement
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={createAnnouncement}
          className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5 mb-6 space-y-3"
        >
          <input
            className={inputClass}
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="Title"
            required
          />
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={formData.body}
            onChange={(e) =>
              setFormData({ ...formData, body: e.target.value })
            }
            placeholder="Body (markdown supported)"
            required
          />
          <div className="flex items-center gap-4">
            <select
              className={inputClass + " w-auto"}
              value={formData.urgency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  urgency: e.target.value as "info" | "warning" | "critical",
                })
              }
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_banner}
                onChange={(e) =>
                  setFormData({ ...formData, is_banner: e.target.checked })
                }
                className="accent-[var(--color-brand-blue)]"
              />
              Show as banner
            </label>
            <input
              type="datetime-local"
              className={inputClass + " w-auto"}
              value={formData.expires_at}
              onChange={(e) =>
                setFormData({ ...formData, expires_at: e.target.value })
              }
              placeholder="Expires at (optional)"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm rounded-md transition-all"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-sm hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      {loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading...
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${urgencyColors[ann.urgency]}`}
                    >
                      {ann.urgency}
                    </span>
                    {ann.is_banner && (
                      <span className="text-[0.6rem] font-mono text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10 px-2 py-0.5 rounded uppercase">
                        Banner
                      </span>
                    )}
                    {ann.is_pinned && (
                      <span className="text-[0.6rem] font-mono text-[var(--color-brand-yellow)]">
                        📌 Pinned
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                    {ann.body}
                  </p>
                  <p className="text-[0.55rem] font-mono text-[var(--color-text-muted)]/50 mt-2">
                    {new Date(ann.created_at).toLocaleString()}
                    {ann.expires_at &&
                      ` · Expires: ${new Date(ann.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => togglePin(ann.id, ann.is_pinned)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-brand-yellow)] transition-colors"
                    title={ann.is_pinned ? "Unpin" : "Pin"}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(ann.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
