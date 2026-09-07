"use client";

import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { pollPresence, presenceRequest, PresenceRequestError, recentVisitors, type RecentVisitor } from "@/lib/game/mobilePresence";

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

// Roof colors track the ACNH building models (2026-07 revamp): RS purple,
// Nook's blue, museum teal, chalet gray thatch.
const BUILDINGS = [
  { id: "hq", name: "HQ", x: 0, z: -4, w: 6.1, h: 3, roof: "#5B4B9E" },
  { id: "shop", name: "Shop", x: -24, z: 12, w: 6.6, h: 3.6, roof: "#2B4EA0" },
  { id: "oracle", name: "Oracle", x: 0, z: 30, w: 6.8, h: 3.4, roof: "#2E8B8B" },
  { id: "house", name: "House", x: 24, z: 14, w: 5, h: 3.1, roof: "#8A7B6B" },
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

export interface MobilePresenceTransport {
  visitors: (signal: AbortSignal) => Promise<RecentVisitor[]>;
  heartbeat: (signal: AbortSignal) => Promise<void>;
  emoteTypes: (signal: AbortSignal) => Promise<Record<string, string>>;
  emote: (id: string, signal: AbortSignal) => Promise<void>;
}

async function presenceFetch(url: string, signal: AbortSignal, body?: object) {
  const response = await fetch(url, {
    signal,
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new PresenceRequestError(response.status);
  return response;
}

const mobileTransport: MobilePresenceTransport = {
  async visitors(signal) {
    const response = await presenceFetch("/api/positions/ghosts", signal);
    const data = await response.json();
    if (!Array.isArray(data?.ghosts)) throw new Error("Invalid visitor response");
    return recentVisitors(data.ghosts);
  },
  async heartbeat(signal) {
    await presenceFetch("/api/positions/heartbeat", signal, { world_x: PLAZA.x, world_z: PLAZA.z });
  },
  async emoteTypes(signal) {
    const { data, error } = await createClient().from("emote_types").select("id, slug").eq("active", true).abortSignal(signal);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((row) => [row.slug, row.id]));
  },
  async emote(id, signal) {
    await presenceFetch("/api/emotes/log", signal, { emote_type_id: id, world_x: PLAZA.x, world_z: PLAZA.z });
  },
};

interface EmoteBubble {
  id: string;
  x: number;
  z: number;
  glyph: string;
}

export default function MobileWorld({ onTry3D, transport = mobileTransport }: {
  onTry3D: () => void;
  transport?: MobilePresenceTransport;
}) {
  const [ghosts, setGhosts] = useState<RecentVisitor[]>([]);
  const [visitorsState, setVisitorsState] = useState<"loading" | "ready" | "error">("loading");
  const [presence, setPresence] = useState<"connecting" | "shared" | "offline" | "signed-out">("connecting");
  const [bubbles, setBubbles] = useState<EmoteBubble[]>([]);
  const [sending, setSending] = useState(false);
  const [emoteFeedback, setEmoteFeedback] = useState("");
  const emoteIdsRef = useRef<Record<string, string>>({});
  const pendingRef = useRef<AbortController | null>(null);
  const bubbleTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => pollPresence(transport.visitors, 60_000, (visitors) => {
    setGhosts(recentVisitors(visitors));
    setVisitorsState("ready");
  }, () => setVisitorsState("error")), [transport]);

  useEffect(() => pollPresence(transport.heartbeat, HEARTBEAT_MS,
    () => setPresence("shared"),
    (error) => setPresence(error instanceof PresenceRequestError && error.status === 401 ? "signed-out" : "offline"),
  ), [transport]);

  useEffect(() => {
    const controller = new AbortController();
    emoteIdsRef.current = {};
    void presenceRequest(transport.emoteTypes, controller.signal).then((ids) => {
      if (!controller.signal.aborted) emoteIdsRef.current = ids;
    }).catch(() => { /* Local bubbles remain available while emote types are unavailable. */ });
    return () => controller.abort();
  }, [transport]);

  useEffect(() => {
    const timers = bubbleTimers.current;
    return () => {
      pendingRef.current?.abort();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  async function sendEmote(slug: string, glyph: string) {
    if (pendingRef.current) return;
    const controller = new AbortController();
    pendingRef.current = controller;
    setSending(true);
    const bubble: EmoteBubble = { id: `${slug}-${Date.now()}`, x: PLAZA.x, z: PLAZA.z, glyph };
    setBubbles((b) => [...b.slice(-4), bubble]);
    const timer = setTimeout(() => {
      bubbleTimers.current.delete(timer);
      setBubbles((b) => b.filter((x) => x.id !== bubble.id));
    }, EMOTE_BUBBLE_MS);
    bubbleTimers.current.add(timer);
    const label = slug[0].toUpperCase() + slug.slice(1);
    const emoteId = emoteIdsRef.current[slug];
    try {
      if (emoteId) {
        setEmoteFeedback(`Sharing ${slug}…`);
        await presenceRequest((signal) => transport.emote(emoteId, signal), controller.signal);
        if (!controller.signal.aborted) setEmoteFeedback(`${label} shared`);
      } else {
        setEmoteFeedback(`${label} shown here. Sharing is unavailable.`);
      }
    } catch {
      if (!controller.signal.aborted) setEmoteFeedback(`${label} shown here. Couldn’t share it. Try again.`);
    } finally {
      if (pendingRef.current === controller) pendingRef.current = null;
      if (!controller.signal.aborted) setSending(false);
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
            {visitorsState === "loading" ? "Loading recent visitors…" : visitorsState === "error"
              ? "Recent visitors unavailable"
              : ghosts.length > 0 ? `${ghosts.length} recent visitor${ghosts.length === 1 ? "" : "s"}` : "No recent visitors"}
          </p>
        </div>
        <button
          onClick={onTry3D}
          className="flex items-center gap-1.5 font-mono rounded-lg"
          style={{
            fontSize: 11,
            minHeight: 44,
            flexShrink: 0,
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

      <p role="status" className="px-4 pb-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {presence === "connecting" ? "Connecting your presence…" : presence === "shared" ? "Your presence is shared at the plaza" : presence === "signed-out" ? "Sign in to share your presence" : "Presence unavailable. Reconnecting…"}
      </p>

      {/* Minimap */}
      <div className="flex-1 px-3 pb-2 min-h-0">
        <svg
          viewBox="-40 -40 80 78"
          className="w-full h-full rounded-2xl"
          style={{ background: "#7EB86A", border: "1px solid var(--glass-border-soft)" }}
          role="img"
          aria-label="Map of the TSI village with recent visitor positions"
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
          {(visitorsState === "error" ? [] : ghosts).map((g) => (
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

      <p role="status" className="px-4 pb-2 text-center text-xs min-h-8" style={{ color: "var(--color-text-muted)" }}>{emoteFeedback}</p>
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
