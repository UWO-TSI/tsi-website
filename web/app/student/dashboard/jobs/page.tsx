"use client";

import { useEffect, useState, useMemo } from "react";
import { Briefcase, Search, SearchX, ExternalLink, Bookmark, Plus, X } from "lucide-react";

type JobType = "all" | "internship" | "full-time" | "freelance" | "part-time";

interface Job {
  id: string;
  company_name: string;
  role_title: string;
  location?: string;
  type?: string;
  description?: string;
  application_url?: string;
  posted_at?: string;
  status?: string;
}

const TYPE_TABS: { key: JobType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "internship", label: "Internship" },
  { key: "full-time", label: "Full-Time" },
  { key: "freelance", label: "Freelance" },
  { key: "part-time", label: "Part-Time" },
];

const TYPE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  internship: { bg: "rgba(34, 211, 238, 0.15)", color: "#22d3ee" },
  "full-time": { bg: "rgba(0, 47, 167, 0.15)", color: "#4A7AFF" },
  freelance: { bg: "rgba(255, 209, 102, 0.15)", color: "#ffd166" },
  "part-time": { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<JobType>("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/jobs")
      .then((r) => r.ok ? r.json() : { jobs: [] })
      .then((d) => setJobs(d.jobs ?? d ?? []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = jobs;
    if (typeFilter !== "all") list = list.filter((j) => j.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) =>
        j.company_name?.toLowerCase().includes(q) ||
        j.role_title?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, typeFilter, search]);

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0, 47, 167, 0.1)" }}>
              <Briefcase className="w-5 h-5" style={{ color: "#4A7AFF" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Job Board</h1>
          </div>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg transition-colors"
            style={{ padding: "8px 14px", border: "1px solid var(--glass-border-soft)", color: "var(--color-text-muted)" }}
          >
            <Plus className="w-4 h-4" /> Submit a Job
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-subtle)" }} />
          <input
            type="text"
            placeholder="Search by company, role, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg text-sm outline-none transition-colors"
            style={{
              height: 40,
              paddingLeft: 36,
              paddingRight: 12,
              background: "#111827",
              border: "1px solid var(--glass-border-soft)",
              color: "var(--color-text-main)",
            }}
          />
        </div>

        {/* Type Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className="shrink-0 text-sm font-medium rounded-full transition-colors"
              style={{
                height: 36,
                padding: "0 16px",
                background: typeFilter === t.key ? "rgba(0, 47, 167, 0.15)" : "transparent",
                color: typeFilter === t.key ? "var(--color-text-main)" : "var(--color-text-muted)",
                border: typeFilter === t.key ? "1px solid #002fa7" : "1px solid var(--glass-border-soft)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Job Listings */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: "#111827", height: 160, padding: 24 }}>
                <div className="h-3 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)", width: "30%" }} />
                <div className="h-5 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)", width: "50%" }} />
                <div className="h-3 rounded" style={{ background: "rgba(255,255,255,0.06)", width: "70%" }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            {search ? <SearchX className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} /> : <Briefcase className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} />}
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {search ? "No jobs match your search. Try different keywords." : "No jobs posted yet. Check back soon or submit one!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((job) => {
              const badge = TYPE_BADGE_STYLES[job.type ?? ""] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" };
              return (
                <div
                  key={job.id}
                  className="rounded-2xl transition-all hover:border-[rgba(0,47,167,0.2)]"
                  style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", padding: 24 }}
                >
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{job.company_name}</p>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "var(--color-text-main)" }}>{job.role_title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {job.type && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        {job.type}
                      </span>
                    )}
                    {job.location && <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{job.location}</span>}
                    {job.posted_at && (
                      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        · {new Date(job.posted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {job.description && (
                    <p className="text-base line-clamp-2 mb-4" style={{ color: "var(--color-text-soft)" }}>{job.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {job.application_url && (
                      <a
                        href={job.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold rounded-lg transition-all"
                        style={{ height: 36, padding: "0 14px", background: "#002fa7", color: "#f1ffff" }}
                      >
                        Apply <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => toggleSave(job.id)}
                      className="flex items-center justify-center rounded-lg transition-colors"
                      style={{ width: 36, height: 36, border: "1px solid var(--glass-border-soft)", color: saved.has(job.id) ? "#ffd166" : "var(--color-text-muted)" }}
                    >
                      <Bookmark className="w-4 h-4" fill={saved.has(job.id) ? "#ffd166" : "none"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit Job Modal */}
      {showSubmit && <SubmitJobModal onClose={() => setShowSubmit(false)} onSubmit={() => { setShowSubmit(false); }} />}
    </div>
  );
}

function SubmitJobModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [form, setForm] = useState({ company_name: "", role_title: "", type: "internship", location: "", application_url: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.company_name || !form.role_title || !form.application_url) return;
    setSubmitting(true);
    try {
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSubmit();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const inputStyle = {
    height: 40,
    padding: "0 12px",
    background: "#111827",
    border: "1px solid var(--glass-border-soft)",
    borderRadius: 8,
    color: "var(--color-text-main)",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="w-full rounded-2xl overflow-y-auto"
        style={{ maxWidth: 560, maxHeight: "80vh", background: "#0d1b2a", border: "1px solid rgba(0, 47, 167, 0.3)", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-main)" }}>Submit a Job</h2>
          <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {[
            { key: "company_name", label: "Company Name *", placeholder: "e.g. Google" },
            { key: "role_title", label: "Role Title *", placeholder: "e.g. Software Engineer Intern" },
            { key: "location", label: "Location", placeholder: "e.g. Remote, Toronto, ON" },
            { key: "application_url", label: "Application URL *", placeholder: "https://..." },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm mb-1" style={{ color: "var(--color-text-muted)" }}>{f.label}</label>
              <input
                type="text"
                placeholder={f.placeholder}
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--color-text-muted)" }}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="internship">Internship</option>
              <option value="full-time">Full-Time</option>
              <option value="freelance">Freelance</option>
              <option value="part-time">Part-Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--color-text-muted)" }}>Description</label>
            <textarea
              placeholder="Brief role description..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              style={{ ...inputStyle, height: "auto", minHeight: 100, padding: 12 }}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !form.company_name || !form.role_title || !form.application_url}
          className="w-full mt-6 rounded-xl text-sm font-semibold transition-all"
          style={{ height: 44, background: "#002fa7", color: "#f1ffff", opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? "Submitting..." : "Submit for Review"}
        </button>
      </div>
    </div>
  );
}
