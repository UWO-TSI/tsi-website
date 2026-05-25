"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import FilterBar, { type FilterState } from "@/components/admin/FilterBar";
import ApplicantCard from "@/components/admin/ApplicantCard";
import ReleaseControls from "@/components/admin/ReleaseControls";
import RecruitInsights from "@/components/admin/RecruitInsights";
import RecruitBoard from "@/components/admin/RecruitBoard";
import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { RefreshCw, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application, ApplicationStatus, Position } from "@/lib/recruitment";
import type { User } from "@supabase/supabase-js";

export default function AdminRecruitPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    status: "",
    tag: "",
  });
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "board" | "insights">("dashboard");

  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch applications (admin API)
    const res = await fetch("/api/applications", {
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 403) {
      router.push("/");
      return;
    }

    if (res.ok) {
      const data = await res.json();
      setApplications(data);

      // Extract unique positions
      const posMap = new Map<string, Position>();
      for (const app of data) {
        if (app.position) posMap.set(app.position.id, app.position);
      }
      setPositions(Array.from(posMap.values()));
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered applications
  const filtered = applications.filter((app) => {
    if (
      filters.search &&
      !app.full_name.toLowerCase().includes(filters.search.toLowerCase()) &&
      !app.email.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.role && app.position?.slug !== filters.role) return false;
    const effectiveStatus = app.draft_status ?? app.status;
    if (filters.status && effectiveStatus !== filters.status) return false;
    if (filters.tag && !app.tags.some((t) => t.includes(filters.tag.toLowerCase()))) {
      return false;
    }
    return true;
  });

  // Pending count
  const pendingCount = applications.filter(
    (a) => a.draft_status && a.draft_status !== a.status
  ).length;

  const positionsWithPending = positions.map((p) => ({
    id: p.id,
    title: p.title,
    pendingCount: applications.filter(
      (a) =>
        a.position_id === p.id &&
        a.draft_status &&
        a.draft_status !== a.status
    ).length,
  }));

  // Handlers
  // Pass null to clear a pending verdict (undo). Otherwise sets draft_status
  // to the new value; release later publishes to the student.
  const handleStatusChange = async (
    id: string,
    status: ApplicationStatus | null
  ) => {
    const prev = applications.find((a) => a.id === id);
    setApplications((apps) =>
      apps.map((a) => (a.id === id ? { ...a, draft_status: status } : a))
    );

    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_status: status }),
    });

    if (!res.ok && prev) {
      setApplications((apps) =>
        apps.map((a) =>
          a.id === id ? { ...a, draft_status: prev.draft_status } : a
        )
      );
    }
  };

  const handleTagsChange = async (id: string, tags: string[]) => {
    const prev = applications.find((a) => a.id === id);
    setApplications((apps) =>
      apps.map((a) => (a.id === id ? { ...a, tags } : a))
    );

    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });

    if (!res.ok && prev) {
      setApplications((apps) =>
        apps.map((a) => (a.id === id ? { ...a, tags: prev.tags } : a))
      );
    }
  };

  // Debounced per-applicant note save so typing doesn't hammer the API.
  // Server picks the author from session, so client just sends the text.
  const noteTimers = useMemo(
    () => new Map<string, ReturnType<typeof setTimeout>>(),
    []
  );
  const handleNoteTextChange = (id: string, text: string) => {
    const existing = noteTimers.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: text }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplications((apps) =>
          apps.map((a) =>
            a.id === id ? { ...a, admin_notes: updated.admin_notes } : a
          )
        );
      }
    }, 600);
    noteTimers.set(id, t);
  };

  const handleDelete = async (id: string) => {
    const prev = applications;
    setApplications((apps) => apps.filter((a) => a.id !== id));
    setSelectedIds((ids) => ids.filter((x) => x !== id));

    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (!res.ok) {
      // Restore on failure
      setApplications(prev);
      const body = await res.json().catch(() => ({}));
      alert(`Failed to delete: ${body.error ?? res.statusText}`);
    }
  };

  const handleRelease = async (id: string) => {
    const res = await fetch(`/api/applications/${id}/release`, {
      method: "POST",
    });
    if (res.ok) {
      await fetchData(); // Refresh
    }
  };

  const handleReleaseAll = async (positionId: string) => {
    await fetch("/api/applications/release-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position_id: positionId }),
    });
    await fetchData();
  };

  const handleReleaseSelected = async (ids: string[]) => {
    await fetch("/api/applications/release-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_ids: ids }),
    });
    setSelectedIds([]);
    await fetchData();
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSheetsSync = async () => {
    setSyncing(true);
    await fetch("/api/sheets-sync", { method: "POST" });
    setSyncing(false);
  };

  const handleCsvExport = () => {
    window.open("/api/applications/export", "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9CA3AF]">Please sign in to access admin.</p>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8 px-6 md:px-10 max-w-[1400px] mx-auto pb-32">
      {/* Header — compact single row */}
      <motion.header
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        className="flex items-end justify-between gap-4 mb-6 flex-wrap"
      >
        <div className="flex items-end gap-4 min-w-0">
          {/* Accent bar */}
          <div
            className="hidden md:block w-[3px] h-12 rounded-full flex-shrink-0"
            style={{
              background:
                "linear-gradient(180deg, #1D9BF0 0%, rgba(29,155,240,0.2) 100%)",
            }}
          />
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#1D9BF0] mb-1.5">
              Admin · Recruitment
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold text-[#F1FFFF] leading-none">
                Applications
              </h1>
              <span className="text-[11px] font-mono text-[#6B7280] tabular-nums">
                {applications.length} total
                {pendingCount > 0 && (
                  <>
                    <span className="opacity-50 mx-2">·</span>
                    <span className="text-[#FFD166]">
                      {pendingCount} pending
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={handleCsvExport}
            icon={<Download className="w-3.5 h-3.5" />}
            label="Export"
          />
          <ToolbarButton
            onClick={handleSheetsSync}
            disabled={syncing}
            icon={
              <Download
                className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
              />
            }
            label="Sheets"
          />
          <ToolbarButton
            onClick={() => fetchData()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Refresh"
          />
        </div>
      </motion.header>

      {/* Tabs — segmented control */}
      <div className="mb-5">
        <div
          className="inline-flex items-center p-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <SegmentTab
            label="List"
            count={applications.length}
            active={tab === "dashboard"}
            onClick={() => setTab("dashboard")}
          />
          <SegmentTab
            label="Board"
            badge={pendingCount > 0 ? pendingCount : undefined}
            active={tab === "board"}
            onClick={() => setTab("board")}
          />
          <SegmentTab
            label="Insights"
            active={tab === "insights"}
            onClick={() => setTab("insights")}
          />
        </div>
      </div>

      {/* Floating release controls — rendered once, fixed bottom-right. */}
      <ReleaseControls
        pendingCount={pendingCount}
        positions={positionsWithPending}
        onReleaseAll={handleReleaseAll}
        onReleaseSelected={handleReleaseSelected}
        selectedIds={selectedIds}
      />

      {tab === "dashboard" && (
        <section
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* List toolbar — filters live here so they read as part of the list. */}
          <div
            className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between gap-4 flex-wrap"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <FilterBar
              positions={positions.map((p) => ({ slug: p.slug, title: p.title }))}
              onFilterChange={setFilters}
            />
            <span className="text-[10px] font-mono text-[#6B7280] tabular-nums whitespace-nowrap">
              {filtered.length} / {applications.length} shown
            </span>
          </div>

          {/* Rows */}
          <div className="p-3 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="rounded-xl p-12 text-center">
                <p className="text-sm text-[#6B7280]">
                  No applications match your filters.
                </p>
              </div>
            ) : (
              filtered.map((app) => (
                <ApplicantCard
                  key={app.id}
                  application={app}
                  isSelected={selectedIds.includes(app.id)}
                  currentUserEmail={user?.email ?? ""}
                  onSelect={handleSelect}
                  onStatusChange={handleStatusChange}
                  onTagsChange={handleTagsChange}
                  onNoteTextChange={handleNoteTextChange}
                  onRelease={handleRelease}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </section>
      )}

      {tab === "board" && (
        <RecruitBoard
          applications={applications}
          positions={positions}
          onStatusChange={handleStatusChange}
        />
      )}

      {tab === "insights" && (
        <RecruitInsights applications={applications} positions={positions} />
      )}
    </div>
  );
}

function SegmentTab({
  label,
  count,
  badge,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] transition-colors"
      style={{
        background: active ? "rgba(29,155,240,0.14)" : "transparent",
        color: active ? "#F1FFFF" : "rgba(255,255,255,0.55)",
        fontFamily: "var(--font-highlight)",
      }}
    >
      <span className="font-medium tracking-wide">{label}</span>
      {count !== undefined && (
        <span
          className="text-[10px] tabular-nums opacity-60"
          style={{ color: active ? "#1D9BF0" : "inherit" }}
        >
          {count}
        </span>
      )}
      {badge !== undefined && (
        <span
          className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-mono"
          style={{
            background: "rgba(255,209,102,0.18)",
            color: "#FFD166",
            border: "1px solid rgba(255,209,102,0.35)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono tracking-wide text-[#9CA3AF] hover:text-[#F1FFFF] hover:bg-white/[0.04] transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}
