"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { MAX_RESUME_SIZE_BYTES, MAX_RESUME_SIZE_MB } from "@/lib/recruitment";

interface ResumeUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  error?: string;
}

export default function ResumeUpload({
  file,
  onFileSelect,
  error,
}: ResumeUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayError = error || localError;

  const validateFile = useCallback((f: File): boolean => {
    if (f.type !== "application/pdf") {
      setLocalError("Only PDF files are accepted.");
      return false;
    }
    if (f.size > MAX_RESUME_SIZE_BYTES) {
      setLocalError(`File must be under ${MAX_RESUME_SIZE_MB}MB.`);
      return false;
    }
    setLocalError(null);
    return true;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && validateFile(f)) onFileSelect(f);
    },
    [onFileSelect, validateFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && validateFile(f)) onFileSelect(f);
  };

  const handleRemove = () => {
    onFileSelect(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <label className="block font-mono text-xs text-[#9CA3AF] mb-2">
        Resume <span className="text-[#EF4444]">*</span>
      </label>

      <AnimatePresence mode="wait">
        {file ? (
          /* Uploaded state */
          <motion.div
            key="uploaded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-xl bg-[#002FA7]/10 border border-[#002FA7]/30 px-4 py-3"
          >
            <FileText className="w-5 h-5 text-[#002FA7] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1FFFF] truncate">{file.name}</p>
              <p className="text-[10px] text-[#6B7280] font-mono">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
            <button
              type="button"
              onClick={handleRemove}
              className="text-[#6B7280] hover:text-[#EF4444] transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          /* Upload zone */
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`
              relative rounded-xl border-2 border-dashed px-6 py-8
              text-center cursor-pointer transition-all duration-300
              ${isDragOver
                ? "border-[#002FA7] bg-[#002FA7]/10"
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
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleChange}
              className="hidden"
            />
            <Upload
              className={`w-8 h-8 mx-auto mb-3 ${
                isDragOver ? "text-[#002FA7]" : "text-[#6B7280]"
              }`}
            />
            <p className="text-sm text-[#9CA3AF] mb-1">
              <span className="text-[#F1FFFF] font-medium">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-[10px] text-[#6B7280] font-mono">
              PDF only, max {MAX_RESUME_SIZE_MB}MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
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
