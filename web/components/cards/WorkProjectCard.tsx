"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface WorkProjectCardProps {
  title: string;
  description: string;
  tags: string[];
  width?: number;
  height?: number;
  onClick?: () => void;
}

export default function WorkProjectCard({
  title,
  description,
  tags,
  width = 280,
  height = 340,
  onClick,
}: WorkProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="cursor-pointer"
      style={{ width, height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <div className="glass-card h-full rounded-xl p-5 relative overflow-hidden">
        {/* Image Placeholder */}
        <div
          className="w-full rounded-lg overflow-hidden bg-zinc-800 relative mb-4"
          style={{ height: height * 0.48 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white line-clamp-1">
            {title}
          </h3>
          <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
            {description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-800/50 text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Subtle glow on hover */}
        <motion.div
          className="absolute -inset-1 rounded-xl blur-xl -z-10"
          style={{
            background: "radial-gradient(circle, rgba(0,47,167,0.25) 0%, transparent 70%)",
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
}