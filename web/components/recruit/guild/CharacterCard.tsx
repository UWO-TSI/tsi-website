"use client";

import { motion } from "framer-motion";
import { CLASS_COLORS, type Character } from "@/lib/guild";
import { CLASS_ICONS, SUBCLASS_ICONS } from "./classIcons";

interface CharacterCardProps {
  name: string;
  character: Character;
  roleTitle: string;
  status: string;
  issued: Date;
  xp?: number;
  /** Skip the entrance animation (dashboard lists). */
  still?: boolean;
}

// Low-opacity glyph field behind the card: the brand's ASCII texture rule
// (DESIGN_SYSTEM.md §1.4), tinted in the class color. Deterministic so
// server and client agree.
const GLYPHS = "·:·+·░";
function glyphField(seed: string, rows = 9, cols = 34): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const v = (h >>> 16) % 11;
      line += v < 5 ? " " : GLYPHS[v - 5] ?? " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function formatIssued(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

/**
 * The guild card. One accent (the class color), mono for the fields
 * because a sheet is data, corner marks so it reads as a physical card.
 */
export default function CharacterCard({
  name,
  character,
  roleTitle,
  status,
  issued,
  xp,
  still,
}: CharacterCardProps) {
  const color = CLASS_COLORS[character.class];
  const ClassIcon = CLASS_ICONS[character.class];
  const SubIcon = SUBCLASS_ICONS[character.subclass] ?? ClassIcon;
  const field = glyphField(character.mbti + name);

  const rows: [string, string][] = [
    ["Name", name.trim() || "Adventurer"],
    ["Class", character.class],
    ["Path", character.subclass],
    ["Quest", roleTitle],
    ["Status", status],
    ["Issued", formatIssued(issued)],
  ];

  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 16, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #141416 0%, #0F0F10 100%)",
        border: `1px solid ${color}55`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 30px 60px -30px ${color}66`,
        perspective: 800,
      }}
    >
      <pre
        aria-hidden
        className="absolute inset-0 m-0 p-4 text-[10px] leading-[1.3] select-none pointer-events-none overflow-hidden"
        style={{ color, opacity: 0.09, fontFamily: "var(--font-highlight)" }}
      >
        {field}
      </pre>

      {/* Corner marks */}
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <span
          key={corner}
          aria-hidden
          className="absolute w-3 h-3"
          style={{
            top: corner.startsWith("t") ? 10 : undefined,
            bottom: corner.startsWith("b") ? 10 : undefined,
            left: corner.endsWith("l") ? 10 : undefined,
            right: corner.endsWith("r") ? 10 : undefined,
            borderTop: corner.startsWith("t") ? `1px solid ${color}` : undefined,
            borderBottom: corner.startsWith("b") ? `1px solid ${color}` : undefined,
            borderLeft: corner.endsWith("l") ? `1px solid ${color}` : undefined,
            borderRight: corner.endsWith("r") ? `1px solid ${color}` : undefined,
            opacity: 0.8,
          }}
        />
      ))}

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] text-[#6B7280]" style={{ fontFamily: "var(--font-highlight)" }}>
              Tethos guild
            </p>
            <p className="text-[10px] text-[#6B7280]" style={{ fontFamily: "var(--font-highlight)" }}>
              Applicant card
            </p>
          </div>
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `${color}14`, border: `1.5px solid ${color}` }}
          >
            <ClassIcon className="w-6 h-6" style={{ color }} />
            <span
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center bg-[#0F0F10]"
              style={{ border: `1px solid ${color}66` }}
            >
              <SubIcon className="w-3 h-3" style={{ color }} />
            </span>
          </div>
        </div>

        <dl className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3">
              <dt
                className="w-14 flex-shrink-0 text-[10px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-highlight)" }}
              >
                {k}
              </dt>
              <dd
                className={`text-sm truncate ${k === "Class" ? "font-medium" : "text-[#E5E7EB]"}`}
                style={{
                  fontFamily: "var(--font-highlight)",
                  color: k === "Class" ? color : undefined,
                }}
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {typeof xp === "number" && (
          <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[10px] text-[#6B7280]" style={{ fontFamily: "var(--font-highlight)" }}>
              {character.mbti}
            </span>
            <span className="text-xs text-[#FFD166]" style={{ fontFamily: "var(--font-highlight)" }}>
              {xp} XP
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
