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
  X,
} from "lucide-react";
import type { ComponentType } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/student/dashboard", icon: Home },
  { label: "Directory", href: "/student/dashboard/directory", icon: Users },
  { label: "Bounty Board", href: "/student/dashboard/bounty", icon: Scroll, comingSoon: true },
  { label: "Shop", href: "/student/dashboard/shop", icon: ShoppingBag, comingSoon: true },
  { label: "Job Board", href: "/student/dashboard/jobs", icon: Briefcase, comingSoon: true },
  { label: "Leaderboard", href: "/student/dashboard/leaderboard", icon: Trophy, comingSoon: true },
  { label: "Profile", href: "/student/dashboard/profile", icon: User },
  { label: "Settings", href: "/student/dashboard/settings", icon: Settings, comingSoon: true },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();

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
            Player
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
            }}
          >
            Lv. 1
          </p>
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
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
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
                  ? "rgba(255, 255, 255, 0.06)"
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
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
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
                    background: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "9999px",
                    padding: "1px 6px",
                  }}
                >
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
