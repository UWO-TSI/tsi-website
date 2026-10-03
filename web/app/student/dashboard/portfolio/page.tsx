"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { settle } from "@/lib/portal/load";
import { loadPortfolio } from "@/lib/portal/portfolio";
import {
  Eye,
  EyeOff,
  Plus,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Trash2,
  FolderOpen,
  X,
} from "lucide-react";
import { Badge, Banner, Button, Card, ConfirmDialog, Empty, ErrorNote, Field, IconButton, Loading, TextArea, Toggle, type BadgeTone } from "@/components/gui";

interface Portfolio {
  id: string;
  user_id: string;
  slug: string;
  bio: string | null;
  is_public: boolean;
  accent_color: string;
  created_at: string;
  updated_at: string;
}

interface PortfolioItem {
  id: string;
  portfolio_id: string;
  type: "bounty" | "project" | "personal" | "case_study";
  title: string;
  description: string | null;
  link: string | null;
  tech_stack: string[] | null;
  image_url: string | null;
  is_visible: boolean;
  position: number;
}

const ACCENT_COLORS = [
  { name: "Sage", value: "var(--color-brand-blue)" },
  { name: "Teal", value: "var(--color-accent-cyan)" },
  { name: "Honey", value: "var(--color-brand-yellow)" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Emerald", value: "#10B981" },
];

const TYPE_LOOK: Record<PortfolioItem["type"], { label: string; tone: BadgeTone }> = {
  bounty: { label: "Bounty", tone: "gold" },
  project: { label: "Project", tone: "sage" },
  personal: { label: "Personal", tone: "info" },
  case_study: { label: "Case study", tone: "neutral" },
};

const cardTitle: CSSProperties = { fontSize: 16, fontWeight: 800, color: "var(--gui-ink-strong)" };

function AddItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<PortfolioItem, "id" | "portfolio_id" | "position">) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<PortfolioItem["type"]>("project");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [techStack, setTechStack] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      tech_stack: techStack.trim() ? techStack.split(",").map((s) => s.trim()) : null,
      image_url: imageUrl.trim() || null,
      is_visible: true,
    });
  }

  return (
    <Card as="article" tone="warm" style={{ padding: 18 }}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 style={cardTitle}>New item</h3>
          <IconButton label="Close the form" size="sm" onClick={onCancel}>
            <X size={18} aria-hidden />
          </IconButton>
        </div>

        <div>
          <p className="mb-2" style={{ fontSize: 16, fontWeight: 700, color: "var(--gui-ink)" }}>Type</p>
          <div className="flex flex-wrap gap-2">
            {(["bounty", "project", "personal", "case_study"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className="rounded-full transition-colors"
                style={{ minHeight: 38, padding: "0 16px", fontSize: 14, fontWeight: 800, background: type === t ? "var(--gui-butter)" : "var(--gui-paper-deep)", color: type === t ? "var(--gui-ink-strong)" : "var(--gui-ink-2)", boxShadow: type === t ? "var(--gui-shadow-sm)" : "none" }}
              >
                {TYPE_LOOK[t].label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Project title" />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="A short description…" style={{ minHeight: 96 }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          <Field label="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
        <Field label="Tech stack" hint="Separate them with commas." value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="React, TypeScript, Supabase" />

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="quiet" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="submit">Add item</Button>
        </div>
      </form>
    </Card>
  );
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [noPortfolio, setNoPortfolio] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bio, setBio] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PortfolioItem | null>(null);

  const load = useCallback(async () => {
    const r = await loadPortfolio(createClient());
    if (!r) return null;
    setUserId(r.userId);
    setDisplayName(r.displayName);
    setPortfolio(r.portfolio as Portfolio | null);
    setBio(r.portfolio?.bio ?? "");
    setItems(r.items as PortfolioItem[]);
    setNoPortfolio(!r.portfolio);
    return r;
  }, []);

  useEffect(() => {
    void settle(load).then(setState);
  }, [load]);

  /** A write's result: true when it saved, else the failure is shown and nothing on screen changes. */
  const saved = (r: { error: unknown }) => {
    setSaveError(r.error ? "That didn’t save. Try again." : null);
    return !r.error;
  };

  async function createPortfolio() {
    const supabase = createClient();
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const r = await supabase
      .from("portfolios")
      .insert({
        user_id: userId,
        slug,
        bio: null,
        is_public: false,
        accent_color: "var(--color-brand-blue)",
      })
      .select()
      .single();

    if (saved(r) && r.data) {
      setPortfolio(r.data as Portfolio);
      setNoPortfolio(false);
    }
  }

  async function togglePublic() {
    if (!portfolio) return;
    const newVal = !portfolio.is_public;
    if (saved(await createClient().from("portfolios").update({ is_public: newVal }).eq("id", portfolio.id))) setPortfolio({ ...portfolio, is_public: newVal });
  }

  async function saveBio() {
    if (!portfolio) return;
    setSaving(true);
    if (saved(await createClient().from("portfolios").update({ bio }).eq("id", portfolio.id))) setPortfolio({ ...portfolio, bio });
    setSaving(false);
  }

  async function setAccentColor(color: string) {
    if (!portfolio) return;
    if (saved(await createClient().from("portfolios").update({ accent_color: color }).eq("id", portfolio.id))) setPortfolio({ ...portfolio, accent_color: color });
  }

  async function addItem(item: Omit<PortfolioItem, "id" | "portfolio_id" | "position">) {
    if (!portfolio) return;
    const r = await createClient()
      .from("portfolio_items")
      .insert({
        portfolio_id: portfolio.id,
        ...item,
        position: items.length,
      })
      .select()
      .single();

    if (saved(r) && r.data) {
      setItems([...items, r.data as PortfolioItem]);
      setShowAddForm(false);
    }
  }

  async function toggleItemVisibility(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newVal = !item.is_visible;
    if (saved(await createClient().from("portfolio_items").update({ is_visible: newVal }).eq("id", itemId))) {
      setItems(items.map((i) => (i.id === itemId ? { ...i, is_visible: newVal } : i)));
    }
  }

  async function deleteItem(itemId: string) {
    if (saved(await createClient().from("portfolio_items").delete().eq("id", itemId))) setItems(items.filter((i) => i.id !== itemId));
  }

  async function moveItem(itemId: string, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === items.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newItems = [...items];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];

    // Update positions
    const before = items;
    const updated = newItems.map((item, i) => ({ ...item, position: i }));
    setItems(updated);

    const supabase = createClient();
    const results = await Promise.all(
      updated.map((item) =>
        supabase.from("portfolio_items").update({ position: item.position }).eq("id", item.id)
      )
    );
    if (!saved(results.find((r) => r.error) ?? { error: null })) setItems(before);
  }

  if (state !== "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <div className="max-w-2xl mx-auto">
          {state === "loading" ? <Loading label="Opening your portfolio…" />
            : state === "signed-out" ? <Empty icon={<FolderOpen size={32} />} title="Sign in to build your portfolio">Your portfolio shows up here once you’re signed in.</Empty>
            : <ErrorNote onRetry={() => { setState("loading"); void settle(load).then(setState); }}>Your portfolio didn’t load.</ErrorNote>}
        </div>
      </div>
    );
  }

  if (noPortfolio) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <div className="max-w-2xl mx-auto">
          <Banner title="Portfolio" icon={<FolderOpen size={26} />} tone="sage">Show your work to the world.</Banner>
          {saveError && <ErrorNote className="mb-4">{saveError}</ErrorNote>}
          <Card>
            <Empty
              icon={<FolderOpen size={32} />}
              title="No portfolio yet"
              action={<Button size="sm" onClick={createPortfolio}>Create your portfolio</Button>}
            >
              Show off your bounties, projects and case studies, then share it with recruiters and collaborators.
            </Empty>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Banner title="Portfolio builder" icon={<FolderOpen size={26} />} tone="sage">
          {items.length} item{items.length !== 1 ? "s" : ""} in your portfolio.
        </Banner>

        {saveError && <ErrorNote className="sticky top-4 z-10 shadow-[var(--gui-shadow-md)]">{saveError}</ErrorNote>}

        {/* Sharing */}
        <Card style={{ padding: 20 }}>
          <Toggle
            checked={!!portfolio?.is_public}
            onChange={() => togglePublic()}
            hint={portfolio?.is_public ? "Anyone with your link can see it." : "Only you can see it for now."}
          >
            Public portfolio
          </Toggle>
          <p className="text-sm mt-2" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
            Your link:{" "}
            <span style={{ color: "var(--gui-teal-ink)", fontWeight: 800, overflowWrap: "anywhere" }}>/portfolio/{portfolio?.slug}</span>
          </p>
        </Card>

        {/* Bio */}
        <Card className="space-y-3" style={{ padding: 20 }}>
          <TextArea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Write a short bio for your portfolio…"
            style={{ minHeight: 112 }}
          />
          <Button size="sm" onClick={saveBio} disabled={saving}>
            {saving ? "Saving…" : "Save bio"}
          </Button>
        </Card>

        {/* Accent colour */}
        <Card style={{ padding: 20 }}>
          <h2 className="mb-3" style={cardTitle}>Accent colour</h2>
          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_COLORS.map((color) => {
              const chosen = portfolio?.accent_color === color.value;
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setAccentColor(color.value)}
                  aria-label={color.name}
                  aria-pressed={chosen}
                  title={color.name}
                  className="rounded-full transition-transform hover:scale-105"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: color.value,
                    boxShadow: chosen ? "0 0 0 3px var(--gui-paper-hi), 0 0 0 6px var(--gui-ink-strong)" : "inset 0 0 0 2px rgb(58 46 34 / 0.12)",
                  }}
                />
              );
            })}
          </div>
        </Card>

        {/* Items */}
        <Card style={{ padding: 20 }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 style={cardTitle}>Items</h2>
            <Button size="sm" variant="quiet" onClick={() => setShowAddForm(true)}>
              <Plus size={16} aria-hidden />
              Add item
            </Button>
          </div>

          <div className="space-y-3">
            {showAddForm && (
              <AddItemForm onAdd={addItem} onCancel={() => setShowAddForm(false)} />
            )}

            {items.length === 0 && !showAddForm ? (
              <Empty icon={<FolderOpen size={32} />} title="No items yet">
                Add your first portfolio piece: a bounty, a project or a case study.
              </Empty>
            ) : (
              items.map((item, idx) => (
                <Card key={item.id} as="article" tone={item.is_visible ? "paper" : "warm"} style={{ padding: "14px 16px" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1" style={{ minWidth: 200 }}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge tone={TYPE_LOOK[item.type].tone}>{TYPE_LOOK[item.type].label}</Badge>
                        {!item.is_visible && <Badge><EyeOff size={12} aria-hidden /> Hidden</Badge>}
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)", overflowWrap: "anywhere" }}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-sm line-clamp-2 mt-1" style={{ color: "var(--gui-ink-2)" }}>
                          {item.description}
                        </p>
                      )}
                      {item.tech_stack && item.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.tech_stack.map((tech) => (
                            <Badge key={tech}>{tech}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <IconButton label="Move up" size="sm" onClick={() => moveItem(item.id, "up")} disabled={idx === 0}>
                        <ChevronUp size={18} aria-hidden />
                      </IconButton>
                      <IconButton label="Move down" size="sm" onClick={() => moveItem(item.id, "down")} disabled={idx === items.length - 1}>
                        <ChevronDown size={18} aria-hidden />
                      </IconButton>
                      <IconButton label={item.is_visible ? "Hide this item" : "Show this item"} size="sm" onClick={() => toggleItemVisibility(item.id)}>
                        {item.is_visible ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
                      </IconButton>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open the link"
                          title="Open the link"
                          className="inline-grid place-items-center rounded-full transition-transform hover:-translate-y-0.5"
                          style={{ width: 38, height: 38, background: "var(--gui-paper-hi)", color: "var(--gui-ink)", boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)" }}
                        >
                          <ExternalLink size={18} aria-hidden />
                        </a>
                      )}
                      <IconButton label="Delete this item" size="sm" onClick={() => setConfirmDelete(item)}>
                        <Trash2 size={18} aria-hidden style={{ color: "var(--gui-danger)" }} />
                      </IconButton>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title="Delete this item?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteItem(confirmDelete.id);
          setConfirmDelete(null);
        }}
      >
        “{confirmDelete?.title}” comes off your portfolio for good.
      </ConfirmDialog>
    </div>
  );
}
