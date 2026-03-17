"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Swords,
  Calendar,
  LayoutGrid,
  ShoppingBag,
  Briefcase,
  Users,
  Wrench,
  Target,
  Trophy,
  Palette,
  Handshake,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { canAccessFeature, type Tier } from "@/lib/supabase/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  feature?: string;
}

const coreItems: NavItem[] = [
  { label: "Home", href: "/student/dashboard", icon: <Home size={18} /> },
  {
    label: "Bounty Board",
    href: "/student/dashboard/bounty",
    icon: <Swords size={18} />,
    feature: "bounty_board",
  },
  {
    label: "Calendar",
    href: "/student/dashboard/calendar",
    icon: <Calendar size={18} />,
    feature: "calendar",
  },
  {
    label: "Kanban",
    href: "/student/dashboard/kanban",
    icon: <LayoutGrid size={18} />,
    feature: "kanban",
  },
  {
    label: "Marketplace",
    href: "/student/dashboard/marketplace",
    icon: <ShoppingBag size={18} />,
    feature: "marketplace",
  },
  {
    label: "Job Board",
    href: "/student/dashboard/jobs",
    icon: <Briefcase size={18} />,
    feature: "job_board",
  },
  {
    label: "Directory",
    href: "/student/dashboard/directory",
    icon: <Users size={18} />,
    feature: "directory",
  },
  {
    label: "Tools",
    href: "/student/dashboard/tools",
    icon: <Wrench size={18} />,
    feature: "tools",
  },
  {
    label: "Quests",
    href: "/student/dashboard/quests",
    icon: <Target size={18} />,
    feature: "quests",
  },
  {
    label: "Leaderboard",
    href: "/student/dashboard/leaderboard",
    icon: <Trophy size={18} />,
    feature: "leaderboard",
  },
];

const personalItems: NavItem[] = [
  {
    label: "Portfolio",
    href: "/student/dashboard/portfolio",
    icon: <Palette size={18} />,
    feature: "portfolio",
  },
  {
    label: "Mentorship",
    href: "/student/dashboard/mentorship",
    icon: <Handshake size={18} />,
    feature: "mentorship",
  },
  {
    label: "Profile",
    href: "/student/dashboard/profile",
    icon: <User size={18} />,
  },
];

const adminItems: NavItem[] = [
  {
    label: "Admin",
    href: "/student/dashboard/admin",
    icon: <Settings size={18} />,
    feature: "admin",
  },
];

export default function DashboardSidebar({ tier }: { tier: Tier }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function renderItems(items: NavItem[]) {
    return items
      .filter((item) => !item.feature || canAccessFeature(tier, item.feature))
      .map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/student/dashboard" &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-mono transition-all group ${
              isActive
                ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] shadow-[0_0_8px_rgba(0,47,167,0.2)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.03]"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span
              className={`shrink-0 ${
                isActive
                  ? "text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)] group-hover:text-[var(--color-accent-cyan)]"
              } transition-colors`}
            >
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      });
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[var(--color-bg-alt)] border-r border-[var(--glass-border)] flex flex-col z-40 transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--glass-border)]">
        {!collapsed && (
          <span className="font-mono text-sm font-bold text-[var(--color-brand-blue)] tracking-wider">
            TETHOS
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Core */}
        {renderItems(coreItems)}

        {/* Divider */}
        <div className="my-3 border-t border-[var(--glass-border)]" />

        {/* Personal */}
        {!collapsed && (
          <div className="px-3 py-1 text-[0.65rem] font-mono text-[var(--color-text-muted)]/50 uppercase tracking-widest">
            Personal
          </div>
        )}
        {renderItems(personalItems)}

        {/* Admin */}
        {canAccessFeature(tier, "admin") && (
          <>
            <div className="my-3 border-t border-[var(--glass-border)]" />
            {!collapsed && (
              <div className="px-3 py-1 text-[0.65rem] font-mono text-[var(--color-text-muted)]/50 uppercase tracking-widest">
                Admin
              </div>
            )}
            {renderItems(adminItems)}
          </>
        )}
      </nav>

      {/* Bottom: version */}
      <div className="px-4 py-3 border-t border-[var(--glass-border)]">
        {!collapsed && (
          <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]/40">
            TSI-SYS v3.2.1
          </span>
        )}
      </div>
    </aside>
  );
}
