"use client";

/**
 * Recruitment admin as a portal subtab (David, 2026-07-14).
 *
 * Thin wrapper that mounts the existing /admin/recruit page (the live
 * recruitment kanban — dashboard/board/insights tabs) INSIDE the student
 * dashboard shell, so admins reach it from the sidebar without leaving
 * the portal. The recruit page stays the single source of truth: its own
 * auth + /api/applications 403 handling still run; this wrapper only
 * adds the portal's T1/T2 gate so lower tiers get the standard friendly
 * Access Denied instead of an API bounce to the marketing site.
 */

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AdminRecruitPage from "@/app/admin/recruit/page";

export default function RecruitmentAdminTab() {
  // null = still checking; matches the admin hub's gate semantics after load
  const [userTier, setUserTier] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTier() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserTier(99);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      // Whitelisted recruitment admins pass regardless of portal tier; the
      // /api/applications routes enforce the same whitelist server-side.
      const me = await fetch("/api/admin/me")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      setUserTier(me?.isAdmin ? 1 : (profile?.tier ?? 99));
    }
    fetchTier();
  }, []);

  if (userTier === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm font-mono text-[var(--color-text-muted)]">
          Checking clearance…
        </p>
      </div>
    );
  }

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
            T1/T2 clearance required for recruitment admin.
          </p>
        </div>
      </div>
    );
  }

  return <AdminRecruitPage />;
}
