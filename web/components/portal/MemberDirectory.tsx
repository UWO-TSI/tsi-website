"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, SearchX, Loader2 } from "lucide-react";
import MemberCard from "./MemberCard";
import { TIER_COLORS } from "./types";
import type { DirectoryMember, Tier } from "@/lib/supabase/types";

export default function MemberDirectory() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<Set<Tier>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter === "active") params.set("active", "true");
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
  }, [search, statusFilter]);

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  // Client-side tier filter
  const filtered = useMemo(() => {
    if (tierFilter.size === 0) return members;
    return members.filter((m) => tierFilter.has(m.tier));
  }, [members, tierFilter]);

  const toggleTier = (tier: Tier) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: "80px 0" }}>
        <Loader2
          className="animate-spin"
          style={{ width: "28px", height: "28px", color: "var(--color-accent-cyan)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ padding: "80px 0" }}>
        <p style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto" style={{ maxWidth: "960px", padding: "24px" }}>
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute top-1/2 -translate-y-1/2" style={{ left: "12px", width: "16px", height: "16px", color: "var(--color-text-subtle)" }} />
          <input
            type="text" placeholder="Search by name, class, or skill..." value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label="Search members"
            className="w-full outline-none transition-shadow"
            style={{ height: "40px", padding: "0 12px 0 36px", background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", borderRadius: "8px", fontSize: "14px", color: "var(--color-text-main)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand-blue)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,47,167,0.2)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--glass-border-soft)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <button onClick={() => setFilterOpen((f) => !f)} className="flex items-center gap-2 shrink-0 transition-colors"
          style={{ height: "40px", padding: "0 12px", background: "transparent", border: filterOpen ? "1px solid var(--color-brand-blue)" : "1px solid var(--gray-700)", borderRadius: "8px", color: "var(--color-text-muted)", fontSize: "14px" }}>
          <SlidersHorizontal style={{ width: "16px", height: "16px" }} /> Filters
        </button>
      </div>

      {filterOpen && (
        <div className="mb-4 p-3" style={{ background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", borderRadius: "8px", boxShadow: "var(--shadow-soft)" }}>
          <div className="mb-3">
            <label className="block mb-2 font-mono uppercase" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em" }}>Tier</label>
            <div className="flex gap-2 flex-wrap">
              {([1, 2, 3, 4, 5] as Tier[]).map((tier) => {
                const selected = tierFilter.has(tier); const tc = TIER_COLORS[tier];
                return (<button key={tier} onClick={() => toggleTier(tier)} className="font-mono transition-colors"
                  style={{ height: "28px", padding: "0 12px", fontSize: "12px", borderRadius: "9999px", background: selected ? tc.bg : "transparent", border: selected ? `1px solid ${tc.color}` : "1px solid var(--gray-700)", color: selected ? tc.color : "var(--color-text-muted)" }}>T{tier}</button>);
              })}
            </div>
          </div>
          <div>
            <label className="block mb-2 font-mono uppercase" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em" }}>Status</label>
            <div className="flex gap-2">
              {(["active", "all"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className="transition-colors capitalize"
                  style={{ height: "28px", padding: "0 12px", fontSize: "12px", borderRadius: "9999px", background: statusFilter === s ? "rgba(0,47,167,0.15)" : "transparent", border: statusFilter === s ? "1px solid var(--color-brand-blue)" : "1px solid var(--gray-700)", color: statusFilter === s ? "var(--color-text-main)" : "var(--color-text-muted)" }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mb-3" style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
        {loading ? "Loading..." : `Showing ${filtered.length} member${filtered.length !== 1 ? "s" : ""}`}
      </p>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" style={{ width: "24px", height: "24px", color: "var(--color-text-subtle)" }} />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12" style={{ color: "var(--color-error)" }}>
          <p className="mb-2">{error}</p>
          <button onClick={fetchMembers} className="text-sm underline" style={{ color: "var(--color-text-muted)" }}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div role="listbox" aria-label="Member directory">
          {filtered.map((member) => (<MemberCard key={member.id} member={member} />))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center" style={{ padding: "48px" }}>
          <SearchX style={{ width: "32px", height: "32px", color: "var(--color-text-subtle)", marginBottom: "12px" }} />
          <p style={{ fontSize: "16px", color: "var(--color-text-muted)", fontWeight: 500 }}>No members found</p>
          <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", marginTop: "4px" }}>Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
