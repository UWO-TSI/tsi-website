"use client";

/**
 * /lab/gui — the GUI sheet showroom (specs/polish/gui-sheet.md). Dev only (the lab layout 404s in production).
 * `?only=<id>` shows one specimen full screen, for screenshots.
 */
import { useEffect, useState, type ReactNode } from "react";
import FishReveal from "@/components/game/FishReveal";
import { FamilyReveal } from "@/components/game/oracle/OracleSheetEmbed";
import IncantationOverlay from "@/components/game/combat/IncantationOverlay";
import { EmoteMenuView } from "@/components/game/EmoteMenu";
import { FISH } from "@/lib/game/fishing";
import type { EmoteType } from "@/lib/content/types";
import { useSearch } from "@/lib/game/useMediaQuery";

const EMOTES: EmoteType[] = ["wave", "dance", "laugh", "point", "sit"].map(slug => ({
  id: slug, slug, display_name: slug[0].toUpperCase() + slug.slice(1), animation_key: slug, icon_url: null, unlock_condition: null, active: true, created_at: "",
}));

/** Re-mounts its child every `ms` (an overlay that finishes and closes itself stays on show). */
function Loop({ ms, children }: { ms: number; children: (done: () => void) => ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setN(v => v + 1), ms); return () => window.clearInterval(t); }, [ms]);
  return <div key={n} style={{ display: "contents" }}>{children(() => {})}</div>;
}

const SPECIMENS: { id: string; title: string; render: () => ReactNode }[] = [
  { id: "fish-reveal", title: "Fish reveal", render: () => <Loop ms={9000}>{done => <FishReveal fish={FISH.find(f => f.rarity === "rare") ?? FISH[0]} sizeCm={42} onDone={done} />}</Loop> },
  { id: "oracle-reveal", title: "Oracle reveal card", render: () => <FamilyReveal family="Warden" type="INFP" onContinue={() => {}} /> },
  { id: "rune", title: "Rune overlay", render: () => <Loop ms={30000}>{done => <IncantationOverlay runeId="cross" title="Cross" effect="A warding cross" onDone={done} onCancel={done} />}</Loop> },
  { id: "emotes", title: "Emote menu", render: () => <EmoteMenuView open emotes={EMOTES} onClose={() => {}} onPick={() => {}} /> },
];

/** A world-ish backdrop that also contains fixed-position overlays (the transform makes it their containing block). */
function Stage({ children, tall }: { children: ReactNode; tall?: boolean }) {
  return <div style={{ position: "relative", height: tall ? "calc(100vh - 40px)" : 520, overflow: "hidden", transform: "translateZ(0)", borderRadius: tall ? 0 : 18,
    background: "linear-gradient(180deg, #9fd3e6 0%, #cfe8d8 55%, #9cc58a 56%, #86b878 100%)" }}>{children}</div>;
}

export default function GuiShowroom() {
  const search = useSearch();
  const only = search === null ? null : new URLSearchParams(search).get("only");
  const one = SPECIMENS.find(s => s.id === only);
  if (one) return <Stage tall>{one.render()}</Stage>;
  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px", display: "grid", gap: 28 }}>
    <h1>GUI sheet</h1>
    {SPECIMENS.map(s => <section key={s.id} id={s.id}><h2>{s.title}</h2><Stage>{s.render()}</Stage></section>)}
  </main>;
}
