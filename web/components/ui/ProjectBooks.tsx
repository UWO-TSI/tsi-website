"use client";

/**
 * ProjectBooks - Framer Books Container-inspired project showcase.
 * Horizontally stacked project cards that expand on hover with spring animation.
 * Each "book spine" shows org name; hovering fans it out to show details.
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Project {
  org: string;
  title: string;
  description: string;
  tags: string[];
  color: string; // accent color for the spine
  stats?: { label: string; value: string }[];
  /** Year the project was built. Used for grouping with vertical dividers. */
  year: number;
  /** If true, render an empty "future work" slot instead of a real project. */
  placeholder?: boolean;
}

interface ProjectBooksProps {
  projects: Project[];
  className?: string;
}

const SPINE_WIDTH = 68;
const EXPANDED_WIDTH = 380;
const BOOK_HEIGHT = 320;

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

function PlaceholderSpine() {
  return (
    <div
      className="flex-shrink-0 relative rounded-lg flex items-center justify-center"
      style={{
        width: SPINE_WIDTH,
        height: BOOK_HEIGHT,
        background: "transparent",
        border: "1px dashed rgba(255,255,255,0.08)",
      }}
      aria-hidden
    >
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{
          color: "rgba(255,255,255,0.22)",
          fontFamily: "var(--font-highlight)",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
        }}
      >
        Future work
      </span>
    </div>
  );
}

function YearDivider({ year }: { year: number }) {
  return (
    <div
      className="flex-shrink-0 relative flex flex-col items-center justify-between mx-2"
      style={{ height: BOOK_HEIGHT, width: 28 }}
      aria-hidden
    >
      <span
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{
          color: "rgba(255,255,255,0.28)",
          fontFamily: "var(--font-highlight)",
        }}
      >
        {year}
      </span>
      <div
        className="flex-1 my-2"
        style={{
          width: 1,
          background:
            "linear-gradient(to bottom, transparent, rgba(255,255,255,0.12) 15%, rgba(255,255,255,0.12) 85%, transparent)",
        }}
      />
      <span
        className="text-[10px] tracking-widest"
        style={{
          color: "rgba(255,255,255,0.18)",
          fontFamily: "var(--font-highlight)",
        }}
      >
        /
      </span>
    </div>
  );
}

function BookSpine({
  project,
  index,
  isActive,
  onHover,
  onLeave,
}: {
  project: Project;
  index: number;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <motion.div
      className="flex-shrink-0 relative cursor-pointer overflow-hidden rounded-lg"
      style={{
        height: BOOK_HEIGHT,
        background: isActive ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
        borderLeft: `3px solid ${isActive ? project.color : "rgba(255,255,255,0.06)"}`,
        borderRight: "1px solid rgba(255,255,255,0.04)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
      animate={{
        width: isActive ? EXPANDED_WIDTH : SPINE_WIDTH,
      }}
      transition={springTransition}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Spine text (visible when collapsed) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: isActive ? 0 : 1 }}
        transition={{ duration: 0.15 }}
      >
        <span
          className="text-xs font-medium tracking-widest uppercase whitespace-nowrap"
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "var(--font-highlight)",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
          }}
        >
          {project.org}
        </span>
      </motion.div>

      {/* Expanded content (visible when active) */}
      <motion.div
        className="absolute inset-0 p-6 flex flex-col justify-between"
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0.2, delay: isActive ? 0.1 : 0 }}
      >
        <div>
          {/* Org + color accent */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: project.color }}
            />
            <span
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: project.color, fontFamily: "var(--font-highlight)" }}
            >
              {project.org}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-lg font-medium tracking-tight mb-3"
            style={{ color: "#F1FFFF", fontWeight: 500 }}
          >
            {project.title}
          </h3>

          {/* Description */}
          <p
            className="text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.4)", maxWidth: "320px" }}
          >
            {project.description}
          </p>

          {/* Stats */}
          {project.stats && (
            <div className="flex gap-6 mt-5">
              {project.stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-base font-medium" style={{ color: "#F1FFFF" }}>
                    {stat.value}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-1 rounded-md"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.35)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontFamily: "var(--font-highlight)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: isActive ? 1 : 0,
          background: `linear-gradient(135deg, ${project.color}08, transparent 60%)`,
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}

/* Mobile: horizontal book spine that expands on tap */
function MobileBookSpine({
  project,
  isActive,
  onTap,
}: {
  project: Project;
  isActive: boolean;
  onTap: () => void;
}) {
  return (
    <motion.div
      className="relative cursor-pointer overflow-hidden rounded-lg"
      style={{
        background: isActive ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
        borderTop: `3px solid ${isActive ? project.color : "rgba(255,255,255,0.06)"}`,
        borderLeft: "1px solid rgba(255,255,255,0.04)",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
      animate={{
        height: isActive ? "auto" : 48,
      }}
      transition={springTransition}
      onClick={onTap}
    >
      {/* Spine label (always visible) */}
      <div className="flex items-center gap-3 px-4 h-[48px]">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: project.color }}
        />
        <span
          className="text-xs font-medium uppercase tracking-widest flex-1"
          style={{ color: isActive ? project.color : "rgba(255,255,255,0.35)", fontFamily: "var(--font-highlight)" }}
        >
          {project.org}
        </span>
        <motion.span
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
          animate={{ rotate: isActive ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▾
        </motion.span>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="px-4 pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3
              className="text-base font-medium tracking-tight mb-2"
              style={{ color: "#F1FFFF", fontWeight: 500 }}
            >
              {project.title}
            </h3>
            <p
              className="text-xs leading-relaxed mb-3"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {project.description}
            </p>

            {project.stats && (
              <div className="flex gap-6 mb-3">
                {project.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-sm font-medium" style={{ color: "#F1FFFF" }}>
                      {stat.value}
                    </p>
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-1 rounded-md"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.35)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontFamily: "var(--font-highlight)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover glow */}
      {isActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: `linear-gradient(135deg, ${project.color}08, transparent 60%)`,
          }}
        />
      )}
    </motion.div>
  );
}

/** Group consecutive projects by year in the order given. Preserves array order
 *  (ascending or descending as the caller provides it). */
function groupByYear(projects: Project[]): { year: number; items: Project[] }[] {
  const groups: { year: number; items: Project[] }[] = [];
  for (const p of projects) {
    const last = groups[groups.length - 1];
    if (last && last.year === p.year) {
      last.items.push(p);
    } else {
      groups.push({ year: p.year, items: [p] });
    }
  }
  return groups;
}

export default function ProjectBooks({ projects, className = "" }: ProjectBooksProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const groups = groupByYear(projects);

  // Map each real (non-placeholder) project to its global index for neighbor lift.
  const indexMap = new Map<Project, number>();
  let idx = 0;
  for (const p of projects) {
    if (!p.placeholder) {
      indexMap.set(p, idx);
      idx++;
    }
  }

  return (
    <div className={className}>
      {/* Desktop: Books Container grouped by year */}
      <div className="hidden md:flex items-center justify-center">
        <div className="flex items-stretch gap-1">
          {groups.map((group, gi) => (
            <div key={group.year} className="flex items-stretch gap-1">
              {group.items.map((project) => {
                if (project.placeholder) {
                  return (
                    <PlaceholderSpine
                      key={`ph-${group.year}-${project.org}`}
                    />
                  );
                }
                const i = indexMap.get(project)!;
                const isNeighbor =
                  activeIndex !== null && Math.abs(i - activeIndex) === 1;
                return (
                  <motion.div
                    key={project.org}
                    animate={{ y: isNeighbor ? -3 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <BookSpine
                      project={project}
                      index={i}
                      isActive={activeIndex === i}
                      onHover={() => setActiveIndex(i)}
                      onLeave={() => setActiveIndex(null)}
                    />
                  </motion.div>
                );
              })}
              {gi < groups.length - 1 ? (
                <YearDivider year={groups[gi + 1].year} />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: horizontal spines stacked vertically, tap to open. Year labels
           become simple section headers instead of vertical dividers. */}
      <div className="md:hidden flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.year} className="flex flex-col gap-1">
            <div
              className="text-[10px] uppercase tracking-[0.22em] mb-1 px-1"
              style={{ color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-highlight)" }}
            >
              {group.year}
            </div>
            {group.items.map((project) => {
              if (project.placeholder) {
                return (
                  <div
                    key={`ph-${group.year}-${project.org}`}
                    className="rounded-lg flex items-center gap-3 px-4 h-[48px]"
                    style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
                    aria-hidden
                  >
                    <span
                      className="text-xs uppercase tracking-widest"
                      style={{
                        color: "rgba(255,255,255,0.22)",
                        fontFamily: "var(--font-highlight)",
                      }}
                    >
                      Future work
                    </span>
                  </div>
                );
              }
              const i = indexMap.get(project)!;
              return (
                <MobileBookSpine
                  key={project.org}
                  project={project}
                  isActive={activeIndex === i}
                  onTap={() => setActiveIndex(activeIndex === i ? null : i)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
