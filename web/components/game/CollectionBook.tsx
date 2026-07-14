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

// img: rendered ACNH icon (assets/acnh/icons, 2026-07-13); emoji stays the fallback.
const CATALOG: { group: string; items: { key: string; icon: string; img?: string; name: string }[] }[] = [
  {
    group: "Fruit",
    items: [
      { key: "apple", img: "/assets/acnh/icons/apple.png", icon: "🍎", name: "Apple" },
      { key: "peach", img: "/assets/acnh/icons/peach.png", icon: "🍑", name: "Peach" },
      { key: "acorn", img: "/assets/acnh/icons/acorn.png", icon: "🌰", name: "Acorn" },
      { key: "petal", img: "/assets/acnh/icons/petal.png", icon: "🌸", name: "Cherry petal" },
    ],
  },
  {
    // ACNH revamp 2026-07: species-true entries matching FLOWER_MODELS.
    // Legacy generic keys retired pre-launch (no real member data).
    group: "Flowers",
    items: [
      { key: "flower_cosmos", img: "/assets/acnh/icons/flower_cosmos.png", icon: "🌸", name: "Pink cosmos" },
      { key: "flower_lily", img: "/assets/acnh/icons/flower_lily.png", icon: "🌺", name: "White lily" },
      { key: "flower_hyacinth", img: "/assets/acnh/icons/flower_hyacinth.png", icon: "🪻", name: "Blue hyacinth" },
      { key: "flower_mum", img: "/assets/acnh/icons/flower_mum.png", icon: "🌼", name: "Yellow mum" },
      { key: "flower_rose", img: "/assets/acnh/icons/flower_rose.png", icon: "🌹", name: "Red rose" },
      { key: "flower_tulip", img: "/assets/acnh/icons/flower_tulip.png", icon: "🌷", name: "Orange tulip" },
      { key: "flower_pansy", img: "/assets/acnh/icons/flower_pansy.png", icon: "💮", name: "Purple pansy" },
      { key: "flower_windflower", img: "/assets/acnh/icons/flower_windflower.png", icon: "🏵️", name: "Windflower" },
    ],
  },
  {
    // ACNH revamp 2026-07: species-true entries matching FishingOverlay.
    // Legacy generic keys retired pre-launch (no real member data).
    group: "Fish",
    items: [
      { key: "fish_dace", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Dace" },
      { key: "fish_crucian_carp", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Crucian Carp" },
      { key: "fish_bluegill", img: "/assets/acnh/icons/fish.png", icon: "🐠", name: "Bluegill" },
      { key: "fish_black_bass", img: "/assets/acnh/icons/fish.png", icon: "🐡", name: "Black Bass" },
      { key: "fish_carp", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Carp" },
      { key: "fish_goldfish", img: "/assets/acnh/icons/fish.png", icon: "🐠", name: "Goldfish" },
      { key: "fish_pale_chub", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Pale Chub" },
      { key: "fish_pond_smelt", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Pond Smelt" },
      { key: "fish_catfish", img: "/assets/acnh/icons/fish.png", icon: "🐟", name: "Catfish" },
      { key: "fish_golden_koi", img: "/assets/acnh/icons/fish.png", icon: "✨", name: "Golden Koi" },
    ],
  },
  {
    // Critters pillar 2026-07: mirrors Critters.tsx SPECIES keys.
    group: "Bugs",
    items: [
      { key: "bug_common_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Common Butterfly" },
      { key: "bug_agrias_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Agrias Butterfly" },
      { key: "bug_emperor_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Emperor Butterfly" },
      { key: "bug_monarch_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Monarch Butterfly" },
      { key: "bug_tiger_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Tiger Butterfly" },
      { key: "bug_peacock_butterfly", img: "/assets/acnh/icons/insect.png", icon: "🦋", name: "Peacock Butterfly" },
      { key: "bug_darner_dragonfly", img: "/assets/acnh/icons/insect.png", icon: "🪰", name: "Darner Dragonfly" },
      { key: "bug_red_dragonfly", img: "/assets/acnh/icons/insect.png", icon: "🪰", name: "Red Dragonfly" },
      { key: "bug_ladybug", img: "/assets/acnh/icons/insect.png", icon: "🐞", name: "Ladybug" },
      { key: "bug_brown_cicada", img: "/assets/acnh/icons/insect.png", icon: "🦗", name: "Brown Cicada" },
      { key: "bug_grasshopper", img: "/assets/acnh/icons/insect.png", icon: "🦗", name: "Grasshopper" },
      { key: "bug_mantis", img: "/assets/acnh/icons/insect.png", icon: "🦗", name: "Mantis" },
      { key: "bug_firefly", img: "/assets/acnh/icons/insect.png", icon: "✨", name: "Firefly" },
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
                    {have && it.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.img} alt={it.name} width={34} height={34} style={{ imageRendering: "auto" }} />
                    ) : (
                      <span style={{ fontSize: 26, filter: have ? "none" : "grayscale(1)" }}>
                        {have ? it.icon : "❔"}
                      </span>
                    )}
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
