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
}

interface ProjectBooksProps {
  projects: Project[];
  className?: string;
}

const SPINE_WIDTH = 56;
const EXPANDED_WIDTH = 380;
const BOOK_HEIGHT = 320;

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

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

/* Mobile card for touch devices */
function MobileCard({ project }: { project: Project }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${project.color}`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: project.color }} />
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: project.color, fontFamily: "var(--font-highlight)" }}>
          {project.org}
        </span>
      </div>
      <h3 className="text-base font-medium tracking-tight mb-2" style={{ color: "#F1FFFF", fontWeight: 500 }}>
        {project.title}
      </h3>
      <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.tags.map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "var(--font-highlight)" }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProjectBooks({ projects, className = "" }: ProjectBooksProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className={className}>
      {/* Desktop: Books Container */}
      <div className="hidden md:flex items-center justify-center">
        <div className="flex items-stretch gap-1">
          {projects.map((project, i) => {
            // Neighbor lift: slight translateY when adjacent to active
            const isNeighbor = activeIndex !== null && Math.abs(i - activeIndex) === 1;
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
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden flex flex-col gap-3">
        {projects.map((project) => (
          <MobileCard key={project.org} project={project} />
        ))}
      </div>
    </div>
  );
}
