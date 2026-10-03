"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/portal/UserContext";
import Link from "next/link";
import {
  Users,
  Megaphone,
  Target,
  Swords,
  ShoppingBag,
  BarChart3,
  Lock,
  Vote,
  MessageSquareWarning,
} from "lucide-react";
import NPCSpendWidget from "@/components/portal/NPCSpendWidget";
import GameContentIndex from "@/components/portal/GameContentIndex";
import { Card, Empty } from "@/components/gui";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalBounties: number;
  openBounties: number;
  totalTC: number;
  activeQuests: number;
}

/** The icon chip behind each tool: a soft fill with its ink. */
const TONES: Record<string, CSSProperties> = {
  sage: { background: "var(--gui-sage-soft)", color: "var(--gui-sage-deep)" },
  warn: { background: "var(--gui-warn-soft)", color: "var(--gui-warn)" },
  info: { background: "var(--gui-info-soft)", color: "var(--gui-info)" },
  danger: { background: "var(--gui-danger-soft)", color: "var(--gui-danger)" },
  success: { background: "var(--gui-success-soft)", color: "var(--gui-success)" },
  butter: { background: "var(--gui-butter)", color: "var(--gui-ink-strong)" },
};

const adminSections = [
  {
    title: "Members",
    description: "Accounts, tiers and who’s a member",
    icon: <Users size={22} aria-hidden />,
    href: "/student/dashboard/admin/members",
    tone: "sage",
  },
  {
    title: "Announcements",
    description: "Post news and banners for the club",
    icon: <Megaphone size={22} aria-hidden />,
    href: "/student/dashboard/admin/announcements",
    tone: "warn",
  },
  {
    title: "Quests",
    description: "Make quests and set their rewards",
    icon: <Target size={22} aria-hidden />,
    href: "/student/dashboard/admin/quests",
    tone: "info",
  },
  {
    title: "Bounties",
    description: "Approve postings and review delivered work",
    icon: <Swords size={22} aria-hidden />,
    href: "/student/dashboard/admin/bounties",
    tone: "butter",
  },
  {
    title: "Marketplace",
    description: "Items, prices and orders to hand over",
    icon: <ShoppingBag size={22} aria-hidden />,
    href: "/student/dashboard/admin/marketplace",
    tone: "butter",
  },
  {
    title: "Analytics",
    description: "Members, rewards and orders at a glance",
    icon: <BarChart3 size={22} aria-hidden />,
    href: "/student/dashboard/admin/analytics",
    tone: "success",
  },
  {
    title: "Election",
    description: "Presidential election results",
    icon: <Vote size={22} aria-hidden />,
    href: "/student/dashboard/admin/election",
    tone: "info",
  },
  {
    title: "Resident chats",
    description: "Flagged chats with the island’s residents",
    icon: <MessageSquareWarning size={22} aria-hidden />,
    href: "/student/dashboard/admin/npc-conversations",
    tone: "danger",
  },
];

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const { profile } = useUser();
  const userTier = profile?.tier ?? 4;

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          The admin tools are for the club’s admins. If something here needs changing, ask one of them.
        </Empty>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">
          Look after the members, the posts, the rewards and the island’s content.
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            {
              label: "Active members",
              value: stats.activeMembers,
              total: stats.totalMembers,
            },
            {
              label: "Open bounties",
              value: stats.openBounties,
              total: stats.totalBounties,
            },
            { label: "Active quests", value: stats.activeQuests },
          ].map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm font-bold text-[var(--gui-ink-2)]">{stat.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--gui-ink-strong)]">
                {stat.value}
                {stat.total !== undefined && (
                  <span className="ml-1.5 text-sm font-bold text-[var(--gui-muted)]">of {stat.total}</span>
                )}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Spend widget: T1/T2, as /api/npc/spend allows (the page is already T1/T2 only) */}
      <div className="mb-6">
        <NPCSpendWidget />
      </div>

      <GameContentIndex />

      <h2 className="mb-3 text-base font-extrabold text-[var(--gui-ink-strong)]">Club portal</h2>
      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="block rounded-[18px] transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full">
              <span
                className="mb-3 grid h-11 w-11 place-items-center rounded-[var(--gui-r-blob)]"
                style={TONES[section.tone]}
              >
                {section.icon}
              </span>
              <h3 className="text-base font-extrabold text-[var(--gui-ink-strong)]">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--gui-ink-2)]">
                {section.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
