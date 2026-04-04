"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";

interface AdminMember {
  id: string;
  display_name: string;
  email: string;
  tier: Tier;
  position: string | null;
  class: string | null;
  level: number;
  xp: number;
  tethos_coins: number;
  is_active: boolean;
  is_alumni: boolean;
  onboarding_completed: boolean;
  created_at: string;
  last_login_at: string | null;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchMembers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, display_name, email, tier, position, class, level, xp, tethos_coins, is_active, is_alumni, onboarding_completed, created_at, last_login_at"
      )
      .order("tier", { ascending: true })
      .order("display_name");
    setMembers((data as AdminMember[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  async function updateTier(memberId: string, newTier: Tier) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ tier: newTier })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, tier: newTier } : m))
    );
    setUpdating(null);
  }

  async function toggleActive(memberId: string, isActive: boolean) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, is_active: !isActive } : m
      )
    );
    setUpdating(null);
  }

  async function toggleAlumni(memberId: string, isAlumni: boolean) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ is_alumni: !isAlumni })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, is_alumni: !isAlumni } : m
      )
    );
    setUpdating(null);
  }

  const filtered = members.filter(
    (m) =>
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const tierLabels: Record<number, string> = {
    1: "T1 · Admin",
    2: "T2 · Exec",
    3: "T3 · Member",
    4: "T4 · General",
  };

  const tierColors: Record<number, string> = {
    1: "text-red-400",
    2: "text-[var(--color-brand-yellow)]",
    3: "text-[var(--color-brand-blue)]",
    4: "text-[var(--color-text-muted)]",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Member Management
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {members.length} total accounts
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md pl-9 pr-4 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
          placeholder="Search by name or email..."
        />
      </div>

      {loading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading members...
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Member
                </th>
                <th className="text-left px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-left px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Level
                </th>
                <th className="text-left px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  ₮ Balance
                </th>
                <th className="text-left px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-[var(--glass-border)] last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-[var(--color-text-primary)]">
                        {member.display_name}
                      </p>
                      <p className="text-xs font-mono text-[var(--color-text-muted)]">
                        {member.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span
                        className={`font-mono text-xs ${tierColors[member.tier]}`}
                      >
                        {tierLabels[member.tier]}
                      </span>
                      <div className="flex flex-col ml-1">
                        <button
                          onClick={() =>
                            member.tier > 1 &&
                            updateTier(
                              member.id,
                              (member.tier - 1) as Tier
                            )
                          }
                          disabled={member.tier <= 1 || updating === member.id}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() =>
                            member.tier < 4 &&
                            updateTier(
                              member.id,
                              (member.tier + 1) as Tier
                            )
                          }
                          disabled={member.tier >= 4 || updating === member.id}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                      LV{member.level}
                    </span>
                    <span className="font-mono text-[0.6rem] text-[var(--color-text-muted)] ml-1">
                      ({member.xp.toLocaleString()} XP)
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[var(--color-brand-yellow)]">
                      ₮{member.tethos_coins.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {member.is_active ? (
                        <span className="text-[0.6rem] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-[0.6rem] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      {member.is_alumni && (
                        <span className="text-[0.6rem] font-mono text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10 px-2 py-0.5 rounded">
                          Alumni
                        </span>
                      )}
                      {!member.onboarding_completed && (
                        <span className="text-[0.6rem] font-mono text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10 px-2 py-0.5 rounded">
                          Onboarding
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          toggleActive(member.id, member.is_active)
                        }
                        disabled={updating === member.id}
                        className="text-[0.65rem] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                      >
                        {member.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() =>
                          toggleAlumni(member.id, member.is_alumni)
                        }
                        disabled={updating === member.id}
                        className="text-[0.65rem] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                      >
                        {member.is_alumni ? "Unmark Alumni" : "Mark Alumni"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
