"use client";

import { useState } from "react";

// Thin yellow banner that appears when ?preview=draft-<id> is in the URL.
// Surfaces Publish + Exit Preview controls for admin-flagged preview sessions.

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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: "#FFD166",
        color: "#1a1a1a",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        fontSize: "13px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      <span>
        Previewing draft. Live members see the published version.
        {message ? `  ${message}` : ""}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handlePublish}
          disabled={busy}
          style={{
            background: "#1a1a1a",
            color: "#FFD166",
            border: "none",
            borderRadius: "4px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Publishing..." : "Publish"}
        </button>
        <button
          onClick={handleExit}
          disabled={busy}
          style={{
            background: "transparent",
            color: "#1a1a1a",
            border: "1px solid #1a1a1a",
            borderRadius: "4px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Exit Preview
        </button>
      </div>
    </div>
  );
}
