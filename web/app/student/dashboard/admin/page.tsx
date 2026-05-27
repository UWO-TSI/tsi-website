"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Users,
  Megaphone,
  Target,
  Swords,
  ShoppingBag,
  BarChart3,
  Shield,
  Vote,
  Sparkles,
} from "lucide-react";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalBounties: number;
  openBounties: number;
  totalTC: number;
  activeQuests: number;
}

const adminSections = [
  {
    title: "Members",
    description: "Manage member accounts, tiers, and teams",
    icon: <Users size={20} />,
    href: "/student/dashboard/admin/members",
    color: "var(--color-brand-blue)",
  },
  {
    title: "Announcements",
    description: "Create and manage announcements and banners",
    icon: <Megaphone size={20} />,
    href: "/student/dashboard/admin/announcements",
    color: "var(--color-brand-yellow)",
  },
  {
    title: "Quests",
    description: "Create quests and manage rewards",
    icon: <Target size={20} />,
    href: "/student/dashboard/admin/quests",
    color: "var(--color-accent-cyan)",
  },
  {
    title: "Bounties",
    description: "Approve and manage bounty submissions",
    icon: <Swords size={20} />,
    href: "/student/dashboard/admin/bounties",
    color: "#f87171",
  },
  {
    title: "Marketplace",
    description: "Manage items, prices, and fulfillment",
    icon: <ShoppingBag size={20} />,
    href: "/student/dashboard/admin/marketplace",
    color: "#a78bfa",
  },
  {
    title: "Analytics",
    description: "View engagement, economy, and usage data",
    icon: <BarChart3 size={20} />,
    href: "/student/dashboard/admin/analytics",
    color: "#34d399",
  },
  {
    title: "Election",
    description: "View presidential election results",
    icon: <Vote size={20} />,
    href: "/student/dashboard/admin/election",
    color: "var(--color-accent-cyan)",
  },
  {
    title: "Content",
    description: "NPCs, shop items, palettes, events (read-only)",
    icon: <Sparkles size={20} />,
    href: "/student/dashboard/admin/content/npcs",
    color: "#f59e0b",
  },
];

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [userTier, setUserTier] = useState<number>(4);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();

      if (profile) setUserTier(profile.tier);

      // Fetch stats in parallel
      const [members, bounties, quests] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, is_active", { count: "exact" }),
        supabase.from("bounties").select("id, status", { count: "exact" }),
        supabase
          .from("quests")
          .select("id", { count: "exact" })
          .eq("is_active", true),
      ]);

      const activeCount =
        members.data?.filter((m) => m.is_active).length ?? 0;
      const openBountyCount =
        bounties.data?.filter((b) => b.status === "open").length ?? 0;

      setStats({
        totalMembers: members.count ?? 0,
        activeMembers: activeCount,
        totalBounties: bounties.count ?? 0,
        openBounties: openBountyCount,
        totalTC: 0, // Would need aggregate query
        activeQuests: quests.count ?? 0,
      });
    }

    fetchStats();
  }, []);

  if (userTier > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto text-[var(--color-text-muted)]/20 mb-4"
          />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-sm font-mono text-[var(--color-text-muted)]">
            T1/T2 clearance required for admin access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Admin Panel
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          System management · T{userTier} access
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Active Members",
              value: stats.activeMembers,
              total: stats.totalMembers,
            },
            {
              label: "Open Bounties",
              value: stats.openBounties,
              total: stats.totalBounties,
            },
            { label: "Active Quests", value: stats.activeQuests },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
            >
              <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
                {stat.value}
                {stat.total !== undefined && (
                  <span className="text-sm text-[var(--color-text-muted)] font-normal">
                    /{stat.total}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {adminSections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5 hover:border-[var(--glass-border)] hover:shadow-[0_0_12px_rgba(0,47,167,0.1)] transition-all group"
          >
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center mb-3"
              style={{
                backgroundColor: `color-mix(in srgb, ${section.color} 15%, transparent)`,
                color: section.color,
              }}
            >
              {section.icon}
            </div>
            <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)] mb-1">
              {section.title}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
