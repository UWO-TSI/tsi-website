"use client";

/**
 * CharacterCreate — the first thing an applicant sees: name, year,
 * program. Saves to the member `profiles` row (PATCH /api/profile), so a
 * hired applicant walks into the member world as the same character.
 * Appearance options arrive with David's new sprite sheet.
 */

import { useState } from "react";
import { YEAR_OPTIONS } from "@/lib/recruitment";
import type { Profile } from "@/lib/supabase/types";

export default function CharacterCreate({
  profile,
  email,
  onDone,
  local = false,
}: {
  profile: Profile | null;
  email: string;
  onDone: (saved: { display_name: string; year: string; program: string }) => void;
  /** Preview mode: skip the PATCH, just report the values. */
  local?: boolean;
}) {
  const [name, setName] = useState(profile?.display_name && !profile.display_name.includes("@") ? profile.display_name : "");
  const [year, setYear] = useState(profile?.year ?? "");
  const [program, setProgram] = useState(profile?.program ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length > 1 && !!year && program.trim().length > 1;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    const saved = { display_name: name.trim(), year, program: program.trim() };
    if (local) {
      onDone(saved);
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saved),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't save. Try again.");
        setSaving(false);
        return;
      }
      onDone(saved);
    } catch {
      setError("Network error. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6, 8, 12, 0.62)",
        backdropFilter: "blur(4px)",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{
          width: "min(560px, 92vw)",
          background: "linear-gradient(160deg, rgba(20,22,30,0.98), rgba(15,15,16,0.98))",
          border: "1px solid rgba(255,212,128,0.35)",
          borderRadius: 16,
          padding: "30px 32px",
          color: "#F1FFFF",
          boxShadow: "0 18px 60px rgba(0,0,0,0.6)",
        }}
      >
        <p style={{ fontSize: 11, color: "#FFD166", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
          Create your character
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>Who&apos;s walking in?</h2>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 22, lineHeight: 1.5 }}>
          This is your name tag in the world and the top of every application you send. Signed in as {email}.
        </p>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={labelStyle}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            placeholder="How the recruiters should address you"
            style={inputStyle}
          />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Year</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {YEAR_OPTIONS.map((y) => {
              const v = String(y.value);
              const on = year === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setYear(v)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    cursor: "pointer",
                    background: on ? "#1D9BF0" : "rgba(255,255,255,0.04)",
                    color: on ? "#F1FFFF" : "#9CA3AF",
                    border: `1px solid ${on ? "#1D9BF0" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {y.label}
                </button>
              );
            })}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 22 }}>
          <span style={labelStyle}>Program</span>
          <input
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            maxLength={100}
            placeholder="Software Engineering, Ivey HBA, Media..."
            style={inputStyle}
          />
        </label>

        {error && (
          <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!ready || saving}
          style={{
            width: "100%",
            background: ready ? "linear-gradient(180deg, #FFD166, #E8A93C)" : "rgba(255,255,255,0.08)",
            color: ready ? "#1A1410" : "#6B7280",
            border: "none",
            borderRadius: 8,
            padding: "13px 16px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: ready ? "pointer" : "default",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {saving ? "Saving..." : "Enter the island"}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#9CA3AF",
  fontFamily: "'IBM Plex Mono', monospace",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#F1FFFF",
  fontSize: 14,
  outline: "none",
};
