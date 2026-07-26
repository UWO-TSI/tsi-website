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
import { FISH, RARITY_META, iconFor, type FishDef } from "@/lib/game/fishing";
import { AudioManager } from "@/lib/game/audio";
import { mergeWithLocal } from "@/lib/game/collections";
import { X } from "lucide-react";

interface Row {
  item_key: string;
  count: number;
}

// Almanac lookup (loop wake 29): clicking a DISCOVERED fish/sea-floor tile
// shows its field notes — window, size, zone, rarity. Only these two groups
// carry FishDef data; other groups' tiles stay non-interactive.
const FISH_BY_KEY = new Map<string, FishDef>(FISH.map((f) => [f.key, f]));

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
      ...FISH.filter((f) => !f.creature).map((f) => ({ key: f.key, img: iconFor(f), icon: f.rarity === "seaking" ? "👑" : f.rarity === "legendary" ? "✨" : "🐟", name: f.name, zone: f.zone ?? "river" })),
    ],
  },
  {
    // Sea-floor creatures (2026-07-24): pulled up at the deck + cove spots.
    group: "Sea Floor",
    items: [
      ...FISH.filter((f) => f.creature).map((f) => ({ key: f.key, img: iconFor(f), icon: "🦪", name: f.name })),
    ],
  },
  {
    // Critters pillar 2026-07: mirrors Critters.tsx SPECIES keys.
    group: "Bugs",
    items: [
      { key: "bug_common_butterfly", img: "/assets/acnh/icons/bug_common_butterfly.png", icon: "🦋", name: "Common Butterfly" },
      { key: "bug_agrias_butterfly", img: "/assets/acnh/icons/bug_agrias_butterfly.png", icon: "🦋", name: "Agrias Butterfly" },
      { key: "bug_emperor_butterfly", img: "/assets/acnh/icons/bug_emperor_butterfly.png", icon: "🦋", name: "Emperor Butterfly" },
      { key: "bug_monarch_butterfly", img: "/assets/acnh/icons/bug_monarch_butterfly.png", icon: "🦋", name: "Monarch Butterfly" },
      { key: "bug_tiger_butterfly", img: "/assets/acnh/icons/bug_tiger_butterfly.png", icon: "🦋", name: "Tiger Butterfly" },
      { key: "bug_peacock_butterfly", img: "/assets/acnh/icons/bug_peacock_butterfly.png", icon: "🦋", name: "Peacock Butterfly" },
      { key: "bug_darner_dragonfly", img: "/assets/acnh/icons/bug_darner_dragonfly.png", icon: "🪰", name: "Darner Dragonfly" },
      { key: "bug_red_dragonfly", img: "/assets/acnh/icons/bug_red_dragonfly.png", icon: "🪰", name: "Red Dragonfly" },
      { key: "bug_ladybug", img: "/assets/acnh/icons/bug_ladybug.png", icon: "🐞", name: "Ladybug" },
      { key: "bug_brown_cicada", img: "/assets/acnh/icons/bug_brown_cicada.png", icon: "🦗", name: "Brown Cicada" },
      { key: "bug_grasshopper", img: "/assets/acnh/icons/bug_grasshopper.png", icon: "🦗", name: "Grasshopper" },
      { key: "bug_mantis", img: "/assets/acnh/icons/bug_mantis.png", icon: "🦗", name: "Mantis" },
      { key: "bug_firefly", img: "/assets/acnh/icons/bug_firefly.png", icon: "✨", name: "Firefly" },
    ],
  },
  {
    // Shore critters v1 (2026-07-15): beach-band catchables.
    group: "Shore",
    items: [
      { key: "shore_gazami_crab", img: "/assets/acnh/icons/shore_gazami_crab.png", icon: "🦀", name: "Gazami Crab" },
      { key: "shore_hermit_crab", img: "/assets/acnh/icons/shore_hermit_crab.png", icon: "🐚", name: "Hermit Crab" },
    ],
  },
];

export default function CollectionBook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Starts true; each open resets it in the fetch's finally. Avoids a
  // synchronous setState-in-effect (react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(true);
  // Almanac pick (loop wake 29) — which discovered species' notes are open.
  const [detailKey, setDetailKey] = useState<string | null>(null);
  // Wake 71: the Fish group is ~78 species — habitat/caught filter chips.
  const [fishFilter, setFishFilter] = useState<"all" | "river" | "sea" | "caught">("all");

  // Loop iter 24 (2026-07-24): page-open beat — paper pop + page-turn
  // notes when the book opens.
  useEffect(() => {
    if (!open) return;
    AudioManager.playSFX("click");
    window.setTimeout(() => AudioManager.playSFX("blip1"), 110);
    let cancelled = false;
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .catch(() => ({ collections: [] }))
      .then((d: { collections?: Row[] }) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const row of d.collections ?? []) map[row.item_key] = row.count;
        Object.assign(map, mergeWithLocal(map));
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

  const detail = detailKey ? FISH_BY_KEY.get(detailKey) ?? null : null;
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
        animation: "cb-fade 0.18s ease-out",
      }}
    >
      <style>{`
        @keyframes cb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cb-unfold {
          0% { opacity: 0; transform: scale(0.92) rotate(-1.2deg) translateY(10px); }
          70% { opacity: 1; transform: scale(1.015) rotate(0.3deg) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) rotate(0) translateY(0); }
        }
      `}</style>
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
          animation: "cb-unfold 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
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

        {CATALOG.map((g) => {
          // Loop wake 27: per-group completion count — the Critterpedia
          // "how far along am I" read; gold ✓ once the group is complete.
          const got = g.items.filter((it) => (counts[it.key] ?? 0) > 0).length;
          const done = got === g.items.length;
          const isFish = g.group === "Fish";
          const shown = isFish
            ? g.items.filter((it) => {
                const zone = (it as { zone?: string }).zone;
                if (fishFilter === "river") return zone !== "sea";
                if (fishFilter === "sea") return zone === "sea";
                if (fishFilter === "caught") return (counts[it.key] ?? 0) > 0;
                return true;
              })
            : g.items;
          return (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#B0A17C",
                marginBottom: 8,
              }}
            >
              <span>{g.group}</span>
              {!loading && (
                <span style={{ color: done ? "#C9962E" : "#B0A17C", fontVariantNumeric: "tabular-nums" }}>
                  {done ? "✓ " : ""}{got}/{g.items.length}
                </span>
              )}
            </div>
            {isFish && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {([["all", "All"], ["river", "🏞 River"], ["sea", "🌊 Sea"], ["caught", "✓ Caught"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFishFilter(k)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1.5px solid ${fishFilter === k ? "#C9962E" : "#E0D2B0"}`,
                      background: fishFilter === k ? "#F8EFC9" : "#FFFDF5",
                      color: fishFilter === k ? "#7A5A10" : "#8A7B5E",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {shown.map((it) => {
                const n = counts[it.key] ?? 0;
                const have = n > 0;
                const almanac = have && FISH_BY_KEY.has(it.key);
                const picked = detailKey === it.key;
                return (
                  <div
                    key={it.key}
                    onClick={
                      almanac
                        ? () => {
                            setDetailKey((k) => (k === it.key ? null : it.key));
                            AudioManager.playSFX("blip1");
                          }
                        : undefined
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "12px 6px",
                      borderRadius: 12,
                      background: picked ? "#F8EFC9" : have ? "#F3ECD8" : "#F0EEE6",
                      border: `1px solid ${picked ? "#C9962E" : have ? "#E0D2B0" : "#E8E6DE"}`,
                      opacity: have ? 1 : 0.5,
                      cursor: almanac ? "pointer" : "default",
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
          );
        })}

        {/* Almanac strip — field notes for the picked species, pinned to the
            bottom of the book while scrolling. */}
        {detail && (
          <div
            style={{
              position: "sticky",
              bottom: -20,
              margin: "8px -8px -8px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FBF6E4",
              border: "2px solid #E0D2B0",
              borderRadius: 12,
              boxShadow: "0 -4px 12px rgba(60, 45, 20, 0.12)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconFor(detail)} alt="" width={40} height={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                {detail.name}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "1px 7px",
                    borderRadius: 999,
                    color: "#FFFDF5",
                    background: RARITY_META[detail.rarity].color,
                  }}
                >
                  {RARITY_META[detail.rarity].label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 400, color: "#8A7B5E" }}>
                  {(detail.zone ?? "river") === "sea" ? "🌊 sea" : "🏞 river"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#8A7B5E", marginTop: 2 }}>
                bites: {detail.whenLabel ?? "any time"} · {detail.sizeCm[0]}-{detail.sizeCm[1]} cm · caught ×
                {counts[detail.key] ?? 0}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
