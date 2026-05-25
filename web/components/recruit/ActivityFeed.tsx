"use client";

import { motion } from "framer-motion";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/recruitment";
import type { Application, ApplicationStatus } from "@/lib/recruitment";

interface ActivityFeedProps {
  application: Application;
}

interface Event {
  at: string;
  label: string;
  color: string;
  kind: "submit" | "status";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActivityFeed({ application }: ActivityFeedProps) {
  const events: Event[] = [
    {
      at: application.submitted_at,
      label: "Application submitted",
      color: "#9CA3AF",
      kind: "submit",
    },
  ];

  for (const r of application.releases ?? []) {
    // Waitlist is admin-only context — never surface it to the applicant.
    if (r.new_status === "waitlist") continue;
    events.push({
      at: r.released_at,
      label: `Moved to ${STATUS_LABELS[r.new_status as ApplicationStatus] ?? r.new_status}`,
      color: STATUS_COLORS[r.new_status as ApplicationStatus] ?? "#9CA3AF",
      kind: "status",
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0) return null;

  return (
    <div className="mt-6 pt-6 border-t border-white/5">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B7280] mb-4">
        Activity
      </p>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <motion.li
            key={`${e.at}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
            className="flex items-baseline gap-3"
          >
            <span
              className="flex-shrink-0 w-1.5 h-1.5 rounded-full translate-y-[5px]"
              style={{ background: e.color }}
              aria-hidden
            />
            <span className="text-sm text-[#E5E7EB] flex-1">{e.label}</span>
            <time
              dateTime={e.at}
              title={absoluteTime(e.at)}
              className="font-mono text-[10px] text-[#6B7280] whitespace-nowrap"
            >
              {relativeTime(e.at)}
            </time>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
