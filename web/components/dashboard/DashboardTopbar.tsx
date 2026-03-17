"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, LogOut, User, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function DashboardTopbar({ profile }: { profile: Profile }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    }
    fetchNotifications();
  }, [profile.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/student/login");
    router.refresh();
  }

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <header className="h-14 bg-[var(--color-bg-alt)] border-b border-[var(--glass-border)] flex items-center justify-between px-6">
      {/* Left: Search */}
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent border-none outline-none text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] w-48"
        />
      </div>

      {/* Right: XP + Coins + Notifications + Profile */}
      <div className="flex items-center gap-4">
        {/* XP Badge */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-[var(--color-brand-yellow)]">LV</span>
          <span className="text-[var(--color-text-primary)] font-bold">
            {profile.level}
          </span>
          <span className="text-[var(--color-text-muted)]">
            {profile.rank}
          </span>
        </div>

        {/* Tethos Coins */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-[var(--color-brand-yellow)]">₮</span>
          <span className="text-[var(--color-text-primary)] font-bold">
            {profile.tethos_coins.toLocaleString()}
          </span>
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-brand-blue)] rounded-full text-[0.6rem] flex items-center justify-center text-white font-mono">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
                <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-mono text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs font-mono text-[var(--color-text-muted)]">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-[var(--glass-border)] last:border-b-0 ${
                        !notif.is_read ? "bg-[var(--color-brand-blue)]/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-blue)] mt-1.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm text-[var(--color-text-primary)]">
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              {notif.body}
                            </p>
                          )}
                          <p className="text-[0.6rem] text-[var(--color-text-muted)]/50 mt-1 font-mono">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--color-brand-blue)]/20 border border-[var(--color-brand-blue)]/30 flex items-center justify-center">
              <span className="text-xs font-mono text-[var(--color-brand-blue)]">
                {profile.display_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--glass-border)]">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {profile.display_name}
                </p>
                <p className="text-xs font-mono text-[var(--color-text-muted)]">
                  {profile.class ?? "INITIATE"} · T{profile.tier}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/student/dashboard/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.03] transition-colors"
                >
                  <User size={14} />
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.03] transition-colors w-full text-left"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
