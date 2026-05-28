"use client";
import { useServerOnline } from "@/lib/game/useServerOnline";

/**
 * Sprint F1.3 — DOM overlay shown while the user holds Tab.
 * Lists members currently in the world (online + recently here), all
 * permanent NPCs, and events starting within the next hour.
 *
 * Rendered as a sibling of the R3F Canvas, NOT inside it.
 */

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return "1d+ ago";
}

function eventTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 5) return "starting";
  return `in ${mins}m`;
}

export default function ServerListOverlay({ visible }: { visible: boolean }) {
  const { data } = useServerOnline(visible);
  if (!visible) return null;

  const totalHere = data.online.length + data.npcs.length;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        background: "rgba(0, 0, 0, 0.45)",
        pointerEvents: "none",
        zIndex: 50,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <div
        style={{
          width: "min(600px, 90vw)",
          background: "rgba(15, 15, 16, 0.92)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "8px",
          padding: "16px",
          color: "#f1ffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em" }}>TSI WORLD</div>
          <div style={{ fontSize: "11px", color: "#8a939a" }}>{totalHere} here · hold Tab</div>
        </div>

        {data.online.length > 0 && (
          <Section title="Online now" dotColor="#7CB342">
            {data.online.map((p) => (
              <Row
                key={p.user_id}
                dot="#7CB342"
                name={p.display_name}
                meta={`Lv${p.level}${p.class ? " · " + p.class : ""}`}
                right="now"
              />
            ))}
          </Section>
        )}

        {data.recent.length > 0 && (
          <Section title="Recently here" dotColor="#FFD166">
            {data.recent.map((p) => (
              <Row
                key={p.user_id}
                dot="#FFD166"
                name={p.display_name}
                meta={`Lv${p.level}`}
                right={relativeTime(p.recorded_at)}
              />
            ))}
          </Section>
        )}

        <Section title="NPCs" dotColor="#8a939a">
          {data.npcs.map((n) => (
            <Row key={n.id} dot="#8a939a" name={n.display_name} meta={n.spawn_zone} right="" />
          ))}
        </Section>

        {data.events.length > 0 && (
          <Section title="Happening soon" dotColor="#FF7518">
            {data.events.map((e) => (
              <Row
                key={e.id}
                dot="#FF7518"
                name={e.title}
                meta={e.location ?? ""}
                right={eventTime(e.start_time)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, dotColor, children }: { title: string; dotColor: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontSize: "11px",
          color: "#8a939a",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ dot, name, meta, right }: { dot: string; name: string; meta: string; right: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {meta && <span style={{ color: "#8a939a", fontSize: "11px" }}>{meta}</span>}
      </div>
      {right && <span style={{ color: "#8a939a", fontSize: "11px", flexShrink: 0, marginLeft: "8px" }}>{right}</span>}
    </div>
  );
}
