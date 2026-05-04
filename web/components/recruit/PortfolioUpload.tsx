"use client";

// Optional portfolio attachment for VP Marketing. Same signed-upload
// pattern as ResumeUpload but targets the "portfolios" bucket which
// allows images, video, PDFs, and zips up to 50 MB. For anything
// larger applicants paste a hosted link in the essay answer instead.

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_MB = 50;

const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

interface PortfolioUploadProps {
  positionSlug: string;
  currentPath: string | null;
  currentFilename: string | null;
  currentSize: number | null;
  onChange: (
    data: { path: string; filename: string; size: number } | null
  ) => void;
}

type UploadState = "idle" | "uploading" | "complete" | "error";

export default function PortfolioUpload({
  positionSlug,
  currentPath,
  currentFilename,
  currentSize,
  onChange,
}: PortfolioUploadProps) {
  const [state, setState] = useState<UploadState>(
    currentPath ? "complete" : "idle"
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (currentPath && state !== "uploading") setState("complete");
    else if (!currentPath && state === "complete") setState("idle");
  }, [currentPath, state]);

  const validate = useCallback((f: File): string | null => {
    if (f.size > MAX_BYTES) return `File must be under ${MAX_MB}MB.`;
    if (f.size === 0) return "File appears to be empty.";
    if (!ACCEPTED.includes(f.type) && f.type !== "") {
      return "Use image, video, PDF, or zip.";
    }
    return null;
  }, []);

  const upload = useCallback(
    async (f: File) => {
      setLocalError(null);
      setState("uploading");

      let signedUploadInfo: { path: string; token: string };
      try {
        const signRes = await fetch("/api/resume-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "upload",
            bucket: "portfolios",
            positionSlug,
            replacePath: currentPath ?? null,
            filename: f.name,
          }),
        });
        if (!signRes.ok) {
          const body = await signRes.json().catch(() => ({}));
          if (signRes.status === 401) {
            setState("error");
            setLocalError("Session expired. Refresh to sign in again.");
            return;
          }
          setState("error");
          setLocalError(body?.error || "Couldn't start upload.");
          return;
        }
        signedUploadInfo = await signRes.json();
      } catch {
        setState("error");
        setLocalError("Network error preparing upload.");
        return;
      }

      const { error: uploadErr } = await supabase.storage
        .from("portfolios")
        .uploadToSignedUrl(signedUploadInfo.path, signedUploadInfo.token, f, {
          contentType: f.type || "application/octet-stream",
        });

      if (uploadErr) {
        setState("error");
        setLocalError(
          uploadErr.message?.toLowerCase().includes("payload")
            ? `File must be under ${MAX_MB}MB.`
            : uploadErr.message || "Upload failed."
        );
        return;
      }

      onChange({
        path: signedUploadInfo.path,
        filename: f.name,
        size: f.size,
      });
      setState("complete");
    },
    [supabase, positionSlug, currentPath, onChange]
  );

  const handleSelect = (f: File) => {
    const err = validate(f);
    if (err) {
      setLocalError(err);
      setState("error");
      return;
    }
    upload(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleSelect(f);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleSelect(f);
  };

  const handleRemove = async () => {
    const pathToDelete = currentPath;
    onChange(null);
    setState("idle");
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
    if (pathToDelete) {
      try {
        await fetch("/api/resume-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "delete",
            bucket: "portfolios",
            path: pathToDelete,
          }),
        });
      } catch {
        // non-blocking
      }
    }
  };

  return (
    <div>
      <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
        Portfolio (optional)
      </label>
      <p className="text-xs text-[#6B7280] mb-3 leading-relaxed">
        For VP Marketing applicants. Drop a creative piece (image, video, PDF,
        or zip up to {MAX_MB}MB), or paste a hosted link in the essay answer
        if your file is bigger.
      </p>

      <AnimatePresence mode="wait">
        {state === "uploading" ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3"
          >
            <Loader2 className="w-5 h-5 text-[#1D9BF0] flex-shrink-0 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1FFFF]">Uploading…</p>
              <p className="text-[10px] text-[#6B7280] font-mono">
                Don&apos;t close this tab
              </p>
            </div>
          </motion.div>
        ) : state === "complete" && currentPath ? (
          <motion.div
            key="uploaded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-xl bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 px-4 py-3"
          >
            <FileText className="w-5 h-5 text-[#1D9BF0] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1FFFF] truncate">
                {currentFilename ?? "Portfolio"}
              </p>
              <p className="text-[10px] text-[#6B7280] font-mono">
                {currentSize
                  ? `${(currentSize / 1024 / 1024).toFixed(2)} MB · uploaded`
                  : "uploaded"}
              </p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] flex-shrink-0" />
            <button
              type="button"
              onClick={handleRemove}
              className="text-[#6B7280] hover:text-[#EF4444] transition flex-shrink-0"
              aria-label="Remove portfolio"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`relative rounded-xl border-2 border-dashed px-6 py-6 text-center cursor-pointer transition-all duration-300 ${
              isDragOver
                ? "border-[#1D9BF0] bg-[#1D9BF0]/10"
                : localError
                  ? "border-[#EF4444]/40 bg-[#EF4444]/5"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={handleChange}
              className="hidden"
            />
            {localError ? (
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[#EF4444]" />
            ) : (
              <Upload
                className={`w-6 h-6 mx-auto mb-2 ${
                  isDragOver ? "text-[#1D9BF0]" : "text-[#6B7280]"
                }`}
              />
            )}
            <p className="text-sm text-[#9CA3AF]">
              <span className="text-[#F1FFFF] font-medium">
                {localError ? "Try again" : "Click to upload"}
              </span>
              {!localError && " or drag and drop"}
            </p>
            <p className="text-[10px] text-[#6B7280] font-mono mt-1">
              Image, video, PDF, or zip · max {MAX_MB}MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {localError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-[#EF4444] mt-1.5 ml-1"
          >
            {localError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
