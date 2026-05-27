"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

// ─── ImageUploadButton ──────────────────────────────────────────────────────
// Small companion to the sprite_url text field on the NPC and Shop editors.
// Click → opens a file picker → POSTs multipart/form-data to /api/content/upload
// → calls onUpload(url) with the returned public URL. The text input is the
// source of truth; this component just fills it.
//
// No new deps. Native <input type="file"> + fetch + FormData.

interface ImageUploadButtonProps {
  onUpload: (url: string) => void;
  className?: string;
}

export default function ImageUploadButton({
  onUpload,
  className,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (busy) return;
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/content/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.url) {
        setError(body.error ?? "Upload failed");
        return;
      }
      onUpload(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const btnCls =
    className ??
    "inline-flex items-center gap-2 px-3 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-xs uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={btnCls}
      >
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload size={14} />
            Upload image
          </>
        )}
      </button>
      {error ? (
        <p className="mt-1 text-xs font-mono text-[var(--color-accent-red,#ff6b6b)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
