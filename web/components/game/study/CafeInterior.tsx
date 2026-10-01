"use client";

/**
 * The café (specs/cafe-polish.md item 7, row 270): the premium interior from
 * David's four references, hand-modeled in art/cafe/build_cafe.py. Warm wood
 * panelling, the long espresso bar with its order counter, pastry case and
 * pick-up end, lightbox signs and menu boards, a window wall, about twenty
 * seats (lib/study/seats.ts) through StudySeats, the owner behind the bar and
 * ambient patrons. Warm, dim amber light from three lights and the glowing
 * signs, panels and sconces. The walker is PlayerAvatar (walk only) so
 * `tsi:sit` works; the wall board opens the top-studiers sheet.
 *
 * Dev (evidence): `?cafecam=x,y,z,lx,ly,lz[&fov=60]` holds the camera at a
 * reference's angle, which also shows the ceiling the game camera cuts away.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "../PlayerAvatar";
import { applyInteriorBackdrop, followInteriorCamera } from "../interiorShared";
import ContactShadows from "../ContactShadows";
import CafeOwner from "./CafeOwner";
import CafePatrons from "./CafePatrons";
import CafeSigns from "./CafeSigns";
import StudySeats from "./StudySeats";
import { useCafeModel, preloadCafe } from "./CafeModel";
import { useNPCPersonas } from "@/lib/content/loader";
import type { IslandPhase } from "@/lib/game/islandTime";
import type { WorldIdentity } from "@/lib/game/identity";
import { standWorld } from "@/lib/game/movement/sim";
import { studyHoldsPrompt } from "@/lib/study/worldStore";
import { CAFE_BOARD, CAFE_DOOR, CAFE_EXIT_RANGE, CAFE_ROOM, CAFE_SPAWN, CAFE_WINDOW, OWNER_TALK, cafeWalkable } from "@/lib/game/cafe";
import world from "../DefaultIslandWorld.module.css";

const flat = () => 0;
const SPAWN: [number, number, number] = [CAFE_SPAWN[0], 0, CAFE_SPAWN[1]];
/** The café floor for the movement kit: inside the walls, clear of the bar, the shelves, the plants and the study tables. */
const CAFE = standWorld(flat, (x, z) => cafeWalkable(x, z), () => false);
preloadCafe(["cafe-room", "cafe-kit"]);

/** Outside the window wall, per phase: sky, a haze band and the far hedge line. */
const OUTSIDE: Record<IslandPhase, [string, string, string]> = {
  dawn: ["#f4c9a8", "#f7dcc0", "#8f8a6a"], day: ["#bfe0ec", "#e8f0e2", "#7f9f6a"],
  evening: ["#e98f5a", "#f6c28a", "#6a5040"], night: ["#16203a", "#26304e", "#141a26"],
};

function outsideTexture(phase: IslandPhase) {
  const [sky, haze, hedge] = OUTSIDE[phase];
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, sky); grad.addColorStop(0.62, haze); grad.addColorStop(1, haze);
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // A soft line of bushes and tree crowns along the bottom: the village beyond the glass, out of focus.
  g.fillStyle = hedge;
  g.filter = "blur(6px)";
  for (let i = 0; i < 26; i++) { const x = (i * 97) % 540 - 10, r = 22 + ((i * 37) % 30); g.beginPath(); g.arc(x, 236 - ((i * 53) % 40), r, 0, Math.PI * 2); g.fill(); }
  g.fillRect(0, 220, 512, 36);
  if (phase === "night") { g.filter = "blur(2px)"; g.fillStyle = "#ffd58a"; for (const [x, y] of [[80, 196], [300, 205], [430, 190]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); } }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Outside({ phase }: { phase: IslandPhase }) {
  const texture = useMemo(() => outsideTexture(phase), [phase]);
  useEffect(() => () => texture.dispose(), [texture]);
  const { z0, z1, y0, y1 } = CAFE_WINDOW;
  return <mesh position={[-CAFE_ROOM.halfW - 0.75, (y0 + y1) / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]}>
    <planeGeometry args={[z1 - z0 + 1.2, y1 - y0 + 0.8]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

/** Module scope (the react compiler forbids writing through hook values): the dollhouse cut and the dev camera's lens. */
const cutAway = (ceiling: THREE.Object3D | undefined, camera: THREE.Camera) => { if (ceiling) ceiling.visible = camera.position.y < CAFE_ROOM.ceiling - 0.05; };
function setFov(camera: THREE.Camera, fov: number) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return 0;
  const was = camera.fov;
  camera.fov = fov;
  camera.updateProjectionMatrix();
  return was;
}

/** The room: shell, bar and décor in one model; the ceiling layer only for a camera below the ceiling. */
function Room() {
  const room = useCafeModel("cafe-room");
  const ceiling = useMemo(() => room.getObjectByName("cafe_ceiling"), [room]);
  useFrame(({ camera }) => cutAway(ceiling, camera));
  return <primitive object={room} />;
}

/** Three real lights (cafe-polish §7) under a warm fill: over the bar, over the seating, and the window's daylight. */
function Lights({ phase }: { phase: IslandPhase }) {
  const daylight = phase === "day" ? 1 : phase === "dawn" || phase === "evening" ? 0.55 : 0;
  return <>
    <ambientLight color="#ffe3c0" intensity={0.42} />
    <hemisphereLight args={["#ffd9a8", "#5a3a22", 0.55]} />
    <pointLight color="#ffcf8f" intensity={26} distance={11} decay={1.6} position={[3.5, 3.3, 3.6]} />
    <pointLight color="#ffc983" intensity={20} distance={11} decay={1.6} position={[-4.4, 3.1, 0.6]} />
    <pointLight color={phase === "evening" ? "#ffb070" : "#fff0dc"} intensity={6 + 16 * daylight} distance={9} decay={1.6} position={[-7.4, 2.6, -1.9]} />
  </>;
}

export default function CafeInterior({ phase, player, frozen, identity, level, onNear }: {
  phase: IslandPhase; player: React.RefObject<THREE.Vector3>; frozen: boolean; identity: WorldIdentity; level?: number;
  onNear: (near: "exit" | "owner" | null) => void;
}) {
  const { scene, camera } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, "#1a120c"), [scene]);
  const devCam = useMemo(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search), v = q.get("cafecam")?.split(",").map(Number);
    return v?.length === 6 && v.every(Number.isFinite) ? { at: v.slice(0, 3) as [number, number, number], look: v.slice(3) as [number, number, number], fov: Number(q.get("fov")) || 0 } : null;
  }, []);
  useEffect(() => { camera.position.set(SPAWN[0], 8.4, SPAWN[2] - 7.2); }, [camera]);
  useEffect(() => {
    if (!devCam?.fov) return;
    const was = setFov(camera, devCam.fov);
    return () => { setFov(camera, was); };
  }, [camera, devCam]);
  const near = useRef<"exit" | "owner" | null>(null);
  // A Residents-editor persona on the café owner post names her and gives her lines; else the proposed defaults.
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const persona = personas.find(p => p.post === "cafe_owner");
  useFrame((_, delta) => {
    if (devCam) { camera.position.set(...devCam.at); camera.lookAt(...devCam.look); }
    else followInteriorCamera(camera, player.current.x, player.current.z, Math.min(delta, 0.1));
    // A study seat's prompt takes E while it is up.
    const { x, z } = player.current;
    const next = studyHoldsPrompt() ? null : Math.hypot(x - CAFE_DOOR[0], z - CAFE_DOOR[1]) < CAFE_EXIT_RANGE ? "exit"
      : Math.hypot(x - OWNER_TALK.at[0], z - OWNER_TALK.at[1]) < OWNER_TALK.range ? "owner" : null;
    if (next !== near.current) { near.current = next; onNear(next); }
  });
  return <>
    <Lights phase={phase} />
    <ContactShadows tint="#2b1a0e" intensity={1.1} sunMap={false} />
    <Outside phase={phase} />
    <Suspense fallback={null}><Room /><CafeSigns /></Suspense>
    <Html position={[CAFE_BOARD.at[0] - 0.3, CAFE_BOARD.at[1] + 0.85, CAFE_BOARD.at[2]]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={world.cue}>Study board</div></Html>
    <CafeOwner player={player} name={persona?.display_name} lines={persona?.canned_dialogue.length ? persona.canned_dialogue : undefined} />
    <StudySeats area="cafe" player={player} board={CAFE_BOARD.spot} />
    <CafePatrons player={player} />
    <PlayerAvatar spawnPosition={SPAWN} playerName={identity.display_name} playerLevel={level} member={identity.member} player={player} frozen={frozen}
      world={CAFE} groundHeight={flat} walkOnly />
  </>;
}
