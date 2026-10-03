"use client";

import { useEffect, useState, useMemo } from "react";
import { Briefcase, Search, SearchX, ExternalLink, Bookmark, Plus } from "lucide-react";
import { Badge, Banner, Button, Card, Empty, ErrorNote, Field, IconButton, Loading, Select, Sheet, Tabs, TextArea, type BadgeTone } from "@/components/gui";
import type { JobListing, JobType } from "@/lib/supabase/types";
import { emptyJobForm, isWebLink, JOB_TYPES, readSaved, submitJob, writeSaved, type JobForm } from "@/lib/portal/jobs";

const TYPE_TABS: { key: JobType | "all"; label: string }[] = [{ key: "all", label: "All" }, ...JOB_TYPES.map((t) => ({ key: t.id, label: t.label }))];

/** Each job type as a tag on paper (job_listings.job_type). */
const TYPE_TONES: Record<JobType, BadgeTone> = { internship: "info", full_time: "sage", part_time: "success", contract: "gold" };
const typeLabel = (t: JobType) => JOB_TYPES.find((x) => x.id === t)?.label ?? t;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) { setJobs(d.jobs ?? []); setLoadFailed(false); } })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  // Saved jobs are kept on this device; read after mount so the server render matches.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of localStorage on mount
  useEffect(() => setSaved(readSaved()), []);

  const filtered = useMemo(() => {
    let list = jobs;
    if (typeFilter !== "all") list = list.filter((j) => j.job_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) =>
        j.company.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, typeFilter, search]);

  const toggleSave = (id: string) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSaved(next);
    writeSaved(next);
  };

  const filterLabel = TYPE_TABS.find((t) => t.key === typeFilter)?.label.toLowerCase();

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
        ) : loadFailed ? (
          <ErrorNote onRetry={() => { setLoading(true); setReload((n) => n + 1); }}>The job board didn’t load.</ErrorNote>
        ) : filtered.length === 0 ? (
          search ? (
            <Empty icon={<SearchX size={32} />} title="No matches">
              Try another company, role or keyword.
            </Empty>
          ) : (
            <Empty
              icon={<Briefcase size={32} />}
              title={typeFilter !== "all" && jobs.length > 0 ? `No ${filterLabel} roles right now` : "No jobs posted yet"}
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
              const isSaved = saved.has(job.id);
              return (
                <Card key={job.id} as="article">
                  <p className="text-sm mb-0.5" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>{job.company}</p>
                  <h3 className="text-lg mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>{job.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-sm" style={{ color: "var(--gui-muted)" }}>
                    <Badge tone={TYPE_TONES[job.job_type] ?? "neutral"}>{typeLabel(job.job_type)}</Badge>
                    {job.location && <span>{job.location} ·</span>}
                    <span>Posted {formatDate(job.created_at)}</span>
                  </div>
                  {job.description && (
                    <p className="text-base line-clamp-2 mb-4" style={{ color: "var(--gui-ink)" }}>{job.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {isWebLink(job.url) && <a
                      href={job.url}
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
                    </a>}
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
      {showSubmit && <SubmitJobModal onClose={() => setShowSubmit(false)} onPosted={(job) => { setJobs((prev) => [job, ...prev]); setShowSubmit(false); }} />}
    </div>
  );
}

/** Mounted only while open (its form starts empty each time), so its Sheet is always open. It closes only once the job is posted. */
function SubmitJobModal({ onClose, onPosted }: { onClose: () => void; onPosted: (job: JobListing) => void }) {
  const [form, setForm] = useState<JobForm>(emptyJobForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!(form.company.trim() && form.title.trim() && form.url.trim());

  const handleSubmit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    const r = await submitJob(form);
    setSubmitting(false);
    if (r.ok) onPosted(r.job);
    else setError(r.error);
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
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !ready}>
            {submitting ? "Posting…" : "Post the job"}
          </Button>
        </>
      }
    >
      <p className="text-sm mb-5" style={{ color: "var(--gui-ink-2)" }}>
        The company, the role and a link to apply are all it needs. It goes up on the board straight away.
      </p>
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      <div className="space-y-4">
        {([
          { key: "company", label: "Company", placeholder: "e.g. Google" },
          { key: "title", label: "Role", placeholder: "e.g. Software Engineer Intern" },
          { key: "location", label: "Location (optional)", placeholder: "e.g. Remote, or Toronto, ON" },
          { key: "url", label: "Link to apply", placeholder: "https://…" },
        ] as const).map((f) => (
          <Field
            key={f.key}
            label={f.label}
            type={f.key === "url" ? "url" : "text"}
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
          />
        ))}
        <Select
          label="Type"
          value={form.job_type}
          onChange={(e) => setForm((p) => ({ ...p, job_type: e.target.value as JobType }))}
        >
          {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
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
