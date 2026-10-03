"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Plus, Trash2, Pin } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorNote, Field, IconButton, Loading, Select, TextArea, Toggle, type BadgeTone } from "@/components/gui";

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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

const URGENCY: Record<Announcement["urgency"], { tone: BadgeTone; label: string }> = {
  info: { tone: "info", label: "Info" },
  warning: { tone: "warn", label: "Warning" },
  critical: { tone: "danger", label: "Critical" },
};

const posted = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

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
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchAnnouncements() {
    const supabase = createClient();
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    fetchAnnouncements();
  }, []);

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
    const { error: deleteError } = await supabase.from("announcements").delete().eq("id", id);
    if (deleteError) return setError("That announcement wasn’t deleted. Try again.");
    setError(null);
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

  return (
    <div className={PAGE}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Announcements</h1>
          <p className="mt-1 text-sm text-[var(--gui-muted)]">{announcements.length} posted</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
          <Plus size={16} aria-hidden />
          New announcement
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card as="section" className="mb-6" aria-label="New announcement">
          <form onSubmit={createAnnouncement} className="space-y-4">
            <Field
              label="Title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
            <TextArea
              label="Message"
              hint="Markdown works here."
              rows={4}
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
              required
            />
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-base font-bold text-[var(--gui-ink)]">
                Urgency
                <Select
                  className="w-full"
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
                </Select>
              </label>
              <Field
                label="Expires"
                hint="Optional"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) =>
                  setFormData({ ...formData, expires_at: e.target.value })
                }
              />
              <Toggle
                checked={formData.is_banner}
                onChange={(on) => setFormData({ ...formData, is_banner: on })}
              >
                Show as a banner
              </Toggle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit">
                Publish
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {/* Announcements List */}
      {loading ? (
        <Loading label="Getting the announcements…" />
      ) : announcements.length === 0 ? (
        <Empty icon={<Megaphone size={32} />} title="No announcements yet">
          Post one and members see it in the portal.
        </Empty>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id} as="article">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={URGENCY[ann.urgency]?.tone ?? "neutral"}>
                      {URGENCY[ann.urgency]?.label ?? ann.urgency}
                    </Badge>
                    {ann.is_banner && <Badge tone="sage">Banner</Badge>}
                    {ann.is_pinned && (
                      <Badge tone="gold">
                        <Pin size={12} aria-hidden /> Pinned
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                    {ann.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--gui-ink-2)]">
                    {ann.body}
                  </p>
                  <p className="mt-2 text-xs text-[var(--gui-muted)]">
                    Posted {posted(ann.created_at)}
                    {ann.expires_at && ` · Expires ${day(ann.expires_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    size="sm"
                    label={ann.is_pinned ? "Unpin" : "Pin"}
                    tone={ann.is_pinned ? "butter" : undefined}
                    onClick={() => togglePin(ann.id, ann.is_pinned)}
                  >
                    <Pin size={16} aria-hidden />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label="Delete"
                    onClick={() => setConfirmDelete(ann)}
                    style={{ color: "var(--gui-danger)" }}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title="Delete this announcement?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteAnnouncement(confirmDelete.id);
          setConfirmDelete(null);
        }}
      >
        “{confirmDelete?.title}” comes down for every member, for good.
      </ConfirmDialog>
    </div>
  );
}
