"use client";

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
import { MAX_RESUME_SIZE_BYTES, MAX_RESUME_SIZE_MB } from "@/lib/recruitment";

interface ResumeUploadProps {
  positionSlug: string;
  currentPath: string | null;
  currentFilename: string | null;
  currentSize: number | null;
  onChange: (
    data: { path: string; filename: string; size: number } | null
  ) => void;
  error?: string;
}

type UploadState = "idle" | "uploading" | "complete" | "error";

export default function ResumeUpload({
  positionSlug,
  currentPath,
  currentFilename,
  currentSize,
  onChange,
  error: externalError,
}: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>(
    currentPath ? "complete" : "idle"
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const displayError = externalError || localError;

  // Sync visual state when currentPath changes (e.g., draft hydration)
  useEffect(() => {
    if (currentPath && state !== "uploading") {
      setState("complete");
    } else if (!currentPath && state === "complete") {
      setState("idle");
    }
  }, [currentPath, state]);

  const validateFile = useCallback((f: File): string | null => {
    if (f.type !== "application/pdf") return "Only PDF files are accepted.";
    if (f.size > MAX_RESUME_SIZE_BYTES)
      return `File must be under ${MAX_RESUME_SIZE_MB}MB.`;
    if (f.size === 0) return "File appears to be empty.";
    return null;
  }, []);

  const uploadFile = useCallback(
    async (f: File) => {
      setLocalError(null);
      setState("uploading");

      // Step 1: ask the server for a signed upload URL. The server runs
      // a best-effort delete of the previous upload before issuing a new
      // path so we don't accumulate orphans on replace.
      let signedUploadInfo: { path: string; token: string };
      try {
        const signRes = await fetch("/api/resume-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "upload",
            positionSlug,
            replacePath: currentPath ?? null,
          }),
        });
        if (!signRes.ok) {
          const body = await signRes.json().catch(() => ({}));
          if (signRes.status === 401) {
            setState("error");
            setLocalError(
              "Your session expired. Refresh the page to sign in again."
            );
            return;
          }
          setState("error");
          setLocalError(
            body?.error || "Couldn't start upload. Try again."
          );
          return;
        }
        signedUploadInfo = await signRes.json();
      } catch {
        setState("error");
        setLocalError(
          "Network error preparing upload. Check your connection and try again."
        );
        return;
      }

      // Step 2: upload directly to Supabase Storage using the signed token.
      // Bypasses Vercel's 4.5 MB serverless body limit.
      const { error: uploadErr } = await supabase.storage
        .from("resumes")
        .uploadToSignedUrl(signedUploadInfo.path, signedUploadInfo.token, f, {
          contentType: "application/pdf",
        });

      if (uploadErr) {
        setState("error");
        setLocalError(
          uploadErr.message?.toLowerCase().includes("payload")
            ? `File must be under ${MAX_RESUME_SIZE_MB}MB.`
            : uploadErr.message ||
                "Upload failed — check your connection and try again."
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
    const validationError = validateFile(f);
    if (validationError) {
      setLocalError(validationError);
      setState("error");
      return;
    }
    uploadFile(f);
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
          body: JSON.stringify({ mode: "delete", path: pathToDelete }),
        });
      } catch {
        // Non-blocking — orphan files are tolerated
      }
    }
  };

  const handleRetry = () => {
    setLocalError(null);
    setState("idle");
    inputRef.current?.click();
  };

  return (
    <div>
      <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
        Resume <span className="text-[#EF4444]">*</span>
      </label>

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
                {currentFilename ?? "Resume"}
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
              aria-label="Remove resume"
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
            className={`
              relative rounded-xl border-2 border-dashed px-6 py-8
              text-center cursor-pointer transition-all duration-300
              ${
                isDragOver
                  ? "border-[#1D9BF0] bg-[#1D9BF0]/10"
                  : displayError
                    ? "border-[#EF4444]/40 bg-[#EF4444]/5"
                    : "border-white/10 hover:border-white/20 bg-white/[0.02]"
              }
            `}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={displayError ? handleRetry : () => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleChange}
              className="hidden"
            />
            {displayError ? (
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-[#EF4444]" />
            ) : (
              <Upload
                className={`w-8 h-8 mx-auto mb-3 ${
                  isDragOver ? "text-[#1D9BF0]" : "text-[#6B7280]"
                }`}
              />
            )}
            <p className="text-sm text-[#9CA3AF] mb-1">
              <span className="text-[#F1FFFF] font-medium">
                {displayError ? "Try again" : "Click to upload"}
              </span>
              {!displayError && " or drag and drop"}
            </p>
            <p className="text-[10px] text-[#6B7280] font-mono">
              PDF only, max {MAX_RESUME_SIZE_MB}MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {displayError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-[#EF4444] mt-1.5 ml-1"
          >
            {displayError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
