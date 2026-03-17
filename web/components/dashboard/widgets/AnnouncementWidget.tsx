"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  urgency: string;
  created_at: string;
}

const urgencyColors: Record<string, string> = {
  info: "text-[var(--color-brand-blue)]",
  warning: "text-[var(--color-brand-yellow)]",
  critical: "text-red-400",
};

export default function AnnouncementWidget({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          Announcements
        </h3>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-4">
          <Megaphone
            size={24}
            className="mx-auto text-[var(--color-text-muted)]/30 mb-2"
          />
          <p className="text-xs font-mono text-[var(--color-text-muted)]">
            No announcements
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="group">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[0.6rem] font-mono uppercase ${
                    urgencyColors[ann.urgency] ?? "text-[var(--color-text-muted)]"
                  }`}
                >
                  {ann.urgency}
                </span>
                <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)]/50">
                  {new Date(ann.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {ann.title}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                {ann.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
