"use client";

/**
 * CollectionBook (cozy marathon G6) — the ACNH-style critterpedia/collection
 * viewer. A DOM overlay that fetches GET /api/collections and shows what the
 * member has shaken, picked, and caught, grouped by kind with emoji icons and
 * counts. Collectibles carry no TC/XP — this is the reward: a filling book.
 *
 * Undiscovered items render greyed with a "?" so there's a completion pull.
 */

import { useEffect, useRef, useState } from "react";
import { FISH, RARITY_META, iconFor, type FishDef } from "@/lib/game/fishing";
import { AudioManager } from "@/lib/game/audio";
import { localCollections, mergeWithLocal } from "@/lib/game/collections";
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

export default function CollectionBook({ open, onClose, collectionScope }: { open: boolean; onClose: () => void; collectionScope?: string }) {
  return open ? <OpenCollectionBook onClose={onClose} collectionScope={collectionScope} /> : null;
}

function OpenCollectionBook({ onClose, collectionScope }: { onClose: () => void; collectionScope?: string }) {
  const [counts, setCounts] = useState(() => localCollections(collectionScope));
  const [sync, setSync] = useState<"loading" | "synced" | "local">(collectionScope ? "local" : "loading");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [fishFilter, setFishFilter] = useState<"all" | "river" | "sea" | "caught">("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    AudioManager.playSFX("click");
    const sound = window.setTimeout(() => AudioManager.playSFX("blip1"), 110);
    const controller = new AbortController();
    let cancelled = false;
    if (collectionScope) return () => { window.clearTimeout(sound); controller.abort(); };
    fetch("/api/collections", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Collection sync unavailable");
        const d: { collections?: Row[] } = await r.json();
        if (!Array.isArray(d.collections)) throw new Error("Invalid collection response");
        const map = Object.fromEntries(d.collections.map((row) => [row.item_key, row.count]));
        if (!cancelled) {
          setCounts(mergeWithLocal(map, collectionScope));
          setSync("synced");
        }
      })
      .catch(() => { if (!cancelled) setSync("local"); });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(sound);
    };
  }, [collectionScope]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const index = buttons.findIndex((button) => button === document.activeElement);
        const next = e.shiftKey
          ? (index <= 0 ? buttons.length - 1 : index - 1)
          : (index + 1) % buttons.length;
        e.preventDefault();
        e.stopPropagation();
        buttons[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const detail = detailKey ? FISH_BY_KEY.get(detailKey) ?? null : null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const discovered = CATALOG.reduce(
    (n, g) => n + g.items.filter((it) => Object.hasOwn(counts, it.key)).length,
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
        .collection-book button:focus-visible { outline: 3px solid var(--app-link, #79601F); outline-offset: 3px; }
        @keyframes cb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cb-unfold {
          0% { opacity: 0; transform: scale(0.92) rotate(-1.2deg) translateY(10px); }
          70% { opacity: 1; transform: scale(1.015) rotate(0.3deg) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) rotate(0) translateY(0); }
        }
      `}</style>
      <div
        ref={dialogRef}
        className="collection-book"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-book-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 440px)",
          maxHeight: "82vh",
          overflowY: "auto",
          scrollPaddingTop: 140,
          scrollPaddingBottom: 90,
          background: "var(--app-surface, #FFFDF5)",
          border: "3px solid var(--app-line, #E0D2B0)",
          borderRadius: 20,
          padding: 20,
          boxShadow: "0 20px 60px rgba(60, 45, 20, 0.35)",
          fontFamily: "var(--font-highlight, sans-serif)",
          animation: "cb-unfold 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
          color: "var(--app-ink, #4A4034)",
        }}
      >
        <header style={{ position: "sticky", top: -20, zIndex: 2, background: "var(--app-surface, #FFFDF5)", margin: "-20px -20px 16px", padding: "16px 20px 12px", borderBottom: "1px solid var(--app-line, #E0D2B0)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <h2 id="collection-book-title" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🧺 Collection</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ display: "grid", placeItems: "center", width: 36, height: 36, background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "var(--app-muted, #6F624A)" }}
            >
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--app-muted, #8A7B5E)", marginTop: 0, marginBottom: 0 }}>
            {discovered}/{totalKinds} kinds discovered · {total} in your bag
            <span role="status" style={{ display: "block", marginTop: 4 }}>
              {collectionScope ? "Saved on this device · Just for fun" : sync === "loading" ? "Checking saved collection…" : sync === "local" ? "Showing this browser’s collection. Account sync unavailable." : "Saved collection loaded"}
            </span>
          </p>
        </header>

        {CATALOG.map((g) => {
          // Loop wake 27: per-group completion count — the Critterpedia
          // "how far along am I" read; gold ✓ once the group is complete.
          const got = g.items.filter((it) => Object.hasOwn(counts, it.key)).length;
          const done = got === g.items.length;
          const isFish = g.group === "Fish";
          const shown = isFish
            ? g.items.filter((it) => {
                const zone = (it as { zone?: string }).zone;
                if (fishFilter === "river") return zone !== "sea";
                if (fishFilter === "sea") return zone === "sea";
                if (fishFilter === "caught") return Object.hasOwn(counts, it.key);
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
                color: "var(--app-muted, #B0A17C)",
                marginBottom: 8,
              }}
            >
              <span>{g.group}</span>
              <span style={{ color: done ? "var(--app-link, #C9962E)" : "var(--app-muted, #B0A17C)", fontVariantNumeric: "tabular-nums" }}>
                {done ? "✓ " : ""}{got}/{g.items.length}
              </span>
            </div>
            {isFish && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {([["all", "All"], ["river", "🏞 River"], ["sea", "🌊 Sea"], ["caught", "✓ Discovered"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={fishFilter === k}
                    onClick={() => setFishFilter(k)}
                    style={{
                      padding: "3px 10px",
                      minHeight: 32,
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1.5px solid ${fishFilter === k ? "var(--app-link, #C9962E)" : "var(--app-line, #E0D2B0)"}`,
                      background: fishFilter === k ? "var(--app-soft, #F8EFC9)" : "var(--app-surface, #FFFDF5)",
                      color: fishFilter === k ? "var(--app-link, #7A5A10)" : "var(--app-muted, #8A7B5E)",
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
                const have = Object.hasOwn(counts, it.key);
                const almanac = have && FISH_BY_KEY.has(it.key);
                const picked = detailKey === it.key;
                const Tile = almanac ? "button" : "div";
                return (
                  <Tile
                    key={it.key}
                    {...(almanac ? { type: "button" as const, "aria-expanded": picked, "aria-controls": "collection-field-notes" } : {})}
                    onClick={
                      almanac
                        ? () => {
                            setDetailKey((k) => (k === it.key ? null : it.key));
                            AudioManager.playSFX("blip1");
                          }
                        : undefined
                    }
                    style={{
                      color: "inherit",
                      fontFamily: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "12px 6px",
                      borderRadius: 12,
                      background: picked ? "var(--app-soft, #F8EFC9)" : have ? "var(--app-soft, #F3ECD8)" : "var(--app-soft, #F0EEE6)",
                      border: `1px solid ${picked ? "var(--app-link, #C9962E)" : have ? "var(--app-line, #E0D2B0)" : "var(--app-soft, #E8E6DE)"}`,
                      opacity: have ? 1 : 0.5,
                      cursor: almanac ? "pointer" : "default",
                    }}
                  >
                    {have && it.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.img} alt="" width={34} height={34} style={{ imageRendering: "auto" }} />
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
                          color: "var(--app-muted, #8A7B5E)",
                          fontFamily: "monospace",
                        }}
                      >
                        ×{n}
                      </span>
                    )}
                  </Tile>
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
            id="collection-field-notes"
            role="region"
            aria-label={`${detail.name} field notes`}
            style={{
              position: "sticky",
              bottom: -20,
              margin: "8px -8px -8px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--app-soft, #FBF6E4)",
              border: "2px solid var(--app-line, #E0D2B0)",
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
                    color: "var(--app-surface, #FFFDF5)",
                    background: RARITY_META[detail.rarity].color,
                  }}
                >
                  {RARITY_META[detail.rarity].label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 400, color: "var(--app-muted, #8A7B5E)" }}>
                  {(detail.zone ?? "river") === "sea" ? "🌊 sea" : "🏞 river"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--app-muted, #8A7B5E)", marginTop: 2 }}>
                bites: {detail.whenLabel ?? "any time"} · {detail.sizeCm[0]}-{detail.sizeCm[1]} cm · in bag ×
                {counts[detail.key] ?? 0}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
