"use client";

// Multi-file optional uploader. Used in two spots:
//   1. Resume step (VP Marketing) — broader portfolio of work
//   2. Essay step (VP Marketing + VP Internal) — role-specific submission
// Each upload goes to the "portfolios" Supabase bucket via a server-issued
// signed URL. Up to MAX_FILES, image/video/PDF/zip up to 50 MB each.

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_MB = 50;
const MAX_FILES = 10;

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

export interface PortfolioFile {
  path: string;
  filename: string;
  size: number;
}

interface PortfolioUploadProps {
  positionSlug: string;
  files: PortfolioFile[];
  onChange: (files: PortfolioFile[]) => void;
  label?: string;
  description?: string;
}

export default function PortfolioUpload({
  positionSlug,
  files,
  onChange,
  label = "Portfolio (optional)",
  description = "Drop creative pieces (image, video, PDF, or zip up to 50MB each), or paste a hosted link below.",
}: PortfolioUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const validate = useCallback((f: File): string | null => {
    if (f.size > MAX_BYTES) return `${f.name}: file must be under ${MAX_MB}MB.`;
    if (f.size === 0) return `${f.name} appears to be empty.`;
    if (!ACCEPTED.includes(f.type) && f.type !== "") {
      return `${f.name}: use image, video, PDF, or zip.`;
    }
    return null;
  }, []);

  const uploadOne = useCallback(
    async (f: File): Promise<PortfolioFile> => {
      const signRes = await fetch("/api/resume-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          bucket: "portfolios",
          positionSlug,
          filename: f.name,
        }),
      });
      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}));
        throw new Error(body?.error || "Couldn't start upload.");
      }
      const { path, token } = await signRes.json();

      const { error: uploadErr } = await supabase.storage
        .from("portfolios")
        .uploadToSignedUrl(path, token, f, {
          contentType: f.type || "application/octet-stream",
        });
      if (uploadErr) {
        throw new Error(
          uploadErr.message?.toLowerCase().includes("payload")
            ? `${f.name}: file must be under ${MAX_MB}MB.`
            : uploadErr.message || `${f.name}: upload failed.`
        );
      }
      return { path, filename: f.name, size: f.size };
    },
    [supabase, positionSlug]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setLocalError(null);
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;
      if (files.length + incoming.length > MAX_FILES) {
        setLocalError(`Up to ${MAX_FILES} files total.`);
        return;
      }
      for (const f of incoming) {
        const err = validate(f);
        if (err) {
          setLocalError(err);
          return;
        }
      }
      setUploading(true);
      const uploaded: PortfolioFile[] = [];
      try {
        for (const f of incoming) {
          uploaded.push(await uploadOne(f));
        }
        onChange([...files, ...uploaded]);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [files, validate, uploadOne, onChange]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    if (e.target) e.target.value = "";
  };

  const removeFile = async (index: number) => {
    const target = files[index];
    onChange(files.filter((_, i) => i !== index));
    if (target) {
      try {
        await fetch("/api/resume-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "delete",
            bucket: "portfolios",
            path: target.path,
          }),
        });
      } catch {
        // non-blocking
      }
    }
  };

  const showDropzone = files.length === 0 && !uploading;

  return (
    <div>
      <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
        {label}
      </label>
      <p className="text-xs text-[#6B7280] mb-3 leading-relaxed">
        {description}
      </p>

      <AnimatePresence initial={false}>
        {files.map((f, i) => (
          <motion.div
            key={f.path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 px-4 py-3 mb-2"
          >
            <FileText className="w-5 h-5 text-[#1D9BF0] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1FFFF] truncate">{f.filename}</p>
              <p className="text-[10px] text-[#6B7280] font-mono">
                {(f.size / 1024 / 1024).toFixed(2)} MB · uploaded
              </p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] flex-shrink-0" />
            <button
              type="button"
              onClick={() => removeFile(i)}
              className="text-[#6B7280] hover:text-[#EF4444] transition flex-shrink-0"
              aria-label={`Remove ${f.filename}`}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {uploading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 mb-2"
        >
          <Loader2 className="w-5 h-5 text-[#1D9BF0] flex-shrink-0 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#F1FFFF]">Uploading…</p>
            <p className="text-[10px] text-[#6B7280] font-mono">
              Don&apos;t close this tab
            </p>
          </div>
        </motion.div>
      )}

      {showDropzone ? (
        <div
          className={`relative rounded-xl border-2 border-dashed px-6 py-6 text-center cursor-pointer transition-all duration-300 ${
            localError
              ? "border-[#EF4444]/40 bg-[#EF4444]/5"
              : "border-white/10 hover:border-white/20 bg-white/[0.02]"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            onChange={handleChange}
            className="hidden"
          />
          {localError ? (
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[#EF4444]" />
          ) : (
            <Upload className="w-6 h-6 mx-auto mb-2 text-[#6B7280]" />
          )}
          <p className="text-sm text-[#9CA3AF]">
            <span className="text-[#F1FFFF] font-medium">
              {localError ? "Try again" : "Click to upload"}
            </span>
            {!localError && " or drag and drop"}
          </p>
          <p className="text-[10px] text-[#6B7280] font-mono mt-1">
            Image, video, PDF, or zip · max {MAX_MB}MB · multiple OK
          </p>
        </div>
      ) : !uploading && files.length < MAX_FILES ? (
        <button
          type="button"
          onClick={() => addInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#F1FFFF] transition-colors mt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add another file
          <input
            ref={addInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            onChange={handleChange}
            className="hidden"
          />
        </button>
      ) : null}

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
