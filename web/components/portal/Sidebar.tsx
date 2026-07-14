"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Users,
  Scroll,
  ShoppingBag,
  Briefcase,
  Trophy,
  User,
  Settings,
  Shield,
  ClipboardList,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { useUser } from "./UserContext";
import { ClassBadge } from "./classIdentity";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/student/dashboard", icon: Home },
  { label: "Directory", href: "/student/dashboard/directory", icon: Users },
  { label: "Bounty Board", href: "/student/dashboard/bounty", icon: Scroll },
  { label: "Shop", href: "/student/dashboard/shop", icon: ShoppingBag },
  { label: "Job Board", href: "/student/dashboard/jobs", icon: Briefcase },
  { label: "Leaderboard", href: "/student/dashboard/leaderboard", icon: Trophy },
  { label: "Profile", href: "/student/dashboard/profile", icon: User },
  { label: "Settings", href: "/student/dashboard/settings", icon: Settings },
];

// Tier gate matches the admin hub page itself (userTier > 2 → Access Denied),
// so nobody sees a link they can't use.
const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Admin Tools",
    href: "/student/dashboard/admin",
    icon: Shield,
  },
  {
    // Recruitment kanban as a portal subtab (David, 2026-07-14) — mounts
    // the live /admin/recruit board inside the dashboard shell.
    label: "Recruitment",
    href: "/student/dashboard/admin/recruitment",
    icon: ClipboardList,
  },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile } = useUser();
  const userName = profile?.display_name || "Player";
  const userLevel = profile?.level ?? 1;

  const isActive = (href: string) => {
    if (href === "/student/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="w-[240px] h-full flex flex-col shrink-0 overflow-y-auto"
      style={{
        background: "var(--color-surface)",
        borderRight: "1px solid var(--glass-border-soft)",
      }}
    >
      {/* Player Status */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: "16px 8px 12px",
          marginBottom: "16px",
          borderBottom: "1px solid var(--glass-border-soft)",
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--color-bg-alt)" }}
        >
          <User className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm truncate"
            style={{ color: "var(--color-text-main)", fontWeight: 700 }}
          >
            {userName}
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
            }}
          >
            Lv. {userLevel}
          </p>
          {/* Class flair per ux-classes.md §4.1 — cosmetic only (principle #4) */}
          <ClassBadge cls={profile?.class} iconSize={14} fontSize={12} />
        </div>
        {/* Close button — only visible in mobile overlay */}
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--color-text-main)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--color-text-muted)")
            }
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            onClose={onClose}
          />
        ))}

        {/* Admin section — T1/T2 only, matching the admin hub's own gate */}
        {(profile?.tier ?? 99) <= 2 && (
          <>
            <div
              className="font-mono uppercase tracking-wider"
              style={{
                fontSize: "10px",
                color: "var(--color-text-subtle)",
                padding: "12px 12px 4px",
                marginTop: "8px",
                borderTop: "1px solid var(--glass-border-soft)",
              }}
            >
              Admin
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={
                  // exact-section match: "Admin Tools" must not light up
                  // when the Recruitment subtab (a child path) is active
                  item.href === "/student/dashboard/admin"
                    ? pathname.startsWith(item.href) &&
                      !pathname.startsWith("/student/dashboard/admin/recruitment")
                    : isActive(item.href)
                }
                onClose={onClose}
              />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}

function NavLink({
  item,
  active,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  onClose?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="flex items-center gap-3 rounded-lg transition-[background,color]"
      style={{
        height: "40px",
        padding: "0 12px",
        paddingLeft: active ? "10px" : "12px",
        borderLeft: active
          ? "2px solid var(--color-brand-blue)"
          : "2px solid transparent",
        background: active
          ? "var(--surface-chip)"
          : "transparent",
        color: active
          ? "var(--color-text-main)"
          : "var(--color-text-muted)",
        borderRadius: "8px",
        transitionDuration: "0.15s",
        transitionTimingFunction: "ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--color-text-soft)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text-muted)";
        }
      }}
    >
      <Icon
        className="shrink-0"
        style={{ width: "18px", height: "18px" }}
      />
      <span className="text-sm flex-1 truncate" style={{ fontWeight: 400 }}>
        {item.label}
      </span>
      {item.comingSoon && (
        <span
          className="font-mono shrink-0"
          style={{
            fontSize: "12px",
            color: "var(--color-text-subtle)",
            background: "var(--surface-chip)",
            borderRadius: "9999px",
            padding: "1px 6px",
          }}
        >
          Soon
        </span>
      )}
    </Link>
  );
}
