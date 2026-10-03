"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TIER_LABELS, getXpProgress } from "./types";
import { CLASS_META, ClassBadge, TIER_LOOK } from "./classIdentity";
import { Badge, Progress } from "@/components/gui";
import type { DirectoryMember } from "@/lib/supabase/types";

interface MemberCardProps {
  member: DirectoryMember;
}

export default function MemberCard({ member }: MemberCardProps) {
  const router = useRouter();
  const tier = TIER_LOOK[member.tier];
  const xp = getXpProgress(member.xp, member.level);
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
      className="flex items-center cursor-pointer transition-colors border-b-2 border-dashed border-[var(--gui-paper-edge)] last:border-b-0 hover:bg-[var(--gui-paper-warm)]"
      style={{ minHeight: "64px", padding: "8px 14px", gap: "12px" }}
      onClick={() => router.push(`/student/dashboard/directory/${member.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/student/dashboard/directory/${member.id}`); }}
    >
      {/* Avatar */}
      <div className="shrink-0 rounded-full flex items-center justify-center overflow-hidden"
        style={{ width: "40px", height: "40px", border: `2.5px solid ${tier.ring}`, background: "var(--gui-paper-deep)", fontSize: "13px", fontWeight: 800, color: "var(--gui-ink-2)" }}>
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.display_name} className="w-full h-full rounded-full object-cover" />
        ) : initials}
      </div>

      {/* Name + Class */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="truncate" style={{ fontSize: "15px", fontWeight: 800, color: member.is_active ? "var(--gui-ink-strong)" : "var(--gui-muted)" }}>
          {member.display_name}
        </span>
        <span className="truncate" style={{ fontSize: "13px", fontWeight: 700, color: "var(--gui-muted)" }}>
          {/* Class flair per ux-classes.md §4.2: the family chip, then its name in ink */}
          {member.class && CLASS_META[member.class] ? (
            <ClassBadge cls={member.class} iconSize={12} fontSize={13} />
          ) : (
            member.class || member.position || "Unclassed"
          )}
        </span>
      </div>

      {/* Tier tag */}
      <Badge tone={tier.tone} className="shrink-0" aria-label={`Tier ${member.tier}`} title={`Tier ${member.tier} · ${TIER_LABELS[member.tier]}`}>
        T{member.tier}
      </Badge>

      {/* Level */}
      <span className="shrink-0 text-right" style={{ width: "48px", fontSize: "14px", fontWeight: 800, color: "var(--gui-ink-2)" }}>
        Lv {member.level}
      </span>

      {/* XP Bar */}
      <div className="hidden sm:block shrink-0" style={{ width: "80px" }}>
        <Progress kind="xp" value={xp.current} max={xp.needed} size={8}
          label={`${member.display_name}, level ${member.level}`} valueText={`${xp.current.toLocaleString()} of ${xp.needed.toLocaleString()} XP`} />
      </div>

      <ChevronRight aria-hidden className="shrink-0" style={{ width: "18px", height: "18px", color: "var(--gui-muted)" }} />
    </div>
  );
}
