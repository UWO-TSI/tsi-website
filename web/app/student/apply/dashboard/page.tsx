"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusPipeline from "@/components/recruit/StatusPipeline";
import StatusBadge from "@/components/recruit/StatusBadge";
import AuthModal from "@/components/recruit/AuthModal";
import InterviewScheduler from "@/components/recruit/InterviewScheduler";
import ActivityFeed from "@/components/recruit/ActivityFeed";
import ResumePreview from "@/components/recruit/ResumePreview";
import { motion } from "framer-motion";
import {
  Calendar,
  ArrowLeft,
  ArrowRight,
  Lock,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application } from "@/lib/recruitment";
import type { User } from "@supabase/supabase-js";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("applications")
        .select(
          "*, position:positions(*), releases:status_releases(id, old_status, new_status, released_at)"
        )
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });

      setApplications((data as Application[]) ?? []);
      setLoading(false);
    }

    load();
  }, []);

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
            Loading...
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Unauthenticated state ──
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="max-w-md w-full text-center"
        >
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="w-12 h-12 rounded-full bg-[#002FA7]/15 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-5 h-5 text-[#002FA7]" />
            </div>

            <h2 className="text-xl font-semibold text-[#F1FFFF] mb-2">
              Application Dashboard
            </h2>
            <p className="text-sm text-[#6B7280] mb-8">
              Sign in to track your applications and see status updates.
            </p>

            <motion.button
              onClick={() => setShowAuth(true)}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#002FA7] text-[#F1FFFF] text-sm font-medium transition-all hover:bg-[#0039CC] hover:shadow-[0_0_30px_rgba(0,47,167,0.25)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign In
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>

            <p className="text-[10px] text-[#4B5563] mt-6 font-mono">
              Google OAuth or email/password
            </p>
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => router.push("/student/apply")}
            className="group inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition-colors mt-8"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Positions
          </motion.button>
        </motion.div>

        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          redirectTo="/student/apply/dashboard"
        />
      </div>
    );
  }

  // ── Authenticated state ──
  return (
    <div className="min-h-screen bg-[#0F0F10] py-8 md:py-16 px-6 md:px-16">
      <div className="max-w-3xl mx-auto">
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

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7] mb-2">
            Application Dashboard
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F1FFFF] tracking-tight">
            Your Applications
          </h1>
        </motion.div>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE_OUT }}
          className="h-px bg-white/[0.06] origin-left mb-10"
        />

        {/* Applications list */}
        {applications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE_OUT }}
            className="rounded-2xl p-10 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-5 h-5 text-[#6B7280]" />
            </div>
            <p className="text-[#9CA3AF] mb-2">No applications yet</p>
            <p className="text-sm text-[#6B7280] mb-6">
              Browse open positions and submit your first application.
            </p>
            <motion.button
              onClick={() => router.push("/student/apply")}
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#002FA7] text-[#F1FFFF] text-sm font-medium transition-all hover:bg-[#0039CC]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Browse Positions
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {applications.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + i * 0.1,
                  duration: 0.6,
                  ease: EASE_OUT,
                }}
                className="group rounded-2xl p-6 md:p-8 transition-all duration-300 hover:border-white/12"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* App header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#F1FFFF] mb-2">
                      {app.position?.title ?? "Position"}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Submitted{" "}
                        {new Date(app.submitted_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                {/* Status pipeline */}
                <StatusPipeline currentStatus={app.status} />

                {/* Interview scheduling when invited */}
                {app.status === "interview_invite" && app.position && (
                  <div className="mt-6">
                    <InterviewScheduler
                      applicantName={app.full_name}
                      applicantEmail={app.email}
                      calendlyUrl={app.position.calendly_url ?? null}
                    />
                  </div>
                )}

                {/* Resume preview */}
                {app.resume_drive_url && (
                  <div className="mt-6">
                    <ResumePreview
                      url={app.resume_drive_url}
                      filename={app.resume_filename}
                    />
                  </div>
                )}

                {/* Activity feed */}
                <ActivityFeed application={app} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
