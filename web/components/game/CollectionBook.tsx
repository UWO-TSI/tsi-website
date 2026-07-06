"use client";

/**
 * CollectionBook (cozy marathon G6) — the ACNH-style critterpedia/collection
 * viewer. A DOM overlay that fetches GET /api/collections and shows what the
 * member has shaken, picked, and caught, grouped by kind with emoji icons and
 * counts. Collectibles carry no TC/XP — this is the reward: a filling book.
 *
 * Undiscovered items render greyed with a "?" so there's a completion pull.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Row {
  item_key: string;
  count: number;
}

const CATALOG: { group: string; items: { key: string; icon: string; name: string }[] }[] = [
  {
    group: "Fruit",
    items: [
      { key: "apple", icon: "🍎", name: "Apple" },
      { key: "peach", icon: "🍑", name: "Peach" },
      { key: "acorn", icon: "🌰", name: "Acorn" },
      { key: "petal", icon: "🌸", name: "Cherry petal" },
    ],
  },
  {
    // ACNH revamp 2026-07: species-true entries matching FLOWER_MODELS.
    // Legacy generic keys retired pre-launch (no real member data).
    group: "Flowers",
    items: [
      { key: "flower_cosmos", icon: "🌸", name: "Pink cosmos" },
      { key: "flower_lily", icon: "🌺", name: "White lily" },
      { key: "flower_hyacinth", icon: "🪻", name: "Blue hyacinth" },
      { key: "flower_mum", icon: "🌼", name: "Yellow mum" },
      { key: "flower_rose", icon: "🌹", name: "Red rose" },
      { key: "flower_tulip", icon: "🌷", name: "Orange tulip" },
      { key: "flower_pansy", icon: "💮", name: "Purple pansy" },
      { key: "flower_windflower", icon: "🏵️", name: "Windflower" },
    ],
  },
  {
    group: "Fish",
    items: [
      { key: "fish_common", icon: "🐟", name: "Pond fish" },
      { key: "fish_river", icon: "🎣", name: "River fish" },
      { key: "fish_rare", icon: "✨", name: "Golden Koi" },
    ],
  },
];

export default function CollectionBook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Starts true; each open resets it in the fetch's finally. Avoids a
  // synchronous setState-in-effect (react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((d: { collections?: Row[] }) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const row of d.collections ?? []) map[row.item_key] = row.count;
        setCounts(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const discovered = CATALOG.reduce(
    (n, g) => n + g.items.filter((it) => (counts[it.key] ?? 0) > 0).length,
    0
  );
  const totalKinds = CATALOG.reduce((n, g) => n + g.items.length, 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        background: "rgba(20, 16, 8, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 440px)",
          maxHeight: "82vh",
          overflowY: "auto",
          background: "#FFFDF5",
          border: "3px solid #E0D2B0",
          borderRadius: 20,
          padding: 20,
          boxShadow: "0 20px 60px rgba(60, 45, 20, 0.35)",
          fontFamily: "var(--font-highlight, sans-serif)",
          color: "#4A4034",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🧺 Collection</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#8A7B5E" }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#8A7B5E", marginTop: 0, marginBottom: 16 }}>
          {loading
            ? "Opening the book…"
            : `${discovered}/${totalKinds} kinds discovered · ${total} collected`}
        </p>

        {CATALOG.map((g) => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#B0A17C",
                marginBottom: 8,
              }}
            >
              {g.group}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {g.items.map((it) => {
                const n = counts[it.key] ?? 0;
                const have = n > 0;
                return (
                  <div
                    key={it.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "12px 6px",
                      borderRadius: 12,
                      background: have ? "#F3ECD8" : "#F0EEE6",
                      border: `1px solid ${have ? "#E0D2B0" : "#E8E6DE"}`,
                      opacity: have ? 1 : 0.5,
                    }}
                  >
                    <span style={{ fontSize: 26, filter: have ? "none" : "grayscale(1)" }}>
                      {have ? it.icon : "❔"}
                    </span>
                    <span style={{ fontSize: 11, textAlign: "center", lineHeight: 1.2 }}>
                      {have ? it.name : "???"}
                    </span>
                    {have && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#8A7B5E",
                          fontFamily: "monospace",
                        }}
                      >
                        ×{n}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
