"use client";

import { useEffect, useState, useMemo } from "react";
import { Briefcase, Search, SearchX, ExternalLink, Bookmark, Plus } from "lucide-react";
import { Badge, Banner, Button, Card, Empty, Field, IconButton, Loading, Select, Sheet, Tabs, TextArea, type BadgeTone } from "@/components/gui";

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
  { key: "full-time", label: "Full-time" },
  { key: "freelance", label: "Freelance" },
  { key: "part-time", label: "Part-time" },
];

/** Each job type as a tag on paper; anything else shows as a plain tag with its own name. */
const TYPE_BADGES: Record<string, { tone: BadgeTone; label: string }> = {
  internship: { tone: "info", label: "Internship" },
  "full-time": { tone: "sage", label: "Full-time" },
  freelance: { tone: "gold", label: "Freelance" },
  "part-time": { tone: "success", label: "Part-time" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<JobType>("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((r) => r.ok ? r.json() : { jobs: [] })
      .then((d) => { if (!cancelled) setJobs(d.jobs ?? d ?? []); })
      .catch(() => { if (!cancelled) setJobs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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

  const typeLabel = TYPE_TABS.find((t) => t.key === typeFilter)?.label.toLowerCase();

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Banner title="Job board" icon={<Briefcase size={26} />} tone="sage">
          Internships and roles shared with the club. Know of one? Submit it.
        </Banner>

        {/* Search + submit */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--gui-muted)" }}
              aria-hidden
            />
            <input
              type="text"
              aria-label="Search jobs"
              placeholder="Search by company, role or keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] placeholder:text-[var(--gui-muted)] transition-colors"
              style={{
                height: 44,
                paddingLeft: 40,
                paddingRight: 16,
                background: "var(--gui-paper-hi)",
                borderRadius: "var(--gui-r-pill)",
                color: "var(--gui-ink)",
                fontWeight: 600,
              }}
            />
          </div>
          <Button size="sm" variant="quiet" onClick={() => setShowSubmit(true)}>
            <Plus className="w-4 h-4" aria-hidden /> Submit a job
          </Button>
        </div>

        {/* Type Filter Tabs */}
        <Tabs
          label="Job type"
          value={typeFilter}
          onChange={setTypeFilter}
          tabs={TYPE_TABS.map((t) => ({ id: t.key, label: t.label }))}
          className="mb-6"
        />

        {/* Job Listings */}
        {loading ? (
          <Loading label="Loading the job board…" />
        ) : filtered.length === 0 ? (
          search ? (
            <Empty icon={<SearchX size={32} />} title="No matches">
              Try another company, role or keyword.
            </Empty>
          ) : (
            <Empty
              icon={<Briefcase size={32} />}
              title={typeFilter !== "all" && jobs.length > 0 ? `No ${typeLabel} roles right now` : "No jobs posted yet"}
              action={
                <Button size="sm" variant="quiet" onClick={() => setShowSubmit(true)}>
                  <Plus className="w-4 h-4" aria-hidden /> Submit a job
                </Button>
              }
            >
              Check back soon, or share one you know about.
            </Empty>
          )
        ) : (
          <div className="space-y-4">
            {filtered.map((job) => {
              const badge = TYPE_BADGES[job.type ?? ""];
              const isSaved = saved.has(job.id);
              return (
                <Card key={job.id} as="article">
                  <p className="text-sm mb-0.5" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>{job.company_name}</p>
                  <h3 className="text-lg mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>{job.role_title}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-sm" style={{ color: "var(--gui-muted)" }}>
                    {job.type && (
                      <Badge tone={badge?.tone ?? "neutral"}>
                        {badge?.label ?? job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                      </Badge>
                    )}
                    {job.location && <span>{job.location}</span>}
                    {job.posted_at && <span>· Posted {formatDate(job.posted_at)}</span>}
                  </div>
                  {job.description && (
                    <p className="text-base line-clamp-2 mb-4" style={{ color: "var(--gui-ink)" }}>{job.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {job.application_url && (
                      <a
                        href={job.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                        style={{
                          minHeight: 40,
                          padding: "6px 18px",
                          borderRadius: "var(--gui-r-pill)",
                          background: "var(--gui-sage)",
                          color: "var(--gui-paper)",
                          fontWeight: 800,
                          boxShadow: "0 3px 0 var(--gui-sage-deep)",
                        }}
                      >
                        Apply <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                      </a>
                    )}
                    <IconButton
                      label="Save this job"
                      size="sm"
                      tone={isSaved ? "butter" : undefined}
                      aria-pressed={isSaved}
                      onClick={() => toggleSave(job.id)}
                    >
                      <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} aria-hidden />
                    </IconButton>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit Job Sheet */}
      {showSubmit && <SubmitJobModal onClose={() => setShowSubmit(false)} onSubmit={() => { setShowSubmit(false); }} />}
    </div>
  );
}

/** Mounted only while open (its form starts empty each time), so its Sheet is always open. */
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

  return (
    <Sheet
      open
      onClose={onClose}
      title="Submit a job"
      eyebrow="Job board"
      icon={<Briefcase size={22} />}
      size="md"
      footer={
        <>
          <Button size="sm" variant="quiet" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !form.company_name || !form.role_title || !form.application_url}
          >
            {submitting ? "Sending…" : "Submit for review"}
          </Button>
        </>
      }
    >
      <p className="text-sm mb-5" style={{ color: "var(--gui-ink-2)" }}>
        The company, the role and a link to apply are all it needs.
      </p>
      <div className="space-y-4">
        {[
          { key: "company_name", label: "Company", placeholder: "e.g. Google" },
          { key: "role_title", label: "Role", placeholder: "e.g. Software Engineer Intern" },
          { key: "location", label: "Location (optional)", placeholder: "e.g. Remote, or Toronto, ON" },
          { key: "application_url", label: "Link to apply", placeholder: "https://…" },
        ].map((f) => (
          <Field
            key={f.key}
            label={f.label}
            type="text"
            placeholder={f.placeholder}
            value={(form as Record<string, string>)[f.key]}
            onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
          />
        ))}
        <Select
          label="Type"
          value={form.type}
          onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
        >
          <option value="internship">Internship</option>
          <option value="full-time">Full-time</option>
          <option value="freelance">Freelance</option>
          <option value="part-time">Part-time</option>
        </Select>
        <TextArea
          label="Description (optional)"
          placeholder="A few lines about the role…"
          rows={4}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
    </Sheet>
  );
}
