"use client";

import { InlineWidget } from "react-calendly";
import { Calendar } from "lucide-react";

interface InterviewSchedulerProps {
  calendlyUrl: string | null;
  applicantName?: string;
  applicantEmail?: string;
}

export default function InterviewScheduler({
  calendlyUrl,
  applicantName,
  applicantEmail,
}: InterviewSchedulerProps) {
  if (!calendlyUrl) {
    return (
      <div
        className="rounded-xl p-5"
        style={{
          background: "rgba(255,209,102,0.06)",
          border: "1px solid rgba(255,209,102,0.2)",
        }}
      >
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-[#FFD166] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[#F1FFFF] font-medium">
              Interview invite sent
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
              Check your email for the scheduling link. If you can&apos;t find
              it, reach out to recruitment@tethos.ca.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-[#002FA7]" />
        <p className="text-sm text-[#F1FFFF] font-medium">
          Schedule your interview
        </p>
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <InlineWidget
          url={calendlyUrl}
          prefill={{
            name: applicantName ?? undefined,
            email: applicantEmail ?? undefined,
          }}
          styles={{ height: "680px" }}
          pageSettings={{
            backgroundColor: "0F0F10",
            primaryColor: "002FA7",
            textColor: "F1FFFF",
            hideEventTypeDetails: false,
            hideLandingPageDetails: false,
          }}
        />
      </div>
    </div>
  );
}
