"use client";

import { useState, useEffect } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";

interface AdminMember {
  id: string;
  display_name: string;
  email: string;
  tier: Tier;
  membership: "member" | "public";
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
    // Emails are server-only; /api/admin/members reads them after a tier check.
    const res = await fetch("/api/admin/members");
    const body = res.ok ? await res.json() : null;
    setMembers((body?.members as AdminMember[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    fetchMembers();
  }, []);

  // tier / is_active / is_alumni are server-only (#40): write through the T1/T2 route.
  async function updateMember(memberId: string, patch: Partial<Pick<AdminMember, "tier" | "is_active" | "is_alumni">>) {
    setUpdating(memberId);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...patch } : m)));
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? "Couldn't save the change.");
    }
    setUpdating(null);
  }

  // Ruling 1: T1/T2 mark who is a TSI member. The route moves the tier with it (public = T5, marked = T4).
  async function setMembership(member: AdminMember, membership: AdminMember["membership"]) {
    setUpdating(member.id);
    const res = await fetch(`/api/admin/members/${member.id}/membership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membership }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, membership: body.member.membership, tier: body.member.tier } : m)));
    } else {
      alert(body?.error ?? "Couldn't save the change.");
    }
    setUpdating(null);
  }

  const updateTier = (memberId: string, tier: Tier) => updateMember(memberId, { tier });
  const toggleActive = (memberId: string, isActive: boolean) => updateMember(memberId, { is_active: !isActive });
  const toggleAlumni = (memberId: string, isAlumni: boolean) => updateMember(memberId, { is_alumni: !isAlumni });

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
    5: "T5 · Public",
  };

  const tierColors: Record<number, string> = {
    1: "text-[var(--gui-danger)]",
    2: "text-[var(--color-brand-yellow)]",
    3: "text-[var(--color-brand-blue)]",
    4: "text-[var(--color-text-muted)]",
    5: "text-[var(--color-text-muted)]",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Member Management
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {members.length} total accounts · {members.filter((m) => m.membership === "member").length} members
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
          className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md pl-9 pr-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
          placeholder="Search by name or email..."
        />
      </div>

      {loading ? (
        <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading members...
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Member
                </th>
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Membership
                </th>
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Level
                </th>
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  ₮ Balance
                </th>
                <th className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
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
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {member.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span
                        className={` text-xs ${tierColors[member.tier]}`}
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
                    <div className="flex items-center gap-2">
                      {member.membership === "member" ? (
                        <span className="text-xs text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10 px-2 py-0.5 rounded">
                          Member
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--surface-hover)] px-2 py-0.5 rounded">
                          Public
                        </span>
                      )}
                      {member.tier >= 4 ? (
                        <button
                          onClick={() => setMembership(member, member.membership === "member" ? "public" : "member")}
                          disabled={updating === member.id}
                          className="text-xs text-[var(--color-accent-cyan)] hover:underline disabled:opacity-50"
                        >
                          {member.membership === "member" ? "Make public" : "Mark member"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      LV{member.level}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      ({member.xp.toLocaleString()} XP)
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--color-brand-yellow)]">
                      ₮{member.tethos_coins.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {member.is_active ? (
                        <span className="text-xs text-[var(--gui-success)] bg-[var(--gui-success-soft)] px-2 py-0.5 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--gui-danger)] bg-[var(--gui-danger-soft)] px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      {member.is_alumni && (
                        <span className="text-xs text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10 px-2 py-0.5 rounded">
                          Alumni
                        </span>
                      )}
                      {!member.onboarding_completed && (
                        <span className="text-xs text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10 px-2 py-0.5 rounded">
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
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                      >
                        {member.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() =>
                          toggleAlumni(member.id, member.is_alumni)
                        }
                        disabled={updating === member.id}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
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
