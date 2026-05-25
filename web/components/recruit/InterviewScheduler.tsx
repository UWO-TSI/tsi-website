"use client";

import { InlineWidget } from "react-calendly";
import { Calendar, ExternalLink } from "lucide-react";

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
              You&apos;re through to the interview round
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
              A member of the Tethos team will reach out to you directly with
              interview details. If you have questions, email{" "}
              <a
                href="mailto:recruitment@tethos.ca"
                className="text-[#1D9BF0] hover:underline"
              >
                recruitment@tethos.ca
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#1D9BF0]" />
          <p className="text-sm text-[#F1FFFF] font-medium">
            Schedule your interview
          </p>
        </div>
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#1D9BF0] hover:text-[#F1FFFF] transition"
        >
          Open in new tab
          <ExternalLink className="w-3 h-3" />
        </a>
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
          styles={{ height: "1000px", minWidth: "320px" }}
          pageSettings={{
            backgroundColor: "0F0F10",
            primaryColor: "1D9BF0",
            textColor: "F1FFFF",
            hideEventTypeDetails: false,
            hideLandingPageDetails: false,
          }}
        />
      </div>
      {/* Backup link in case the embed fails (privacy extensions, etc.) */}
      <p className="text-[11px] text-[#6B7280] mt-3 text-center">
        Having trouble loading the calendar? Book directly at{" "}
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1D9BF0] hover:underline break-all"
        >
          {calendlyUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
    </div>
  );
}
