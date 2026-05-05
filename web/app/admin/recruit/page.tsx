"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import FilterBar, { type FilterState } from "@/components/admin/FilterBar";
import ApplicantCard from "@/components/admin/ApplicantCard";
import ReleaseControls from "@/components/admin/ReleaseControls";
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
  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    const prev = applications.find((a) => a.id === id);
    // Update locally (optimistic)
    setApplications((apps) =>
      apps.map((a) => (a.id === id ? { ...a, draft_status: status } : a))
    );

    // Persist to server
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_status: status }),
    });

    if (!res.ok && prev) {
      // Revert on failure
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

  const handleNotesChange = async (id: string, notes: string) => {
    const prev = applications.find((a) => a.id === id);
    setApplications((apps) =>
      apps.map((a) => (a.id === id ? { ...a, admin_notes: notes } : a))
    );

    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_notes: notes }),
    });

    if (!res.ok && prev) {
      setApplications((apps) =>
        apps.map((a) =>
          a.id === id ? { ...a, admin_notes: prev.admin_notes } : a
        )
      );
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
    <div className="py-8 md:py-12 px-6 md:px-12 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between mb-8"
      >
        <div>
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#1D9BF0] mb-1">
            Admin
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF]">
            Recruitment Dashboard
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {applications.length} total application{applications.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1.5 rounded-lg bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 px-3 py-2 text-xs text-[#F1FFFF] hover:bg-[#1D9BF0]/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleSheetsSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync to Sheets
          </button>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Release controls */}
      <ReleaseControls
        pendingCount={pendingCount}
        positions={positionsWithPending}
        onReleaseAll={handleReleaseAll}
        onReleaseSelected={handleReleaseSelected}
        selectedIds={selectedIds}
      />

      {/* Filters */}
      <FilterBar
        positions={positions.map((p) => ({ slug: p.slug, title: p.title }))}
        onFilterChange={setFilters}
      />

      {/* Application list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-[#9CA3AF]">No applications match your filters.</p>
          </div>
        ) : (
          filtered.map((app) => (
            <ApplicantCard
              key={app.id}
              application={app}
              isSelected={selectedIds.includes(app.id)}
              onSelect={handleSelect}
              onStatusChange={handleStatusChange}
              onTagsChange={handleTagsChange}
              onNotesChange={handleNotesChange}
              onRelease={handleRelease}
            />
          ))
        )}
      </div>
    </div>
  );
}
