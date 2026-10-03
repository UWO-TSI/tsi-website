"use client";

/**
 * CollectionBook (cozy marathon G6) — the ACNH-style critterpedia/collection
 * viewer. A DOM overlay that fetches GET /api/collections and shows what the
 * member has shaken, picked, and caught, grouped by kind with their rendered
 * icons and counts. Collectibles carry no TC/XP — this is the reward: a filling book.
 *
 * Undiscovered items show as a soft silhouette of their icon, a completion pull.
 */

import { useEffect, useState } from "react";
import { FISH, RARITY_META, type FishDef } from "@/lib/game/fishing";
import { RarityBadge } from "@/components/gui";
import { iconUrl } from "@/lib/icons/keys";
import { ROSTER } from "@/lib/collections/roster";
import { AudioManager } from "@/lib/game/audio";
import { localCollections, mergeWithLocal } from "@/lib/game/collections";
import { Check, X } from "lucide-react";
import JournalPages, { fetchJournalPage } from "./JournalPages";
import { useWorldDialog } from "@/lib/game/useWorldDialog";

interface Row {
  item_key: string;
  count: number;
}

// Almanac lookup (loop wake 29): clicking a DISCOVERED fish/sea-floor tile
// shows its field notes — window, size, zone, rarity. Only these two groups
// carry FishDef data; other groups' tiles stay non-interactive.
const FISH_BY_KEY = new Map<string, FishDef>(FISH.map((f) => [f.key, f]));

// Every entry's icon is rendered from its model (row 281, lib/icons); one not found yet shows as its silhouette.
const CATALOG: { group: string; items: { key: string; name: string; zone?: string }[] }[] = [
  // The roster's groups (lib/collections/roster.ts); fish and the sea floor are the reel's own (FISH, with their zones).
  { group: "Fruit", items: ROSTER.filter((sp) => sp.category === "fruit") },
  { group: "Flowers", items: ROSTER.filter((sp) => sp.sub === "flower") },
  { group: "Shells and mushrooms", items: ROSTER.filter((sp) => sp.sub === "shell" || sp.sub === "mushroom") },
  { group: "Rocks and ore", items: ROSTER.filter((sp) => sp.category === "mineral") },
  { group: "Fish", items: FISH.filter((f) => !f.creature).map((f) => ({ key: f.key, name: f.name, zone: f.zone ?? "river" })) },
  { group: "Sea Floor", items: FISH.filter((f) => f.creature).map((f) => ({ key: f.key, name: f.name })) },
  { group: "Bugs", items: ROSTER.filter((sp) => sp.category === "bug") },
  { group: "Shore", items: ROSTER.filter((sp) => sp.key.startsWith("shore_")) },
];

/**
 * `keys`: the key that opened it (the member world's Collection key), which closes it too. Shared with the applicant
 * island: its colours come from the --app-* tokens there; inside the member world's .gui scope they are the GUI sheet's.
 */
export default function CollectionBook({ open, onClose, collectionScope, keys }: { open: boolean; onClose: () => void; collectionScope?: string; keys?: string }) {
  return open ? <OpenCollectionBook onClose={onClose} collectionScope={collectionScope} keys={keys} /> : null;
}

/** 11 px on the applicant island, the sheet's 12 px floor in the member world. */
const SMALL = "max(11px, var(--gui-min-text, 0px))";

function OpenCollectionBook({ onClose, collectionScope, keys }: { onClose: () => void; collectionScope?: string; keys?: string }) {
  const [counts, setCounts] = useState(() => localCollections(collectionScope));
  const [sync, setSync] = useState<"loading" | "synced" | "local">(collectionScope ? "local" : "loading");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [fishFilter, setFishFilter] = useState<"all" | "river" | "sea" | "caught">("all");
  // Journal pages from /api/collections/journal when the server has them; the local catalog otherwise.
  const [journal, setJournal] = useState<Awaited<ReturnType<typeof fetchJournalPage>>>(null);
  useEffect(() => {
    if (collectionScope) return;
    let alive = true;
    void fetchJournalPage("fish").then(p => { if (alive) setJournal(p); });
    return () => { alive = false; };
  }, [collectionScope]);
  // The one dialog system (focus in and back, Escape and the opening key, the world held still, the paper sound).
  const dialogRef = useWorldDialog<HTMLDivElement>(true, onClose, keys);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (collectionScope) return () => { controller.abort(); };
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
    };
  }, [collectionScope]);

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
            <h2 id="collection-book-title" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Collection</h2>
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
              {collectionScope ? "Saved on this device · Just for fun" : sync === "loading" ? "Checking saved collection…" : sync === "local" ? "Showing this browser’s collection: your account’s copy didn’t load." : null}
            </span>
          </p>
        </header>


        {journal ? <JournalPages initial={journal} /> : CATALOG.map((g) => {
          // Loop wake 27: per-group completion count — the Critterpedia
          // "how far along am I" read; a gold check once the group is complete.
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
                fontSize: SMALL,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--app-muted, #B0A17C)",
                marginBottom: 8,
              }}
            >
              <span>{g.group}</span>
              <span style={{ color: done ? "var(--app-link, #C9962E)" : "var(--app-muted, #B0A17C)", fontVariantNumeric: "tabular-nums" }}>
                {done ? <Check size={11} strokeWidth={3} aria-label="Complete" style={{ verticalAlign: -1, marginRight: 3 }} /> : null}{got}/{g.items.length}
              </span>
            </div>
            {isFish && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {([["all", "All"], ["river", "River"], ["sea", "Sea"], ["caught", "Discovered"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={fishFilter === k}
                    onClick={() => setFishFilter(k)}
                    style={{
                      padding: "3px 10px",
                      minHeight: 32,
                      borderRadius: 7,
                      fontSize: SMALL,
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={iconUrl(it.key)} alt="" width={40} height={40} style={have ? undefined : { filter: "brightness(0)", opacity: 0.16 }} />
                    <span style={{ fontSize: SMALL, textAlign: "center", lineHeight: 1.2 }}>
                      {have ? it.name : "???"}
                    </span>
                    {have && (
                      <span
                        style={{
                          fontSize: SMALL,
                          fontWeight: 700,
                          color: "var(--app-muted, #8A7B5E)",
                          fontFamily: "var(--gui-mono, monospace)",
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
            <img src={iconUrl(detail.key)} alt="" width={40} height={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                {detail.name}
                {/* The one rarity palette (the catch card's and the journal's too). */}
                <RarityBadge rarity={detail.rarity}>{RARITY_META[detail.rarity].label}</RarityBadge>
                <span style={{ fontSize: "max(10px, var(--gui-min-text, 0px))", fontWeight: 400, color: "var(--app-muted, #8A7B5E)" }}>
                  {(detail.zone ?? "river") === "sea" ? "sea" : "river"}
                </span>
              </div>
              <div style={{ fontSize: SMALL, color: "var(--app-muted, #8A7B5E)", marginTop: 2 }}>
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
