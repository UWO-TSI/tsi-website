"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Announcement {
  id: string;
  title: string;
  body: string;
  urgency: "info" | "warning" | "critical";
  is_banner: boolean;
  expires_at: string | null;
  created_at: string;
}

const urgencyConfig = {
  info: {
    bg: "bg-[var(--color-brand-blue)]/10",
    border: "border-[var(--color-brand-blue)]/30",
    text: "text-[var(--color-brand-blue)]",
    icon: <Info size={16} />,
  },
  warning: {
    bg: "bg-[var(--color-brand-yellow)]/10",
    border: "border-[var(--color-brand-yellow)]/30",
    text: "text-[var(--color-brand-yellow)]",
    icon: <AlertTriangle size={16} />,
  },
  critical: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: <AlertCircle size={16} />,
  },
};

export default function AnnouncementBanner({ userId }: { userId: string }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function fetchBanner() {
      const supabase = createClient();

      // Get active banner announcement
      const { data: banners } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_banner", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!banners || banners.length === 0) return;

      // Check if user already dismissed it
      const { data: dismissal } = await supabase
        .from("announcement_dismissals")
        .select("id")
        .eq("announcement_id", banners[0].id)
        .eq("user_id", userId)
        .single();

      if (!dismissal) {
        setAnnouncement(banners[0]);
      }
    }

    fetchBanner();
  }, [userId]);

  async function handleDismiss() {
    if (!announcement) return;

    setDismissed(true);

    const supabase = createClient();
    await supabase.from("announcement_dismissals").insert({
      announcement_id: announcement.id,
      user_id: userId,
    });
  }

  if (!announcement || dismissed) return null;

  const config = urgencyConfig[announcement.urgency];

  return (
    <div
      className={`${config.bg} border-b ${config.border} px-6 py-3 flex items-center gap-3`}
    >
      <span className={config.text}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-bold ${config.text}`}>
          {announcement.title}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)] ml-2">
          {announcement.body}
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
