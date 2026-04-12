"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import StatusPipeline from "@/components/recruit/StatusPipeline";
import StatusBadge from "@/components/recruit/StatusBadge";
import AuthModal from "@/components/recruit/AuthModal";
import Button from "@/components/ui/Button";
import { motion } from "framer-motion";
import { fadeUpVariants, STAGGER_NORMAL } from "@/lib/motion";
import { FileText, Calendar, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application } from "@/lib/recruitment";
import type { User } from "@supabase/supabase-js";

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

      // Fetch user's applications
      const { data } = await supabase
        .from("applications")
        .select("*, position:positions(*)")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });

      setApplications((data as Application[]) ?? []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#002FA7] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <SmoothScroll>
        <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-6">
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="glass-card p-8 max-w-md text-center"
          >
            <h2 className="text-2xl font-semibold text-[#F1FFFF] mb-3">
              Sign in to view your applications
            </h2>
            <p className="text-sm text-[#9CA3AF] mb-6">
              Track your application status and see updates.
            </p>
            <Button variant="primary" onClick={() => setShowAuth(true)}>
              Sign In
            </Button>
            <AuthModal
              isOpen={showAuth}
              onClose={() => setShowAuth(false)}
              redirectTo="/student/apply/dashboard"
            />
          </motion.div>
        </div>
      </SmoothScroll>
    );
  }

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[var(--color-bg-main)] py-8 md:py-16 px-6 md:px-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-12"
          >
            <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#002FA7] mb-3">
              Application Dashboard
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-[#F1FFFF]">
              Your Applications
            </h1>
          </motion.div>

          {applications.length === 0 ? (
            <motion.div
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="glass-card p-8 text-center"
            >
              <p className="text-[#9CA3AF] mb-4">
                You haven&apos;t submitted any applications yet.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push("/student/apply")}
              >
                Browse Positions
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {applications.map((app, i) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * STAGGER_NORMAL }}
                  className="glass-card p-6 md:p-8"
                >
                  {/* App header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-[#F1FFFF] mb-1">
                        {app.position?.title ?? "Position"}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Submitted{" "}
                          {new Date(app.submitted_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                        {app.resume_drive_url && (
                          <a
                            href={app.resume_drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#002FA7] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Resume
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  {/* Status pipeline */}
                  <StatusPipeline currentStatus={app.status} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SmoothScroll>
  );
}
