"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  TIER_COLORS,
  getXpProgress,
  type DirectoryMember,
} from "./types";

/**
 * MemberCard — Row-style layout per specs/ux-directory.md Section 4.
 * 64px height, horizontal: avatar | name+class | tier badge | level | XP bar | arrow
 */

interface MemberCardProps {
  member: DirectoryMember;
}

export default function MemberCard({ member }: MemberCardProps) {
  const router = useRouter();
  const tc = TIER_COLORS[member.tier];
  const xp = getXpProgress(member.xp);
  const initials = member.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      role="option"
      tabIndex={0}
      className="flex items-center cursor-pointer transition-[background] outline-none focus:outline-2 focus:outline-offset-2"
      style={{
        height: "64px",
        padding: "0 16px",
        gap: "12px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
        background: "transparent",
        outlineColor: "var(--color-brand-blue)",
      }}
      onClick={() => router.push(`/student/dashboard/directory/${member.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/student/dashboard/directory/${member.id}`);
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: "40px",
          height: "40px",
          border: `2px solid ${tc.border}`,
          background: "var(--color-surface)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--color-text-muted)",
        }}
      >
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar_url}
            alt={member.display_name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Name + Class */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className="truncate"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: member.is_active
              ? "var(--color-text-main)"
              : "var(--color-text-subtle)",
          }}
        >
          {member.display_name}
        </span>
        <span
          className="truncate"
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        >
          {member.class || "Unclassed"}
        </span>
      </div>

      {/* Tier Badge */}
      <span
        className="shrink-0 font-mono"
        style={{
          height: "22px",
          padding: "0 8px",
          fontSize: "12px",
          fontWeight: 600,
          lineHeight: "22px",
          borderRadius: "9999px",
          background: tc.bg,
          color: tc.color,
        }}
        aria-label={`Tier ${member.tier}`}
      >
        T{member.tier}
      </span>

      {/* Level */}
      <span
        className="shrink-0 font-mono text-right"
        style={{
          width: "48px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--color-text-soft)",
        }}
      >
        Lv.{member.level}
      </span>

      {/* XP Bar */}
      <div
        className="shrink-0"
        role="progressbar"
        aria-valuenow={xp.current}
        aria-valuemin={0}
        aria-valuemax={xp.needed}
        style={{ width: "80px", height: "6px", borderRadius: "3px" }}
      >
        <div
          className="h-full rounded-full overflow-hidden"
          style={{ background: "var(--gray-800)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${xp.percent}%`,
              background: "var(--color-brand-blue)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        className="shrink-0"
        style={{
          width: "16px",
          height: "16px",
          color: "var(--color-text-subtle)",
        }}
      />
    </div>
  );
}
