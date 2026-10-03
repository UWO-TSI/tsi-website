"use client";

import { useState, useEffect } from "react";
import { Search, SearchX, ChevronUp, ChevronDown } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";
import { Amount } from "@/components/economy/Amount";
import { Badge, Card, Empty, ErrorNote, Loading, type BadgeTone } from "@/components/gui";

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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const th = "px-4 py-3 text-xs font-extrabold text-[var(--gui-ink-2)] whitespace-nowrap";
const rowAction = "text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)] hover:underline disabled:opacity-50 disabled:no-underline";
const chevron = "grid place-items-center rounded-md text-[var(--gui-ink-2)] hover:bg-[var(--gui-paper-deep)] hover:text-[var(--gui-ink-strong)] disabled:opacity-30 disabled:hover:bg-transparent";

const TIER_TONES: Record<number, BadgeTone> = { 1: "gold", 2: "sage", 3: "info", 4: "neutral", 5: "neutral" };

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function fetchMembers() {
    // Emails are server-only; /api/admin/members reads them after a tier check.
    try {
      const res = await fetch("/api/admin/members");
      const body = res.ok ? await res.json() : null;
      setMembers((body?.members as AdminMember[]) ?? []);
      setLoadFailed(!body?.members);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  // tier / is_active / is_alumni are server-only (#40): write through the T1/T2 route.
  async function updateMember(memberId: string, patch: Partial<Pick<AdminMember, "tier" | "is_active" | "is_alumni">>) {
    setUpdating(memberId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...patch } : m)));
      } else {
        const body = await res.json().catch(() => null);
        setSaveError(body?.error ?? "Couldn’t save the change.");
      }
    } catch {
      setSaveError("Couldn’t reach the server. Try again.");
    } finally {
      setUpdating(null);
    }
  }

  // Ruling 1: T1/T2 mark who is a TSI member. The route moves the tier with it (public = T5, marked = T4).
  async function setMembership(member: AdminMember, membership: AdminMember["membership"]) {
    setUpdating(member.id);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/membership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membership }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, membership: body.member.membership, tier: body.member.tier } : m)));
      } else {
        setSaveError(body?.error ?? "Couldn’t save the change.");
      }
    } catch {
      setSaveError("Couldn’t reach the server. Try again.");
    } finally {
      setUpdating(null);
    }
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

  return (
    <div className={PAGE}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Members</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">
          {members.length} accounts · {members.filter((m) => m.membership === "member").length} marked as members
        </p>
      </div>

      <div className="relative mb-4">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gui-muted)]"
        />
        <input
          type="search"
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-12 w-full rounded-[18px_15px_17px_16px] border-2 border-[var(--gui-paper-line)] bg-[var(--gui-paper-hi)] py-2.5 pl-11 pr-4 text-base text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)] focus:border-[var(--gui-sage)] transition-colors"
          placeholder="Search by name or email"
        />
      </div>

      {saveError && <ErrorNote className="sticky top-16 z-10 mb-4 shadow-[var(--gui-shadow-md)]">{saveError}</ErrorNote>}

      {loading ? (
        <Loading label="Getting the member list…" />
      ) : loadFailed ? (
        <ErrorNote onRetry={() => { setLoading(true); void fetchMembers(); }}>
          The member list didn’t load.
        </ErrorNote>
      ) : filtered.length === 0 ? (
        <Empty icon={<SearchX size={32} />} title={search ? "No one matches that search" : "No accounts yet"}>
          {search ? "Try part of their name or email." : "Accounts show up here once people sign in."}
        </Empty>
      ) : (
        <Card style={{ padding: 0 }} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--gui-paper-warm)]">
                <th className={`${th} text-left`}>Member</th>
                <th className={`${th} text-left`}>Tier</th>
                <th className={`${th} text-left`}>Membership</th>
                <th className={`${th} text-left`}>Level</th>
                <th className={`${th} text-left`}>Gems</th>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.id}
                  className="border-t-2 border-dashed border-[var(--gui-paper-edge)] hover:bg-[var(--gui-paper-warm)]"
                >
                  <td className="px-4 py-3">
                    <p className="font-extrabold text-[var(--gui-ink-strong)]">
                      {member.display_name}
                    </p>
                    <p className="text-xs text-[var(--gui-muted)]">
                      {member.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={TIER_TONES[member.tier] ?? "neutral"}>
                        {tierLabels[member.tier]}
                      </Badge>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() =>
                            member.tier > 1 &&
                            updateTier(
                              member.id,
                              (member.tier - 1) as Tier
                            )
                          }
                          disabled={member.tier <= 1 || updating === member.id}
                          aria-label={`Move ${member.display_name} up a tier`}
                          title="Move up a tier"
                          className={chevron}
                        >
                          <ChevronUp size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            member.tier < 4 &&
                            updateTier(
                              member.id,
                              (member.tier + 1) as Tier
                            )
                          }
                          disabled={member.tier >= 4 || updating === member.id}
                          aria-label={`Move ${member.display_name} down a tier`}
                          title="Move down a tier"
                          className={chevron}
                        >
                          <ChevronDown size={16} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {member.membership === "member" ? (
                        <Badge tone="sage">Member</Badge>
                      ) : (
                        <Badge>Public</Badge>
                      )}
                      {member.tier >= 4 ? (
                        <button
                          type="button"
                          onClick={() => setMembership(member, member.membership === "member" ? "public" : "member")}
                          disabled={updating === member.id}
                          className="text-sm font-bold text-[var(--gui-sage)] hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          {member.membership === "member" ? "Make public" : "Mark as member"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-[var(--gui-ink)]">
                      Level {member.level}
                    </span>
                    <span className="ml-1 text-[var(--gui-muted)]">
                      ({member.xp.toLocaleString()} XP)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--gui-ink)]">
                    <Amount n={member.tethos_coins} currency="gems" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {member.is_active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="danger">Inactive</Badge>
                      )}
                      {member.is_alumni && <Badge tone="gold">Alumni</Badge>}
                      {!member.onboarding_completed && (
                        <Badge tone="info">Onboarding</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          toggleActive(member.id, member.is_active)
                        }
                        disabled={updating === member.id}
                        className={rowAction}
                      >
                        {member.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleAlumni(member.id, member.is_alumni)
                        }
                        disabled={updating === member.id}
                        className={rowAction}
                      >
                        {member.is_alumni ? "Unmark alumni" : "Mark as alumni"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
