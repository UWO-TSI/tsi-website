"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, RefreshCw, Eye } from "lucide-react";
import StatusPipeline from "@/components/recruit/StatusPipeline";
import StatusBadge from "@/components/recruit/StatusBadge";
import InterviewScheduler from "@/components/recruit/InterviewScheduler";
import ActivityFeed from "@/components/recruit/ActivityFeed";
import ResumePreview from "@/components/recruit/ResumePreview";
import { createClient } from "@/lib/supabase/client";
import { studentVisibleStatus, type Application } from "@/lib/recruitment";

// Admin preview of the student-side dashboard for a single application.
// Polls every 4s so changes made in /admin/recruit show up live here.
export default function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/applications/${id}`);
      if (res.status === 403) {
        if (!cancelled) {
          setForbidden(true);
          setLoading(false);
        }
        return;
      }
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setApp(data);
        setLoading(false);
        setRefreshedAt(new Date());
      }
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center">
        <p className="text-[#9CA3AF] text-sm">Admin access required.</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center">
        <p className="text-[#9CA3AF] text-sm">Application not found.</p>
      </div>
    );
  }

  // Status the applicant actually sees — waitlist is masked back to the
  // prior pipeline stage so they don't learn they were waitlisted.
  const visibleStatus = studentVisibleStatus(app);

  return (
    <div className="min-h-screen bg-[#0F0F10]">
      {/* Admin preview chrome — visually distinct so it can't be mistaken
          for the real student dashboard. */}
      <div
        className="sticky top-0 z-30 px-6 py-3 flex items-center justify-between border-b backdrop-blur"
        style={{
          background: "rgba(29,155,240,0.08)",
          borderColor: "rgba(29,155,240,0.25)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/recruit")}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#1D9BF0] hover:text-white transition"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to admin
          </button>
          <span className="text-white/20">|</span>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-[#1D9BF0]">
            <Eye className="w-3 h-3" />
            Admin preview
          </div>
          <span className="text-[11px] text-[#9CA3AF]">
            viewing as <strong className="text-[#F1FFFF]">{app.full_name}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7280]">
          {refreshedAt && (
            <>
              <RefreshCw className="w-3 h-3" />
              refreshed {refreshedAt.toLocaleTimeString("en-US", { hour12: false })}
              <span className="opacity-50">· auto every 4s</span>
            </>
          )}
        </div>
      </div>

      {/* Student-view body */}
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-semibold text-[#F1FFFF] mb-2"
        >
          Your application
        </motion.h1>
        <p className="text-sm text-[#6B7280] mb-10">
          Status updates as your application progresses through review.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-6 md:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-start justify-between mb-6 gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-[#F1FFFF] mb-2">
                {app.position?.title ?? "Position"}
              </h3>
              <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Submitted{" "}
                  {new Date(app.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <StatusBadge status={visibleStatus} />
          </div>

          <StatusPipeline currentStatus={visibleStatus} />

          {visibleStatus === "interview_invite" && app.position && (
            <div className="mt-6">
              <InterviewScheduler
                applicantName={app.full_name}
                applicantEmail={app.email}
                calendlyUrl={
                  app.status === "waitlist"
                    ? null
                    : app.position.calendly_url ?? null
                }
              />
            </div>
          )}

          {app.resume_drive_url && (
            <div className="mt-6">
              <ResumePreview
                url={app.resume_drive_url}
                filename={app.resume_filename}
              />
            </div>
          )}

          <ActivityFeed application={app} />
        </motion.div>

        {/* Reminder for admin */}
        <p className="text-[10px] font-mono text-[#6B7280] text-center mt-8 leading-relaxed">
          This is a live mirror of what the applicant sees. Changes made in
          /admin/recruit appear here within 4 seconds.
          <br />
          Status shown is the <span className="text-[#F1FFFF]">released</span>{" "}
          status — pending drafts are admin-only.
        </p>
      </div>
    </div>
  );
}
