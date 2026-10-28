"use client";

/**
 * The raid's call (specs/launch/v1-gameplay.md, "Fish tiers and fights": a divine catch is the whole shard's fight):
 * while someone's divine raid runs and you're not in it, a banner says so with a button to join from wherever you are
 * (FishingOverlay takes `tsi:raid-join`: the creature surfaces, then your reel). Behind NEXT_PUBLIC_FISH_BOSSES.
 */
import { FISH } from "@/lib/game/fishing";
import { useRaid } from "@/lib/net/raid";

export default function RaidCall() {
  const raid = useRaid();
  if (!raid.id || raid.joined || raid.result) return null;
  const name = FISH.find((f) => f.key === raid.fish)?.name ?? "Something huge";
  return (
    <div role="status" data-raid-call style={{
      position: "fixed", top: 76, left: "50%", transform: "translateX(-50%)", zIndex: 55, display: "flex", alignItems: "center", gap: 12,
      padding: "8px 10px 8px 16px", borderRadius: 999, background: "rgb(255 251 231 / 0.96)", boxShadow: "0 4px 14px rgba(60, 45, 20, 0.22), inset 0 0 0 2px #b77dee",
      fontFamily: "var(--font-highlight, sans-serif)", color: "var(--gui-ink-strong, #4A4034)", fontSize: 14, fontWeight: 700, zoom: "var(--gui-overlay-zoom, 1)",
    }}>
      <span>{name} surfaced! {raid.helpers} reeling</span>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("tsi:raid-join"))} style={{
        border: 0, borderRadius: 999, padding: "6px 14px", background: "#b77dee", color: "#fffef6", font: "inherit", cursor: "pointer",
      }}>Join the raid</button>
    </div>
  );
}
