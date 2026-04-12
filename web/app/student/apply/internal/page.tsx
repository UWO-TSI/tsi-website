"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import PositionCard from "@/components/recruit/PositionCard";
import InternalGate from "@/components/recruit/InternalGate";
import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { POSITION_SEED_DATA } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";

export default function InternalPositionsPage() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [positions, setPositions] = useState<Position[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(!!codeFromUrl);

  const fetchPositions = async (code: string) => {
    setLoading(true);
    setError(undefined);

    try {
      const res = await fetch(`/api/positions?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data: Position[] = await res.json();
        const internal = data.filter((p) => p.visibility === "internal");
        if (internal.length > 0) {
          setPositions(internal);
          setUnlocked(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Fallback to seed data for demo
    const seedInternal = POSITION_SEED_DATA.filter(
      (p) => p.visibility === "internal"
    ).map((p, i) => ({
      ...p,
      id: `seed-int-${i}`,
      created_at: new Date().toISOString(),
    }));

    if (seedInternal.length > 0 && code === "tethos-internal-2026") {
      // Demo code for testing
      setPositions(seedInternal);
      setUnlocked(true);
    } else {
      setError("Invalid access code. Please check and try again.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (codeFromUrl) {
      fetchPositions(codeFromUrl);
    }
  }, [codeFromUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#FFD166] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[var(--color-bg-main)] py-16 md:py-24 px-6 md:px-16">
        {!unlocked ? (
          <InternalGate onUnlock={fetchPositions} error={error} />
        ) : (
          <>
            <motion.div
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-center mb-12 md:mb-16"
            >
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#FFD166] mb-3">
                Internal Recruitment
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#F1FFFF] mb-3">
                Welcome back
              </h1>
              <p className="text-[#9CA3AF] max-w-lg mx-auto">
                These positions are exclusive to past Tethos members. Select a
                role to apply.
              </p>
            </motion.div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {positions.map((position, i) => (
                <PositionCard
                  key={position.slug}
                  position={position}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </SmoothScroll>
  );
}
