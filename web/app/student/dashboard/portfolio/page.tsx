"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Eye,
  EyeOff,
  Plus,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Trash2,
  Palette,
  Globe,
  Lock,
  X,
} from "lucide-react";

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
  sort_order: number;
}

const ACCENT_COLORS = [
  { name: "Brand Blue", value: "var(--color-brand-blue)" },
  { name: "Accent Cyan", value: "var(--color-accent-cyan)" },
  { name: "Brand Yellow", value: "var(--color-brand-yellow)" },
  { name: "#8B5CF6", value: "#8B5CF6" },
  { name: "#F43F5E", value: "#F43F5E" },
  { name: "#10B981", value: "#10B981" },
];

const TYPE_COLORS: Record<string, string> = {
  bounty: "var(--color-brand-yellow)",
  project: "var(--color-brand-blue)",
  personal: "var(--color-accent-cyan)",
  case_study: "#8B5CF6",
};

function AddItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<PortfolioItem, "id" | "portfolio_id" | "sort_order">) => void;
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
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-bg-main)] border border-[var(--color-brand-blue)]/30 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
          New Item
        </h3>
        <button type="button" onClick={onCancel} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <X size={16} />
        </button>
      </div>

      <div>
        <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Type
        </label>
        <div className="flex gap-2 mt-1">
          {(["bounty", "project", "personal", "case_study"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                type === t
                  ? "border-[var(--color-brand-blue)] text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10"
                  : "border-[var(--glass-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Title *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)]"
          placeholder="Project title"
        />
      </div>

      <div>
        <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] resize-none"
          placeholder="Brief description..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            Link
          </label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="mt-1 w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)]"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            Image URL
          </label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1 w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)]"
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Tech Stack (comma-separated)
        </label>
        <input
          value={techStack}
          onChange={(e) => setTechStack(e.target.value)}
          className="mt-1 w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)]"
          placeholder="React, TypeScript, Supabase"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-[var(--color-brand-blue)] text-white text-sm font-mono font-bold hover:brightness-110 transition-all"
        >
          Add Item
        </button>
      </div>
    </form>
  );
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noPortfolio, setNoPortfolio] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bio, setBio] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      if (prof) setDisplayName(prof.display_name);

      const { data: port } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (port) {
        setPortfolio(port as Portfolio);
        setBio(port.bio ?? "");

        const { data: portItems } = await supabase
          .from("portfolio_items")
          .select("*")
          .eq("portfolio_id", port.id)
          .order("sort_order", { ascending: true });

        setItems((portItems as PortfolioItem[]) ?? []);
      } else {
        setNoPortfolio(true);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function createPortfolio() {
    const supabase = createClient();
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data } = await supabase
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

    if (data) {
      setPortfolio(data as Portfolio);
      setNoPortfolio(false);
    }
  }

  async function togglePublic() {
    if (!portfolio) return;
    const supabase = createClient();
    const newVal = !portfolio.is_public;
    await supabase.from("portfolios").update({ is_public: newVal }).eq("id", portfolio.id);
    setPortfolio({ ...portfolio, is_public: newVal });
  }

  async function saveBio() {
    if (!portfolio) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("portfolios").update({ bio }).eq("id", portfolio.id);
    setPortfolio({ ...portfolio, bio });
    setSaving(false);
  }

  async function setAccentColor(color: string) {
    if (!portfolio) return;
    const supabase = createClient();
    await supabase.from("portfolios").update({ accent_color: color }).eq("id", portfolio.id);
    setPortfolio({ ...portfolio, accent_color: color });
  }

  async function addItem(item: Omit<PortfolioItem, "id" | "portfolio_id" | "sort_order">) {
    if (!portfolio) return;
    const supabase = createClient();
    const sortOrder = items.length;

    const { data } = await supabase
      .from("portfolio_items")
      .insert({
        portfolio_id: portfolio.id,
        ...item,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (data) {
      setItems([...items, data as PortfolioItem]);
      setShowAddForm(false);
    }
  }

  async function toggleItemVisibility(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const supabase = createClient();
    const newVal = !item.is_visible;
    await supabase.from("portfolio_items").update({ is_visible: newVal }).eq("id", itemId);
    setItems(items.map((i) => (i.id === itemId ? { ...i, is_visible: newVal } : i)));
  }

  async function deleteItem(itemId: string) {
    const supabase = createClient();
    await supabase.from("portfolio_items").delete().eq("id", itemId);
    setItems(items.filter((i) => i.id !== itemId));
  }

  async function moveItem(itemId: string, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === items.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newItems = [...items];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];

    // Update sort orders
    const updated = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setItems(updated);

    const supabase = createClient();
    await Promise.all(
      updated.map((item) =>
        supabase.from("portfolio_items").update({ sort_order: item.sort_order }).eq("id", item.id)
      )
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading portfolio...
        </p>
      </div>
    );
  }

  if (noPortfolio) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
              Portfolio Builder
            </h1>
            <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
              Showcase your work to the world
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-8 text-center">
          <Globe size={40} className="text-[var(--color-text-muted)] mx-auto mb-4" />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            No portfolio yet
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] font-mono mb-6 max-w-md mx-auto">
            Create your portfolio to showcase bounties, projects, and case studies. Share it with
            recruiters and collaborators.
          </p>
          <button
            onClick={createPortfolio}
            className="px-6 py-3 rounded-lg bg-[var(--color-brand-blue)] text-white font-mono text-sm font-bold hover:brightness-110 transition-all"
          >
            Create Portfolio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Portfolio Builder
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""} in your portfolio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            /portfolio/{portfolio?.slug}
          </span>
          <button
            onClick={togglePublic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-all ${
              portfolio?.is_public
                ? "border-[var(--color-brand-blue)]/30 text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10"
                : "border-[var(--glass-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {portfolio?.is_public ? <Globe size={12} /> : <Lock size={12} />}
            {portfolio?.is_public ? "Public" : "Private"}
          </button>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)]">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            // Bio
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] resize-none"
            placeholder="Write a short bio for your portfolio..."
          />
          <button
            onClick={saveBio}
            disabled={saving}
            className="px-4 py-1.5 rounded-md bg-[var(--color-brand-blue)] text-white text-xs font-mono font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Bio"}
          </button>
        </div>
      </div>

      {/* Accent Color */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)]">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Palette size={14} />
            Accent Color
          </h2>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  portfolio?.accent_color === color.value
                    ? "border-white scale-110"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Items */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            // Items
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--color-brand-blue)]/30 text-[var(--color-brand-blue)] text-xs font-mono hover:bg-[var(--color-brand-blue)]/10 transition-all"
          >
            <Plus size={12} />
            Add Item
          </button>
        </div>

        <div className="p-4 space-y-3">
          {showAddForm && (
            <AddItemForm onAdd={addItem} onCancel={() => setShowAddForm(false)} />
          )}

          {items.length === 0 && !showAddForm ? (
            <p className="text-sm text-[var(--color-text-muted)] italic font-mono text-center py-6">
              No items yet. Add your first portfolio piece.
            </p>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className={`bg-[var(--color-bg-main)] border rounded-lg p-4 transition-all ${
                  item.is_visible
                    ? "border-[var(--glass-border)]"
                    : "border-[var(--glass-border)] opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[0.6rem] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          color: TYPE_COLORS[item.type],
                          backgroundColor: `${TYPE_COLORS[item.type]}15`,
                        }}
                      >
                        {item.type.replace("_", " ")}
                      </span>
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                        {item.title}
                      </h3>
                    </div>
                    {item.description && (
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}
                    {item.tech_stack && item.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tech_stack.map((tech) => (
                          <span
                            key={tech}
                            className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-alt)] text-[var(--color-text-muted)] border border-[var(--glass-border)]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveItem(item.id, "up")}
                      disabled={idx === 0}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveItem(item.id, "down")}
                      disabled={idx === items.length - 1}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => toggleItemVisibility(item.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                      title={item.is_visible ? "Hide" : "Show"}
                    >
                      {item.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-blue)] transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview Link */}
      {portfolio && (
        <div className="text-center">
          <p className="text-xs font-mono text-[var(--color-text-muted)]">
            Portfolio URL:{" "}
            <span className="text-[var(--color-accent-cyan)]">
              /portfolio/{portfolio.slug}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
