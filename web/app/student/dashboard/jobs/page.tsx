"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Briefcase,
  MapPin,
  ExternalLink,
  X,
  Plus,
  Clock,
  MessageSquare,
  Tag,
} from "lucide-react";

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: string;
  description: string | null;
  url: string | null;
  categories: string[];
  posted_by: string | null;
  created_at: string;
  poster: { display_name: string } | null;
}

interface JobComment {
  id: string;
  content: string;
  created_at: string;
  user: { display_name: string } | null;
}

const jobTypes = ["all", "internship", "full_time", "part_time", "contract"] as const;

const jobTypeLabels: Record<string, string> = {
  internship: "Internship",
  full_time: "Full-Time",
  part_time: "Part-Time",
  contract: "Contract",
};

const jobTypeColors: Record<string, string> = {
  internship: "bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)]",
  full_time: "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]",
  part_time: "bg-[var(--color-brand-yellow)]/10 text-[var(--color-brand-yellow)]",
  contract: "bg-purple-500/10 text-purple-400",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof jobTypes)[number]>("all");
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [jobComments, setJobComments] = useState<JobComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showPostForm, setShowPostForm] = useState(false);
  const [posting, setPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    job_type: "internship",
    url: "",
    categories: "" as string,
    description: "",
  });

  const fetchJobs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("job_listings")
      .select("id, title, company, location, job_type, description, url, categories, posted_by, created_at, poster:profiles!posted_by(display_name)")
      .order("created_at", { ascending: false });

    setJobs(
      (data ?? []).map((j) => ({
        ...j,
        categories: (j.categories as string[]) ?? [],
        poster: j.poster as unknown as { display_name: string } | null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const openJob = async (job: JobListing) => {
    setSelectedJob(job);
    const supabase = createClient();
    const { data } = await supabase
      .from("job_comments")
      .select("id, content, created_at, user:profiles(display_name)")
      .eq("job_id", job.id)
      .order("created_at");

    setJobComments(
      (data ?? []).map((c) => ({
        ...c,
        user: c.user as unknown as { display_name: string } | null,
      }))
    );
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedJob) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("job_comments")
      .insert({ job_id: selectedJob.id, user_id: user.id, content: newComment.trim() })
      .select("id, content, created_at, user:profiles(display_name)")
      .single();

    if (data) {
      setJobComments((prev) => [
        ...prev,
        { ...data, user: data.user as unknown as { display_name: string } | null },
      ]);
    }
    setNewComment("");
  };

  const submitJob = async () => {
    if (!formData.title.trim() || !formData.company.trim()) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }

    const cats = formData.categories
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    await supabase.from("job_listings").insert({
      title: formData.title.trim(),
      company: formData.company.trim(),
      location: formData.location.trim() || null,
      job_type: formData.job_type,
      url: formData.url.trim() || null,
      categories: cats,
      description: formData.description.trim() || null,
      posted_by: user.id,
    });

    setFormData({
      title: "",
      company: "",
      location: "",
      job_type: "internship",
      url: "",
      categories: "",
      description: "",
    });
    setShowPostForm(false);
    setPosting(false);
    fetchJobs();
  };

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || j.job_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading job board...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Job Board
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {filtered.length} listing{filtered.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <button
          onClick={() => setShowPostForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-mono bg-[var(--color-brand-blue)] text-white rounded-md hover:bg-[var(--color-brand-blue)]/80 transition-colors"
        >
          <Plus size={14} />
          Post a Job
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md pl-9 pr-4 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
            placeholder="Search by title or company..."
          />
        </div>

        <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
          {jobTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                typeFilter === t
                  ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t === "all" ? "All" : jobTypeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {filtered.map((job) => (
          <button
            key={job.id}
            onClick={() => openJob(job)}
            className="w-full text-left bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_0_12px_rgba(0,47,167,0.1)] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
                    {job.title}
                  </h3>
                  <span
                    className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded ${
                      jobTypeColors[job.job_type] ?? "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {jobTypeLabels[job.job_type] ?? job.job_type}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} />
                    {job.company}
                  </span>
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(job.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {job.categories.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {job.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-main)] border border-[var(--glass-border)] text-[var(--color-text-muted)]"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {job.poster && (
                <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] shrink-0">
                  by {job.poster.display_name}
                </span>
              )}
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Briefcase size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="font-mono text-sm text-[var(--color-text-muted)]">
              No jobs match your search.
            </p>
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedJob(null);
            setJobComments([]);
          }}
        >
          <div
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg w-full max-w-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[var(--glass-border)] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                  {selectedJob.title}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs font-mono text-[var(--color-text-muted)]">
                  <span>{selectedJob.company}</span>
                  {selectedJob.location && (
                    <>
                      <span>&middot;</span>
                      <span>{selectedJob.location}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setJobComments([]);
                }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[0.6rem] font-mono px-2 py-0.5 rounded ${
                    jobTypeColors[selectedJob.job_type] ?? "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {jobTypeLabels[selectedJob.job_type] ?? selectedJob.job_type}
                </span>
                {selectedJob.categories.map((cat) => (
                  <span
                    key={cat}
                    className="flex items-center gap-1 text-[0.6rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-main)] border border-[var(--glass-border)] text-[var(--color-text-muted)]"
                  >
                    <Tag size={8} />
                    {cat}
                  </span>
                ))}
              </div>

              {selectedJob.description && (
                <div>
                  <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {selectedJob.description}
                  </p>
                </div>
              )}

              {selectedJob.url && (
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-mono text-[var(--color-brand-blue)] hover:underline"
                >
                  <ExternalLink size={14} />
                  View Original Posting
                </a>
              )}

              {/* Discussion */}
              <div>
                <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MessageSquare size={12} />
                  Discussion ({jobComments.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {jobComments.map((c) => (
                    <div key={c.id} className="bg-[var(--color-bg-main)] rounded-md p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-[var(--color-brand-blue)]">
                          {c.user?.display_name ?? "Unknown"}
                        </span>
                        <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">{c.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                    placeholder="Join the discussion..."
                    className="flex-1 bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  />
                  <button
                    onClick={addComment}
                    className="px-3 py-2 text-xs font-mono bg-[var(--color-brand-blue)] text-white rounded-md hover:bg-[var(--color-brand-blue)]/80 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showPostForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPostForm(false)}
        >
          <div
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[var(--glass-border)] flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                Post a Job
              </h2>
              <button
                onClick={() => setShowPostForm(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  placeholder="e.g. Frontend Developer Intern"
                />
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Company *
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  placeholder="e.g. Remote, Toronto, ON"
                />
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Job Type
                </label>
                <select
                  value={formData.job_type}
                  onChange={(e) => setFormData((p) => ({ ...p, job_type: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                >
                  <option value="internship">Internship</option>
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Posting URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => setFormData((p) => ({ ...p, categories: e.target.value }))}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  placeholder="e.g. frontend, react, startup"
                />
              </div>

              <div>
                <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all resize-none"
                  placeholder="Job description, requirements, etc."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowPostForm(false)}
                  className="flex-1 py-2 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border)] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitJob}
                  disabled={posting || !formData.title.trim() || !formData.company.trim()}
                  className="flex-1 py-2 text-sm font-mono bg-[var(--color-brand-blue)] text-white rounded-md hover:bg-[var(--color-brand-blue)]/80 transition-colors disabled:opacity-40"
                >
                  {posting ? "Posting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
