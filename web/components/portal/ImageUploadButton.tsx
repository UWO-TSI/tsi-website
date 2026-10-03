"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/gui";

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

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />
      <Button
        size="sm"
        variant="quiet"
        onClick={handleClick}
        disabled={busy}
        className={className}
      >
        {busy ? (
          <>
            <Loader2 size={16} aria-hidden className="animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload size={16} aria-hidden />
            Upload an image
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-bold text-[var(--gui-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
