"use client";

import { useEffect, useState } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import AsciiReveal from "@/components/ascii/AsciiReveal";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import RecruitmentRoadmap from "@/components/recruit/RecruitmentRoadmap";
import PositionCard from "@/components/recruit/PositionCard";
import Button from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  fadeUpVariants,
  STAGGER_NORMAL,
  TRANSITION_REVEAL,
} from "@/lib/motion";
import { POSITION_SEED_DATA } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";

export default function RecruitmentPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/positions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPositions(data);
        } else {
          // Fallback to seed data if API returns empty
          setPositions(
            POSITION_SEED_DATA.filter((p) => p.visibility === "public").map(
              (p, i) => ({ ...p, id: `seed-${i}`, created_at: new Date().toISOString() })
            )
          );
        }
      })
      .catch(() => {
        setPositions(
          POSITION_SEED_DATA.filter((p) => p.visibility === "public").map(
            (p, i) => ({ ...p, id: `seed-${i}`, created_at: new Date().toISOString() })
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[var(--color-bg-main)]">
        {/* ============ HERO ============ */}
        <section className="relative pt-12 pb-8 md:pt-20 md:pb-16 px-6 md:px-16 overflow-hidden">
          {/* Background glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0, 47, 167, 0.08) 0%, transparent 70%)",
            }}
          />

          <div className="relative max-w-4xl mx-auto text-center">
            <motion.p
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="font-mono text-xs tracking-[0.25em] uppercase text-[#002FA7] mb-6"
            >
              2026-27 Recruitment
            </motion.p>

            <AsciiReveal className="text-5xl md:text-7xl font-semibold text-[#F1FFFF] mb-6">
              Join Tethos
            </AsciiReveal>

            <motion.p
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-8 leading-relaxed"
            >
              We&apos;re looking for ambitious builders to lead Tethos into its
              next chapter. Find your role and make your mark.
            </motion.p>

            <motion.div
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              custom={2}
              className="flex justify-center gap-4"
            >
              <a href="#positions">
                <Button variant="primary">View Positions</Button>
              </a>
            </motion.div>
          </div>
        </section>

        <AsciiDivider />

        {/* ============ ROADMAP TIMELINE ============ */}
        <section className="px-6 md:px-16">
          <RecruitmentRoadmap />
        </section>

        <AsciiDivider />

        {/* ============ OPEN POSITIONS ============ */}
        <section id="positions" className="py-16 md:py-24 px-6 md:px-16">
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-12 md:mb-16"
          >
            <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#002FA7] mb-3">
              Open Positions
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold text-[#F1FFFF]">
              Find your role
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {positions.map((position, i) => (
              <PositionCard key={position.slug} position={position} index={i} />
            ))}
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="py-16 md:py-24 px-6 md:px-16">
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF] mb-4">
              Not sure which role fits?
            </h2>
            <p className="text-[#9CA3AF] mb-8">
              Reach out to us and we&apos;ll help you find the right position
              based on your skills and interests.
            </p>
            <a href="mailto:team@tethos.ca">
              <Button variant="secondary">Get in Touch</Button>
            </a>
          </motion.div>
        </section>
      </div>
    </SmoothScroll>
  );
}
