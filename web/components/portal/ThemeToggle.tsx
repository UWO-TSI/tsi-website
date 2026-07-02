"use client";

import { useEffect, useState, useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

// ─── ThemeToggle (R3-2) ─────────────────────────────────────────────────────
// 3-button radio: Light / Dark / System.
// Persists choice to localStorage["tsi.theme"] ∈ "light" | "dark" | "system".
// On first load (no localStorage entry) uses prefers-color-scheme to pick;
// default behavior remains dark (current portal look).
// Writes data-theme="light"|"dark" to document.documentElement on apply.
// Game world (web/components/game/**) does NOT read these tokens — TOD palette
// is independent.

type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "tsi.theme";

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const resolved: "light" | "dark" =
    pref === "system" ? resolveSystem() : pref;
  document.documentElement.setAttribute("data-theme", resolved);
}

function readStoredPref(): ThemePref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return null;
  } catch {
    return null;
  }
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Mounts once in the dashboard layout so the stored theme applies on every
 * portal page load. Without this, data-theme is only set when the user visits
 * Settings → Appearance (the only place ThemeToggle itself mounts), so a saved
 * "light" preference silently reverts to dark on any other page.
 */
export function ThemeInit() {
  useEffect(() => {
    applyTheme(readStoredPref() ?? "system");
  }, []);
  return null;
}

export default function ThemeToggle() {
  // Initial render uses "dark" so SSR + first paint match the current default.
  // Real preference is read on mount.
  const [pref, setPref] = useState<ThemePref>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredPref();
    if (stored) {
      setPref(stored);
      applyTheme(stored);
    } else {
      // First load: pick from system, but don't persist — user hasn't chosen.
      const systemPick: ThemePref = "system";
      setPref(systemPick);
      applyTheme(systemPick);
    }
    setMounted(true);
  }, []);

  // Re-resolve on OS-level change when user is on "system".
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("system");
    try {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } catch {
      // Safari < 14 fallback
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, [pref]);

  const choose = useCallback((next: ThemePref) => {
    setPref(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="flex items-start gap-3">
      <Sun className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-text-muted)" }} />
      <div className="flex-1">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-main)" }}>
          Theme
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-subtle)" }}>
          Choose how the portal looks. The game world keeps its own lighting.
        </p>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="theme-toggle-radio"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = mounted && pref === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => choose(value)}
                className="theme-toggle-option flex items-center justify-center gap-2 transition-colors"
                style={{
                  flex: "1 1 0",
                  minWidth: 96,
                  height: 40,
                  padding: "0 12px",
                  background: isActive
                    ? "rgba(29, 155, 240, 0.12)"
                    : "var(--surface-hover)",
                  border: isActive
                    ? "1px solid var(--color-brand-blue, #1d9bf0)"
                    : "1px solid var(--glass-border-soft)",
                  borderRadius: 8,
                  color: isActive
                    ? "var(--color-text-main)"
                    : "var(--color-text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
        <style jsx>{`
          @media (max-width: 380px) {
            .theme-toggle-radio {
              flex-direction: column;
            }
            .theme-toggle-radio :global(.theme-toggle-option) {
              width: 100%;
              flex: 0 0 auto;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
