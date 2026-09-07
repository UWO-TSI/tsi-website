"use client";
import { useServerOnline } from "@/lib/game/useServerOnline";
import { presenceAge, upcomingTime, type OnlineData } from "@/lib/game/serverPresence";
import { PresenceRequestError } from "@/lib/game/mobilePresence";

/**
 * Sprint F1.3 — DOM overlay shown while the user holds Tab.
 * Lists members currently in the world (online + recently here), all
 * permanent NPCs, and events starting within the next hour.
 *
 * Rendered as a sibling of the R3F Canvas, NOT inside it.
 */

export default function ServerListOverlay({ visible }: { visible: boolean }) {
  const { data, error, isLoading } = useServerOnline(visible);
  if (!visible) return null;
  return <ServerListView data={data} status={error ? "error" : isLoading ? "loading" : "ready"} signedOut={error instanceof PresenceRequestError && error.status === 401} />;
}

export function ServerListView({ data, status, signedOut = false }: { data: OnlineData; status: "loading" | "ready" | "error"; signedOut?: boolean }) {
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
        role="region"
        aria-label="Member presence"
        style={{
          pointerEvents: "auto",
          maxHeight: "min(78dvh, calc(100% - 24px))",
          overflowY: "auto",
          width: 600,
          maxWidth: "calc(100% - 24px)",
          background: "rgba(15, 15, 16, 0.92)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "8px",
          padding: "16px",
          color: "#f1ffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em" }}>TSI WORLD</div>
          <div style={{ fontSize: "11px", color: "#A9B8C4" }}>hold Tab</div>
        </div>

        {status === "loading" && <p role="status" style={{ fontSize: 12, color: "#A9B8C4" }}>Checking member presence…</p>}
        {status === "error" && <p role="status" style={{ fontSize: 12, color: "#DCC9AE" }}>{signedOut ? "Sign in to see member presence." : "Member presence is unavailable. Try again shortly."}</p>}
        {status === "ready" && <>
        {data.online.length === 0 && data.recent.length === 0 && <p style={{ fontSize: 12, color: "#A9B8C4", marginBottom: 12 }}>No member activity in the past 24 hours.</p>}
        {data.online.length > 0 && (
          <Section title="Active in the last 5 minutes" dotColor="#7CB342">
            {data.online.map((p) => (
              <Row
                key={p.user_id}
                dot="#7CB342"
                name={p.display_name}
                meta={`Lv${p.level}${p.class ? " · " + p.class : ""}`}
                right={presenceAge(p.recorded_at)}
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
                right={presenceAge(p.recorded_at)}
              />
            ))}
          </Section>
        )}

        {data.npcs.length > 0 && <Section title="Village NPCs" dotColor="#8a939a">
          {data.npcs.map((n) => (
            <Row key={n.id} dot="#8a939a" name={n.display_name} meta={n.spawn_zone} right="" />
          ))}
        </Section>}

        {data.events.length > 0 && (
          <Section title="Happening soon" dotColor="#FF7518">
            {data.events.map((e) => (
              <Row
                key={e.id}
                dot="#FF7518"
                name={e.title}
                meta={e.location ?? ""}
                right={upcomingTime(e.start_time)}
              />
            ))}
          </Section>
        )}
        </>}
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
          color: "#A9B8C4",
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
        {meta && <span style={{ color: "#A9B8C4", fontSize: "11px" }}>{meta}</span>}
      </div>
      {right && <span style={{ color: "#A9B8C4", fontSize: "11px", flexShrink: 0, marginLeft: "8px" }}>{right}</span>}
    </div>
  );
}
