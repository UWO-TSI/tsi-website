"use client";

import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── MobileWorld (Tier-2 #11, stripped mode v1) ─────────────────────────────
// David's 2026-07-03 rulings: phones get a 2D SVG minimap with member dots
// instead of the WebGL world; mobile sessions heartbeat player_positions at
// the HQ plaza so desktop players see them as ghosts (principle #5 "appear
// online"); emotes post from mobile at the plaza coords; RSVP cut from v1.
//
// World → SVG mapping: world x → svg x, world z → svg -y (Oracle Temple at
// +z reads as "north" per the compass, so it draws at the top). Building
// coords + palette mirror GameWorld.tsx BUILDINGS.

const PLAZA: { x: number; z: number } = { x: 0, z: -8 };
const HEARTBEAT_MS = 45_000;
const EMOTE_BUBBLE_MS = 3_500;

const BUILDINGS = [
  { id: "hq", name: "HQ", x: 0, z: -4, w: 6, h: 5, roof: "#E87B5A" },
  { id: "shop", name: "Shop", x: -14, z: 8, w: 4, h: 4, roof: "#5BA086" },
  { id: "oracle", name: "Oracle", x: 0, z: 22, w: 5, h: 5, roof: "#7B5EA7" },
  { id: "house", name: "House", x: 14, z: 10, w: 3.5, h: 3.5, roof: "#7EB8C9" },
];

// Matches migration 019's seeded emote_types (icon_url NULL → emoji glyphs,
// same mapping EmoteMenu.tsx uses for its fallback pills).
const EMOTES = [
  { slug: "wave", glyph: "👋" },
  { slug: "dance", glyph: "🕺" },
  { slug: "laugh", glyph: "😂" },
  { slug: "point", glyph: "👉" },
  { slug: "sit", glyph: "🪑" },
];

interface Ghost {
  user_id: string;
  world_x: number;
  world_z: number;
  display_name?: string;
}

interface EmoteBubble {
  id: string;
  x: number;
  z: number;
  glyph: string;
}

export default function MobileWorld({ onTry3D }: { onTry3D: () => void }) {
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [bubbles, setBubbles] = useState<EmoteBubble[]>([]);
  const [sending, setSending] = useState(false);
  const emoteIdsRef = useRef<Record<string, string>>({});

  // Presence in: recent member positions (same feed the desktop ghost replay
  // uses). Poll at 60s — this is ambience, not realtime.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/positions/ghosts");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setGhosts((data.ghosts ?? data ?? []).slice(0, 20));
      } catch {
        /* offline / logged out — map just shows no dots */
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Presence out: heartbeat at the HQ plaza so this member appears online
  // in-world for desktop players (principle #5).
  useEffect(() => {
    async function beat() {
      try {
        await fetch("/api/positions/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ world_x: PLAZA.x, world_z: PLAZA.z }),
        });
      } catch {
        /* ignore */
      }
    }
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, []);

  // Emote type ids come from the emote_types table (seeded in 019). Fetched
  // once, keyed by slug; if the table is unreachable the buttons still show
  // a local bubble so the interaction never feels dead.
  useEffect(() => {
    let cancelled = false;
    async function loadTypes() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("emote_types")
          .select("id, slug")
          .eq("active", true);
        if (!cancelled && data) {
          const map: Record<string, string> = {};
          for (const row of data as { id: string; slug: string }[]) map[row.slug] = row.id;
          emoteIdsRef.current = map;
        }
      } catch {
        /* fallback: local-only bubbles */
      }
    }
    loadTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendEmote(slug: string, glyph: string) {
    if (sending) return;
    setSending(true);
    const bubble: EmoteBubble = {
      id: `${slug}-${Date.now()}`,
      x: PLAZA.x,
      z: PLAZA.z,
      glyph,
    };
    setBubbles((b) => [...b.slice(-4), bubble]);
    setTimeout(
      () => setBubbles((b) => b.filter((x) => x.id !== bubble.id)),
      EMOTE_BUBBLE_MS
    );
    try {
      const emoteId = emoteIdsRef.current[slug];
      if (emoteId) {
        await fetch("/api/emotes/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emote_type_id: emoteId,
            world_x: PLAZA.x,
            world_z: PLAZA.z,
          }),
        });
      }
    } catch {
      /* the local bubble already showed; log failure is non-fatal */
    } finally {
      setSending(false);
    }
  }

  const sx = (x: number) => x;
  const sy = (z: number) => -z;

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: "var(--color-bg-main)" }}
      data-testid="mobile-world"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4" style={{ paddingTop: 60, paddingBottom: 8 }}>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--color-text-subtle)" }}>
            TSI World · lite
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {ghosts.length > 0
              ? `${ghosts.length} member${ghosts.length === 1 ? "" : "s"} around recently`
              : "The village is quiet right now"}
          </p>
        </div>
        <button
          onClick={onTry3D}
          className="flex items-center gap-1.5 font-mono rounded-lg"
          style={{
            fontSize: 11,
            padding: "6px 10px",
            border: "1px solid var(--glass-border-soft)",
            color: "var(--color-text-muted)",
            background: "var(--surface-chip)",
          }}
        >
          <Expand style={{ width: 12, height: 12 }} aria-hidden />
          Try full 3D
        </button>
      </div>

      {/* Minimap */}
      <div className="flex-1 px-3 pb-2 min-h-0">
        <svg
          viewBox="-30 -32 60 62"
          className="w-full h-full rounded-2xl"
          style={{ background: "#7EB86A", border: "1px solid var(--glass-border-soft)" }}
          role="img"
          aria-label="Map of the TSI village showing who is around"
        >
          {/* Paths — the main cross through spawn, matching the world layout */}
          <path d="M -28 4 L 28 4" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <path d="M 0 -28 L 0 26" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          {/* River band along the east, bridge notch */}
          <path d="M 18 -30 C 24 -12, 20 6, 26 30" stroke="#69A8D0" strokeWidth="4.5" fill="none" opacity="0.85" />
          <rect x="18.5" y="-5.6" width="6" height="3" rx="0.8" fill="#8B6B4A" />

          {/* Buildings */}
          {BUILDINGS.map((b) => (
            <g key={b.id}>
              <rect
                x={sx(b.x) - b.w / 2}
                y={sy(b.z) - b.h / 2}
                width={b.w}
                height={b.h}
                rx={1}
                fill={b.roof}
                opacity="0.95"
              />
              <text
                x={sx(b.x)}
                y={sy(b.z) + b.h / 2 + 2.6}
                textAnchor="middle"
                fontSize="2.6"
                fontFamily="monospace"
                fill="#1A2E1A"
              >
                {b.name}
              </text>
            </g>
          ))}

          {/* Recent member dots */}
          {ghosts.map((g) => (
            <g key={g.user_id}>
              <circle cx={sx(g.world_x)} cy={sy(g.world_z)} r="1.4" fill="#F1FFFF" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2.4s" repeatCount="indefinite" />
              </circle>
              {g.display_name && (
                <text
                  x={sx(g.world_x)}
                  y={sy(g.world_z) - 2}
                  textAnchor="middle"
                  fontSize="2.2"
                  fontFamily="monospace"
                  fill="#F1FFFF"
                  opacity="0.85"
                >
                  {g.display_name}
                </text>
              )}
            </g>
          ))}

          {/* You, at the HQ plaza */}
          <g>
            <circle cx={sx(PLAZA.x)} cy={sy(PLAZA.z)} r="1.8" fill="#1D9BF0" stroke="#F1FFFF" strokeWidth="0.5" />
            <text x={sx(PLAZA.x)} y={sy(PLAZA.z) + 4.2} textAnchor="middle" fontSize="2.4" fontFamily="monospace" fill="#F1FFFF">
              you
            </text>
          </g>

          {/* Emote bubbles */}
          {bubbles.map((b) => (
            <text key={b.id} x={sx(b.x) + 2} y={sy(b.z) - 3} fontSize="5" textAnchor="middle">
              {b.glyph}
            </text>
          ))}
        </svg>
      </div>

      {/* Emote bar */}
      <div className="flex items-center justify-center gap-2 px-4" style={{ paddingBottom: 18 }}>
        {EMOTES.map((e) => (
          <button
            key={e.slug}
            onClick={() => sendEmote(e.slug, e.glyph)}
            disabled={sending}
            aria-label={`Send ${e.slug} emote`}
            className="rounded-full transition-transform active:scale-90"
            style={{
              width: 44,
              height: 44,
              fontSize: 20,
              background: "var(--surface-chip)",
              border: "1px solid var(--glass-border-soft)",
            }}
          >
            {e.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
