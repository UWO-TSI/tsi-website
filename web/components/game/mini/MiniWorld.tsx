"use client";

/**
 * MiniWorld — the applicant island shell: Canvas, the outside/inside
 * switch, the single E-key handler, and the DOM overlays (load gate,
 * character creation, welcome primer, apply sheet, HUD). A trimmed fork
 * of GameWorld's shell with everything the applicant doesn't need cut.
 *
 * Flow: character creation → spawn → walk to HQ → E → office → desk → E →
 * apply sheet → submit → desk reads "Applied".
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { WarmupProbe, LoadGateOverlay } from "../LoadGate";
import Crosshair from "../Crosshair";
import ToastHub from "../ToastHub";
import PostFX from "../PostFX";
import { useTransition } from "../TransitionOverlay";
import { AudioManager } from "@/lib/game/audio";
import type { InteriorStation } from "../interiorShared";
import MiniScene, { type MiniNearest } from "./MiniScene";
import RecruitOffice from "./RecruitOffice";
import ApplyWelcomeOverlay from "./ApplyWelcomeOverlay";
import ApplySheet, { type AppliedInfo } from "./ApplySheet";
import CharacterCreate from "./CharacterCreate";
import FishingOverlay from "../FishingOverlay";
import CollectionBook from "../CollectionBook";
import { pickFlower } from "@/lib/game/flowerPicks";
import { setFishingHour } from "@/lib/game/fishing";
import { layoutDesks, HQ_EXIT_SPAWN, MINI_SPAWN, PORTAL_HOUR, type Desk } from "@/lib/game/miniIsland";
import { createClient } from "@/lib/supabase/client";
import type { Position, ApplicationStatus } from "@/lib/recruitment";
import type { Profile } from "@/lib/supabase/types";
// Curved-world + aerial fog are global shader patches; they must load
// before the first material compiles, same as GameWorld.
import "@/lib/game/curvedWorld";
import "@/lib/game/aerialFog";

const SKY_BASE = "#F2DCB8";

type Nearest = MiniNearest | { kind: "station"; id: string; name: string; stationAction: string } | null;

interface AppRow {
  position_id: string;
  status: ApplicationStatus;
  submitted_at: string;
}

export interface MiniWorldSession {
  userId: string;
  email: string;
  profile: Profile | null;
  /** Dev/preview mode: mock positions, no writes. */
  preview?: { positions: Position[] };
}

function characterReady(p: Profile | null): boolean {
  return !!p && !!p.year && !!p.program && !!p.display_name && !p.display_name.includes("@");
}

export default function MiniWorld({ session }: { session: MiniWorldSession }) {
  const { triggerTransition, isTransitioning } = useTransition();
  const [profile, setProfile] = useState<Profile | null>(session.profile);
  const [creating, setCreating] = useState(() => !characterReady(session.profile));
  const [worldReady, setWorldReady] = useState(false);
  const [gateDone, setGateDone] = useState(false);
  const [interior, setInterior] = useState<"office" | null>(null);
  const interiorRef = useRef<"office" | null>(null);
  useEffect(() => { interiorRef.current = interior; }, [interior]);
  const [spawn, setSpawn] = useState<[number, number, number] | undefined>(undefined);
  const [nearest, setNearest] = useState<Nearest>(null);
  const nearestRef = useRef<Nearest>(null);
  useEffect(() => { nearestRef.current = nearest; }, [nearest]);
  const [sheetDesk, setSheetDesk] = useState<Desk | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeBump, setWelcomeBump] = useState(0);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [positions, setPositions] = useState<Position[]>(session.preview?.positions ?? []);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(...MINI_SPAWN));

  // Species availability follows the island's pinned hour, not the wall clock.
  useEffect(() => {
    setFishingHour(PORTAL_HOUR);
    return () => setFishingHour(null);
  }, []);

  const playerName = profile?.display_name && !profile.display_name.includes("@") ? profile.display_name : "Applicant";

  // Open roles → desks.
  useEffect(() => {
    if (session.preview) return;
    let cancelled = false;
    fetch("/api/positions")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Position[]) => {
        if (!cancelled) setPositions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session.preview]);

  // The applicant's own applications (RLS: own rows only).
  const loadApplications = useCallback(async () => {
    if (session.preview) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("applications")
        .select("position_id, status, submitted_at")
        .eq("user_id", session.userId);
      setApplications((data as AppRow[]) ?? []);
    } catch {
      /* offline: desks just show as open */
    }
  }, [session.preview, session.userId]);
  useEffect(() => {
    const t = setTimeout(() => void loadApplications(), 0);
    return () => clearTimeout(t);
  }, [loadApplications]);

  const desks = useMemo(() => layoutDesks(positions), [positions]);
  const appliedIds = useMemo(() => new Set(applications.map((a) => a.position_id)), [applications]);
  const appliedFor = useCallback(
    (desk: Desk | null): AppliedInfo | null => {
      if (!desk) return null;
      const row = applications.find((a) => a.position_id === desk.position.id);
      return row ? { status: row.status, submitted_at: row.submitted_at } : null;
    },
    [applications]
  );

  const frozen = !!sheetDesk || creating || welcomeVisible || collectionOpen || isTransitioning || !gateDone;
  const frozenRef = useRef(frozen);
  useEffect(() => { frozenRef.current = frozen; }, [frozen]);
  const desksRef = useRef(desks);
  useEffect(() => { desksRef.current = desks; }, [desks]);

  // The one key: E. Everything else is the sheet's / primer's own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" && e.key !== "E") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (frozenRef.current) return;
      const n = nearestRef.current;
      if (!n) return;
      e.preventDefault();
      if (n.kind === "building" && !interiorRef.current) {
        triggerTransition(() => {
          setInterior("office");
          setNearest(null);
        });
        AudioManager.playSFX("exit");
        return;
      }
      // The member world's collectibles, same events, same FX layers.
      if (n.kind === "fishing") {
        window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: n.spot[0], z: n.spot[1], zone: "sea" } }));
        return;
      }
      if (n.kind === "flower") {
        if (pickFlower(n.flowerIdx)) {
          window.dispatchEvent(new CustomEvent("tsi:flower-pick", { detail: { x: n.flowerPos[0], z: n.flowerPos[1], idx: n.flowerIdx } }));
        }
        return;
      }
      if (n.kind === "tree") {
        window.dispatchEvent(new CustomEvent("tsi:tree-shake", { detail: { x: n.treePos[0], z: n.treePos[1], species: n.species } }));
        return;
      }
      if (n.kind === "critter") {
        window.dispatchEvent(new CustomEvent("tsi:critter-catch", { detail: { slot: n.critterSlot } }));
        return;
      }
      if (n.kind === "station") {
        if (n.stationAction === "exit") {
          triggerTransition(() => {
            setSpawn(HQ_EXIT_SPAWN);
            setInterior(null);
            setNearest(null);
          });
          AudioManager.playSFX("exit");
        } else if (n.stationAction.startsWith("apply:")) {
          const slug = n.stationAction.slice(6);
          const desk = desksRef.current.find((d) => d.position.slug === slug) ?? null;
          if (desk) {
            AudioManager.playSFX("confirm");
            setSheetDesk(desk);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerTransition]);

  const handleNearestStation = useCallback((st: InteriorStation | null) => {
    setNearest(st ? { kind: "station", id: `station-${st.id}`, name: st.name, stationAction: st.action } : null);
  }, []);
  const handleNearestOutside = useCallback((n: MiniNearest | null) => setNearest(n), []);
  const handleMove = useCallback(() => {}, []);
  const handleWelcomeVisibility = useCallback((v: boolean) => setWelcomeVisible(v), []);

  const closeSheet = useCallback(() => setSheetDesk(null), []);
  const handleSubmitted = useCallback(() => {
    void loadApplications();
    window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Application sent." } }));
  }, [loadApplications]);

  const finishCreate = useCallback(async (saved: { display_name: string; year: string; program: string }) => {
    setProfile((p) => ({ ...(p ?? ({} as Profile)), ...saved }));
    if (!session.preview) {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) setProfile(data.profile as Profile);
        }
      } catch {
        /* keep what we have */
      }
    }
    setCreating(false);
  }, [session.preview]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: SKY_BASE,
        position: "relative",
        cursor: nearest
          ? 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27><circle cx=%2712%27 cy=%2712%27 r=%277%27 fill=%27none%27 stroke=%27%23FFDD87%27 stroke-width=%273%27/><circle cx=%2712%27 cy=%2712%27 r=%272%27 fill=%27%23FFDD87%27/></svg>") 12 12, pointer'
          : "default",
      }}
    >
      <Canvas
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={0.66} /* the member world's pixelated mode: render low, upscale nearest */
        camera={{ fov: 48, near: 0.1, far: 320, position: [0, 17, -26] }}
        shadows="soft"
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.style.imageRendering = "pixelated";
        }}
      >
        <WarmupProbe onReady={() => setWorldReady(true)} />
        {interior === "office" ? (
          <RecruitOffice
            desks={desks}
            appliedIds={appliedIds}
            frozen={frozen}
            playerPosRef={playerPosRef}
            onNearestStation={handleNearestStation}
          />
        ) : (
          <Suspense fallback={null}>
            <MiniScene
              playerName={playerName}
              spawn={spawn}
              frozen={frozen}
              playerPosRef={playerPosRef}
              onMove={handleMove}
              onNearest={handleNearestOutside}
            />
            <PostFX enabled bloom={false} bloomIntensity={0.18} />
          </Suspense>
        )}
      </Canvas>

      {!gateDone && <LoadGateOverlay ready={worldReady} onGone={() => setGateDone(true)} />}

      {creating && gateDone && (
        <CharacterCreate profile={profile} email={session.email} onDone={finishCreate} local={!!session.preview} />
      )}
      {gateDone && !creating && (
        <ApplyWelcomeOverlay onVisibility={handleWelcomeVisibility} forceShow={welcomeBump} />
      )}

      <Crosshair active={nearest !== null && !frozen} hint={nearest?.name ?? null} />

      <FishingOverlay />
      <CollectionBook open={collectionOpen} onClose={() => setCollectionOpen(false)} />

      <ApplySheet
        desk={sheetDesk}
        userId={session.userId}
        email={session.email}
        profile={profile}
        applied={appliedFor(sheetDesk)}
        onClose={closeSheet}
        onSubmitted={handleSubmitted}
      />

      {/* HUD */}
      {gateDone && (
        <>
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 18,
              zIndex: 60,
              fontFamily: "'IBM Plex Mono', monospace",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
              Tethos application portal
            </div>
            <div style={{ fontSize: 12, color: "#F1FFFF", marginTop: 2 }}>
              {interior ? "Recruitment Office" : "Explore, then head to HQ"}
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 16, right: 18, zIndex: 60, display: "flex", gap: 8 }}>
            <HudButton onClick={() => setCollectionOpen((o) => !o)}>Items</HudButton>
            <HudButton onClick={() => setCreating(true)}>Character</HudButton>
            <HudButton onClick={() => setWelcomeBump((n) => n + 1)}>Keys</HudButton>
            <HudButton href="/student/apply">Leave</HudButton>
          </div>
        </>
      )}
      <ToastHub />
    </div>
  );
}

function HudButton({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const style: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.06em",
    color: "#F1FFFF",
    background: "rgba(15,15,16,0.62)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 999,
    padding: "7px 14px",
    cursor: "pointer",
    textDecoration: "none",
    backdropFilter: "blur(6px)",
  };
  if (href) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {children}
    </button>
  );
}
