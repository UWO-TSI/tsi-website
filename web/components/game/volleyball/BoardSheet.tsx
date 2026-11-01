"use client";

/**
 * The volleyball court's leaderboard (E at the board beside the court; David 2026-10-30: "redo the ui of this leader
 * board with better ui, have a podium with character model and name, more visual less names"): the kit's Podium with
 * the top three standing on their steps (their characters in one small canvas, up only while the sheet is open), a few
 * quiet rows under it and your own place if it's further down. A "Sample" tag until phase 3's real board
 * (lib/game/volleyball/leaderboard). Built only while open, so it costs passers-by nothing. World names only.
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FlatPanel, HairlineRow, HairlineRows, Pill, Podium, RankBadge, flatStyles, podiumFeet } from "@/components/gui/flat";
import Character from "@/components/game/character/Character";
import { StudioLights } from "@/components/economy/TurnStage";
import { randomLook, seeded, type CharacterLook } from "@/lib/game/character/look";
import { useMyLook } from "@/lib/game/character/lookStore";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { boardView, nameSeed, weeklyBoard, type Board, type BoardRow } from "@/lib/game/volleyball/leaderboard";
import s from "./boardSheet.module.css";

/** Pixels per unit (the orthographic stage): a character (1.045 u at scale 1) stands about 120 px tall. */
const ZOOM = 115;
/**
 * The camera stands close: the island's curved-world bend (lib/game/curvedWorld, a shared shader chunk) sinks geometry
 * by its view distance squared, so at 10 u the figures would sink 0.3 u below their steps; at 1.2 u it's under a pixel.
 */
const CAM_Z = 1.2;
/** Each place turns a little toward the middle; the winner faces you and cheers. */
const YAW = { 1: 0, 2: 0.32, 3: -0.32 } as const;

const wins = (r: BoardRow) => `${r.wins} ${r.wins === 1 ? "win" : "wins"}`;
const lookOf = (r: BoardRow, mine: CharacterLook) => (r.you ? mine : randomLook(seeded(nameSeed(r.name))));

/**
 * One player on their step. The stage is orthographic: a step's top in px is a height in units over the frustum's
 * foot (read from the camera each frame, so it follows the canvas's real size).
 */
function place(g: THREE.Group | null, cam: THREE.Camera, rank: 1 | 2 | 3) {
  const c = cam as THREE.OrthographicCamera, feet = podiumFeet(rank);
  if (g && c.isOrthographicCamera) g.position.set((c.left + (c.right - c.left) * feet.x) / c.zoom, (c.bottom + feet.y) / c.zoom, 0);
}
function Stand({ row, look }: { row: BoardRow; look: CharacterLook }) {
  const rank = row.rank as 1 | 2 | 3, g = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: YAW[rank], lift: 0, pose: null, play: rank === 1 ? "Cheer" : null });
  useFrame(({ camera }) => place(g.current, camera, rank));
  return <group ref={g}>
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={512} lod={false} /></Suspense>
  </group>;
}

/** The top three in one transparent canvas laid over the podium. */
function PodiumStage({ rows, mine }: { rows: BoardRow[]; mine: CharacterLook }) {
  const looks = useMemo(() => rows.map(r => lookOf(r, mine)), [rows, mine]);
  return <Canvas orthographic camera={{ zoom: ZOOM, position: [0, 0, CAM_Z], near: 0.05, far: 5 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}
    style={{ width: "100%", height: "100%" }} onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
    <StudioLights />
    {rows.map((r, i) => <Stand key={`${r.rank}-${r.name}`} row={r} look={looks[i]} />)}
  </Canvas>;
}

/** The board's body (also the showroom's sample). */
export function BoardBody({ board, mine }: { board: Board; mine: CharacterLook }) {
  const v = useMemo(() => boardView(board), [board]), more = v.you ? [...v.rows, v.you] : v.rows;
  return <div className={s.board}>
    <p className={flatStyles.lead}>Top casual wins this week{board.sample ? <> <Pill>Sample</Pill></> : null}</p>
    <Podium label="Top three this week" stage={<PodiumStage rows={v.podium} mine={mine} />}
      places={v.podium.map(r => ({ rank: r.rank as 1 | 2 | 3, name: r.name, detail: r.you ? `You · ${wins(r)}` : wins(r), you: r.you }))} />
    {more.length ? <HairlineRows>
      {more.map(r => <HairlineRow key={`${r.rank}-${r.name}`} art={<RankBadge rank={r.rank} />} title={r.name} detail={wins(r)} end={r.you ? <Pill>You</Pill> : undefined} />)}
    </HairlineRows> : null}
  </div>;
}

function OpenBoard({ me }: { me: string }) {
  const { look } = useMyLook();
  const board = useMemo(() => weeklyBoard(me), [me]);
  return <BoardBody board={board} mine={look} />;
}

export default function BoardSheet({ open, onClose, me }: { open: boolean; onClose: () => void; me: string }) {
  return <FlatPanel open={open} onClose={onClose} title="Beach volleyball" testId="volley-board">
    {open ? <OpenBoard me={me} /> : null}
  </FlatPanel>;
}
