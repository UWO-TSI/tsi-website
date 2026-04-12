"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import ApplicationForm from "@/components/recruit/ApplicationForm";
import AuthModal from "@/components/recruit/AuthModal";
import Button from "@/components/ui/Button";
import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { POSITION_SEED_DATA } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import type { User } from "@supabase/supabase-js";

export default function RoleApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params["role-slug"] as string;

  const [position, setPosition] = useState<Position | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      // Get auth state
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      // Fetch position (fallback to seed data)
      try {
        const res = await fetch(`/api/positions`);
        if (res.ok) {
          const positions: Position[] = await res.json();
          const found = positions.find((p) => p.slug === slug);
          if (found) {
            setPosition(found);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to seed data
      }

      // Fallback
      const seed = POSITION_SEED_DATA.find((p) => p.slug === slug);
      if (seed) {
        setPosition({
          ...seed,
          id: `seed-${slug}`,
          created_at: new Date().toISOString(),
        });
      }
      setLoading(false);
    }

    init();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#002FA7] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF]">Position not found.</p>
        <Button variant="secondary" onClick={() => router.push("/student/apply")}>
          Back to Positions
        </Button>
      </div>
    );
  }

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[var(--color-bg-main)] py-8 md:py-16 px-6 md:px-16">
        {/* Back link */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="max-w-2xl mx-auto mb-8"
        >
          <button
            onClick={() => router.push("/student/apply")}
            className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            All Positions
          </button>
        </motion.div>

        {/* Position header */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="max-w-2xl mx-auto mb-12 text-center"
        >
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#002FA7] mb-3">
            Apply for
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#F1FFFF] mb-3">
            {position.title}
          </h1>
          <p className="text-[#9CA3AF] max-w-lg mx-auto">
            {position.description}
          </p>
        </motion.div>

        {/* Auth gate or form */}
        {user ? (
          <ApplicationForm position={position} userId={user.id} />
        ) : (
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            custom={2}
            className="max-w-md mx-auto text-center"
          >
            <div className="glass-card p-8">
              <h3 className="text-xl font-semibold text-[#F1FFFF] mb-3">
                Sign in to apply
              </h3>
              <p className="text-sm text-[#9CA3AF] mb-6">
                Create an account or sign in to submit your application and
                track your status.
              </p>
              <Button
                variant="primary"
                onClick={() => setShowAuth(true)}
              >
                Sign In / Sign Up
              </Button>
            </div>
          </motion.div>
        )}

        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          redirectTo={`/student/apply/${slug}`}
        />
      </div>
    </SmoothScroll>
  );
}
