"use client";

import { useState, useMemo, useEffect, useCallback, type CSSProperties } from "react";
import { Search, SlidersHorizontal, SearchX, Users } from "lucide-react";
import MemberCard from "./MemberCard";
import { CLASS_META, TIER_LOOK } from "./classIdentity";
import { TIER_LABELS } from "./types";
import { Banner, Button, Card, Empty, ErrorNote, Loading, Select, Tabs, type TabItem } from "@/components/gui";
import type { DirectoryMember, Tier } from "@/lib/supabase/types";

const STATUS_TABS: TabItem<"active" | "all">[] = [
  { id: "active", label: "Active" },
  { id: "all", label: "Everyone" },
];

const filterLabel: CSSProperties = { fontSize: "14px", fontWeight: 800, color: "var(--gui-ink-strong)" };

export default function MemberDirectory() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<Set<Tier>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  // Class + Year dropdowns per ux-directory.md §3.4. Year filters server-side
  // (/api/directory?year= on profiles.year, "1"-"5" strings per onboarding);
  // migration 021 confirmed applied to remote 2026-07-03, unblocking this.
  const [classFilter, setClassFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter === "active") params.set("active", "true");
      if (yearFilter !== "all") params.set("year", yearFilter);
      const res = await fetch(`/api/directory?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, yearFilter]);

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  // Client-side tier + class filters
  const filtered = useMemo(() => {
    let out = members;
    if (tierFilter.size > 0) out = out.filter((m) => tierFilter.has(m.tier));
    if (classFilter !== "all") out = out.filter((m) => m.class === classFilter);
    return out;
  }, [members, tierFilter, classFilter]);

  const toggleTier = (tier: Tier) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div className="mx-auto" style={{ maxWidth: "960px" }}>
        <Banner title="Directory" icon={<Users size={26} />} tone="sage">Everyone in the club. Find people by name, class or skill.</Banner>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search aria-hidden className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ left: "16px", width: "18px", height: "18px", color: "var(--gui-muted)" }} />
            <input
              type="text" placeholder="Search by name, class or skill…" value={search}
              onChange={(e) => setSearch(e.target.value)} aria-label="Search members"
              className="w-full transition-colors border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] bg-[var(--gui-paper-hi)] text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)]"
              style={{ height: "48px", padding: "0 16px 0 44px", borderRadius: "18px 15px 17px 16px", fontSize: "15px", fontWeight: 600 }}
            />
          </div>
          <Button variant={filterOpen ? "secondary" : "quiet"} onClick={() => setFilterOpen((f) => !f)} aria-expanded={filterOpen} className="shrink-0">
            <SlidersHorizontal size={18} aria-hidden /> Filters
          </Button>
        </div>

        {filterOpen && (
          <Card className="mb-4 grid gap-4">
            <div>
              <p className="mb-2" style={filterLabel}>Tier</p>
              <div className="flex gap-2 flex-wrap">
                {([1, 2, 3, 4, 5] as Tier[]).map((tier) => {
                  const selected = tierFilter.has(tier);
                  return (
                    <button key={tier} type="button" onClick={() => toggleTier(tier)} aria-pressed={selected}
                      className="inline-flex items-center gap-2 rounded-full transition-colors"
                      style={{ minHeight: "38px", padding: "0 14px", fontSize: "13px", fontWeight: 800, background: selected ? "var(--gui-butter)" : "var(--gui-paper-deep)", color: selected ? "var(--gui-ink-strong)" : "var(--gui-ink-2)", boxShadow: selected ? "var(--gui-shadow-sm)" : "none" }}>
                      <span aria-hidden className="rounded-full" style={{ width: "9px", height: "9px", background: TIER_LOOK[tier].ring }} />
                      T{tier} · {TIER_LABELS[tier]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Select label="Class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">All classes</option>
              {Object.keys(CLASS_META).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="all">All years</option>
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
              <option value="5">5th+</option>
            </Select>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span style={filterLabel}>Status</span>
              <Tabs label="Member status" value={statusFilter} onChange={setStatusFilter} tabs={STATUS_TABS} />
            </div>
          </Card>
        )}

        {loading ? <Loading label="Finding the club’s members…" />
          : error ? <ErrorNote onRetry={fetchMembers}>The member list didn’t load. Check your connection and try again.</ErrorNote>
          : filtered.length === 0 ? (
            <Empty icon={<SearchX size={32} />} title="No members found">Try another name, or loosen a filter.</Empty>
          ) : (
            <>
              <p className="mb-3" style={{ fontSize: "14px", fontWeight: 700, color: "var(--gui-muted)" }}>
                Showing {filtered.length} member{filtered.length !== 1 ? "s" : ""}
              </p>
              <Card style={{ padding: "4px 6px" }}>
                <div role="listbox" aria-label="Member directory">
                  {filtered.map((member) => (<MemberCard key={member.id} member={member} />))}
                </div>
              </Card>
            </>
          )}
      </div>
    </div>
  );
}
