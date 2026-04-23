"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, ExternalLink } from "lucide-react";

interface ResumePreviewProps {
  url: string;
  filename?: string | null;
}

function toDrivePreviewUrl(webViewUrl: string): string | null {
  // Convert https://drive.google.com/file/d/{id}/view?... → /preview
  const match = webViewUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

export default function ResumePreview({ url, filename }: ResumePreviewProps) {
  const [open, setOpen] = useState(false);
  const previewUrl = toDrivePreviewUrl(url);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
        >
          <FileText className="w-4 h-4" />
          <span>{filename ?? "Resume"}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <span className="text-white/10">·</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#002FA7] hover:underline"
        >
          Open
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <AnimatePresence initial={false}>
        {open && previewUrl && (
          <motion.div
            key="preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mt-3"
          >
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <iframe
                src={previewUrl}
                title={filename ?? "Resume preview"}
                className="w-full h-[520px] bg-white/5"
                loading="lazy"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
