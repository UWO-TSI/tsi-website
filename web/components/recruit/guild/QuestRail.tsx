"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import {
  QUESTS,
  TOTAL_XP,
  CLASS_COLORS,
  initials,
  type Character,
} from "@/lib/guild";
import { CLASS_ICONS } from "./classIcons";

interface QuestRailProps {
  step: number;
  xp: number;
  name: string;
  roleTitle: string;
  character: Character | null;
  onJump: (step: number) => void;
}

/**
 * The character sheet beside the form. Desktop: a sticky column with the
 * avatar, the quest list, and the XP bar. Mobile: one strip with the
 * avatar, the current quest, and the bar.
 */
export default function QuestRail({
  step,
  xp,
  name,
  roleTitle,
  character,
  onJump,
}: QuestRailProps) {
  const color = character ? CLASS_COLORS[character.class] : "#1D9BF0";
  const ClassIcon = character ? CLASS_ICONS[character.class] : null;
  const displayName = name.trim() || "Adventurer";
  const pct = Math.round((xp / TOTAL_XP) * 100);
  const current = QUESTS[step];

  return (
    <>
      {/* Mobile strip */}
      <div
        className="md:hidden flex items-center gap-3 mb-6 p-3 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Avatar color={color} Icon={ClassIcon} name={displayName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F1FFFF] truncate">
            Quest {step + 1} of {QUESTS.length}: {current.name}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <XpBar pct={pct} />
            <span
              className="text-[10px] text-[#FFD166] whitespace-nowrap"
              style={{ fontFamily: "var(--font-highlight)" }}
            >
              {xp} XP
            </span>
          </div>
        </div>
      </div>

      {/* Desktop rail */}
      <aside className="hidden md:block md:sticky md:top-24 self-start">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <Avatar color={color} Icon={ClassIcon} name={displayName} size={48} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#F1FFFF] truncate">
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: character ? color : "#6B7280" }}>
                {character ? `${character.class}, ${character.subclass}` : "Unrolled"}
              </p>
            </div>
          </div>

          <p className="text-xs text-[#6B7280] mb-4 truncate">
            Applying for <span className="text-[#9CA3AF]">{roleTitle}</span>
          </p>

          <ol className="space-y-1 mb-5">
            {QUESTS.map((q, i) => {
              const done = i < step;
              const active = i === step;
              const reachable = i <= step;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && onJump(i)}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                      reachable ? "hover:bg-white/[0.04]" : "cursor-default"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background: done ? "#1D9BF0" : "transparent",
                        border: `1px solid ${
                          done
                            ? "#1D9BF0"
                            : active
                              ? "#F1FFFF"
                              : "rgba(255,255,255,0.15)"
                        }`,
                      }}
                    >
                      {done ? (
                        <Check className="w-3 h-3 text-[#F1FFFF]" />
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: active ? "#F1FFFF" : "transparent",
                          }}
                        />
                      )}
                    </span>
                    <span
                      className={`flex-1 text-sm ${
                        active
                          ? "text-[#F1FFFF]"
                          : done
                            ? "text-[#9CA3AF]"
                            : "text-[#4B5563]"
                      }`}
                    >
                      {q.name}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        fontFamily: "var(--font-highlight)",
                        color: done ? "#FFD166" : "#4B5563",
                      }}
                    >
                      {done ? `+${q.xp}` : q.xp}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-3">
            <XpBar pct={pct} />
            <span
              className="text-xs text-[#FFD166] whitespace-nowrap"
              style={{ fontFamily: "var(--font-highlight)" }}
            >
              {xp} / {TOTAL_XP} XP
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Avatar({
  color,
  Icon,
  name,
  size,
}: {
  color: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  name: string;
  size: number;
}) {
  return (
    <span
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `${color}14`,
        border: `1.5px solid ${Icon ? color : "rgba(255,255,255,0.15)"}`,
        color,
      }}
      aria-hidden
    >
      {Icon ? (
        <Icon className="w-[45%] h-[45%]" style={{ color }} />
      ) : (
        <span
          className="text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-highlight)", fontSize: size * 0.3 }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function XpBar({ pct }: { pct: number }) {
  return (
    <div
      className="relative h-1.5 flex-1 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.06)" }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Experience"
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 160, damping: 24 }}
        style={{ background: "#FFD166" }}
      />
    </div>
  );
}
