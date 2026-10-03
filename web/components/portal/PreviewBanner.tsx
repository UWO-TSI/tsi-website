"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/gui";

// Thin butter banner that appears when ?preview=draft-<id> is in the URL.
// Surfaces Publish + Exit preview controls for admin-flagged preview sessions.
// It sits above the portal shell's .gui scope, so it carries the scope itself.

function readDraftIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const match = params.get("preview")?.match(/^draft-(.+)$/);
  return match?.[1] ?? null;
}

export default function PreviewBanner() {
  const [draftId] = useState<string | null>(() => readDraftIdFromUrl());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!draftId) return null;

  async function handlePublish() {
    if (!draftId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/content/drafts/${draftId}/publish`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMessage(body.error ?? "Publish failed");
        setBusy(false);
        return;
      }
      // Strip preview param and refresh into live state
      const url = new URL(window.location.href);
      url.searchParams.delete("preview");
      window.location.replace(url.toString());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Publish failed");
      setBusy(false);
    }
  }

  function handleExit() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("preview");
    window.location.replace(url.toString());
  }

  return (
    <div
      className="gui"
      role="region"
      aria-label="Draft preview"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: "var(--gui-confetti) var(--gui-butter)",
        color: "var(--gui-ink-strong)",
        padding: "8px 16px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px 12px",
        fontSize: "14px",
        fontWeight: 700,
        boxShadow: "var(--gui-shadow-sm)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Eye size={18} aria-hidden style={{ flex: "none" }} />
        <span>
          You’re previewing a draft. Members still see the published version.
          {message ? <strong role="alert" style={{ fontWeight: 800 }}> {message}</strong> : null}
        </span>
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button size="sm" onClick={handlePublish} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </Button>
        <Button size="sm" variant="quiet" onClick={handleExit} disabled={busy}>
          Exit preview
        </Button>
      </div>
    </div>
  );
}
