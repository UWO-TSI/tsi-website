"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, ExternalLink, Loader2 } from "lucide-react";

interface ResumePreviewProps {
  url: string | null;
  filename?: string | null;
}

function toPreviewUrl(url: string): string | null {
  // Google Drive view links need /preview to embed
  const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/\/storage\/v1\/object\/(sign|public)\//.test(url)) return url;
  return null;
}

// Pull the storage path out of a Supabase signed URL so we can re-sign
// once the original 7-day token expires. Returns null for non-Supabase URLs.
function extractSupabasePath(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/sign\/resumes\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Cheap heuristic — Supabase signed URLs have an `exp` JWT claim, but
// parsing that on the client is overkill. We just refresh on 403/404
// when the iframe/link tries to load.
function isSupabaseSignedUrl(url: string): boolean {
  return /\/storage\/v1\/object\/sign\//.test(url);
}

export default function ResumePreview({ url, filename }: ResumePreviewProps) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // If the stored URL is a Supabase signed URL, refresh it on mount so
  // the link/iframe always uses a fresh token (the stored one may have
  // expired since submission).
  useEffect(() => {
    if (!url) {
      setResolvedUrl(null);
      return;
    }
    if (!isSupabaseSignedUrl(url)) {
      setResolvedUrl(url);
      return;
    }
    const path = extractSupabasePath(url);
    if (!path) {
      setResolvedUrl(url);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    (async () => {
      try {
        const res = await fetch("/api/resume-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "view", path }),
        });
        if (cancelled) return;
        if (!res.ok) {
          // Fall back to whatever we had — may still work if not expired
          setResolvedUrl(url);
          if (res.status === 404) {
            setResolveError("Resume file is no longer available.");
          }
        } else {
          const body = await res.json();
          setResolvedUrl(body.signedUrl ?? url);
        }
      } catch {
        if (!cancelled) setResolvedUrl(url);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const previewUrl = resolvedUrl ? toPreviewUrl(resolvedUrl) : null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={!resolvedUrl}
          className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition disabled:opacity-50"
        >
          {resolving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>{filename ?? "Resume"}</span>
          {resolvedUrl && (
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
        {resolvedUrl && (
          <>
            <span className="text-white/10">·</span>
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#1D9BF0] hover:underline"
            >
              Open
              <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )}
      </div>

      {resolveError && (
        <p className="text-xs text-[#EF4444] mt-1.5 ml-1">{resolveError}</p>
      )}

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
