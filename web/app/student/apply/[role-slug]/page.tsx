"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ApplicationForm from "@/components/recruit/ApplicationForm";
import AuthModal from "@/components/recruit/AuthModal";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Clock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { POSITION_SEED_DATA, getPositionStatus } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import type { User } from "@supabase/supabase-js";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

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
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-8 h-8 rounded-full border-2 border-[#002FA7] border-t-transparent animate-spin" />
          <p className="font-mono text-xs text-[#6B7280] tracking-wider">
            Loading position...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex flex-col items-center justify-center gap-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center"
        >
          <p className="text-[#6B7280] font-mono text-sm mb-2">404</p>
          <p className="text-[#F1FFFF] text-lg font-medium mb-6">
            Position not found
          </p>
          <button
            onClick={() => router.push("/student/apply")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Positions
          </button>
        </motion.div>
      </div>
    );
  }

  const status = getPositionStatus(position);
  const deadline = position.closes_at
    ? new Date(position.closes_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#0F0F10]">
      {/* Header section */}
      <div className="pt-8 md:pt-12 px-6 md:px-16">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            onClick={() => router.push("/student/apply")}
            className="group flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            All Positions
          </motion.button>

          {/* Position header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7]">
                Phase {String(position.phase).padStart(2, "0")}
              </span>
              {status === "open" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-mono uppercase tracking-wide">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
                  </span>
                  Open
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-[#F1FFFF] tracking-tight mb-3">
              {position.title}
            </h1>
            <p className="text-[#9CA3AF] leading-relaxed max-w-lg">
              {position.description}
            </p>

            {deadline && (
              <div className="flex items-center gap-2 mt-4 font-mono text-xs text-[#6B7280]">
                <Clock className="w-3.5 h-3.5" />
                Deadline: {deadline}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-2xl mx-auto px-6 md:px-16">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
          className="h-px bg-white/[0.06] origin-left mb-10"
        />
      </div>

      {/* Auth gate or form */}
      <div className="px-6 md:px-16 pb-24">
        {user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE_OUT }}
          >
            <ApplicationForm position={position} userId={user.id} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE_OUT }}
            className="max-w-md mx-auto"
          >
            <div
              className="rounded-2xl p-8 md:p-10 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="w-12 h-12 rounded-full bg-[#002FA7]/15 flex items-center justify-center mx-auto mb-5">
                <Lock className="w-5 h-5 text-[#002FA7]" />
              </div>

              <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
                Sign in to apply
              </h3>
              <p className="text-sm text-[#6B7280] mb-8 max-w-sm mx-auto">
                Create an account or sign in to submit your application for{" "}
                <span className="text-[#9CA3AF]">{position.title}</span>.
              </p>

              <motion.button
                onClick={() => setShowAuth(true)}
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#002FA7] text-[#F1FFFF] text-sm font-medium transition-all hover:bg-[#0039CC] hover:shadow-[0_0_30px_rgba(0,47,167,0.25)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Sign In / Sign Up
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>

              <p className="text-[10px] text-[#4B5563] mt-6 font-mono">
                Google OAuth or email/password
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        redirectTo={`/student/apply/${slug}`}
      />
    </div>
  );
}
