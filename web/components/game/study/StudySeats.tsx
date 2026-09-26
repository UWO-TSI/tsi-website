"use client";

/**
 * Study tables in one area of the world (specs/study-world.md): furniture
 * from lib/study/seats.ts, seat-mates at their seats with overhead timers,
 * your own overhead timer, the "Sit" proximity check and walk-away (row 80).
 * Sitting reuses PlayerAvatar's `tsi:sit` snap; the HUD owns the session.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp } from "../NatureModels";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { npcSpriteSources } from "@/lib/game/npcSprites";
import { FURNITURE, STUDY_LAYOUT, nearestSeat, seatAt, walkedAway, type SeatArea, type TableLayout, type WorldSeat } from "@/lib/study/seats";
import { getWorldStudy, seatAvatar, setWorldStudy, useWorldStudy } from "@/lib/study/worldStore";
import type { Mate } from "@/lib/study/service";
import { formatClock } from "@/lib/study/useStudySession";
import s from "./study.module.css";

const F = "/assets/acnh/furniture/", P = "/assets/acnh/props/";
const flat = () => 0;
/** PlayerAvatar's tsi:sit toggles: the same seat again stands up. */
const standUp = (seat: WorldSeat) => window.dispatchEvent(new CustomEvent("tsi:sit", { detail: { x: seat.x, z: seat.z } }));
const atSeat = (seat: WorldSeat, p: THREE.Vector3) => Math.abs(p.x - seat.x) < 0.01 && Math.abs(p.z - seat.z) < 0.01;

/** Placeholder furniture per kind, from the HQ clubhouse family (tables, chairs, sofa) and village props (benches, parasol). */
function TableFurniture({ t, ground }: { t: TableLayout; ground: (x: number, z: number) => number }) {
  const seats = FURNITURE[t.furniture].seats;
  const tables = t.furniture === "four" || t.furniture === "picnic" ? [0.49, -0.49] : t.furniture === "couch" ? [] : [0];
  const y = ground(t.at[0], t.at[1]);
  return <group position={[t.at[0], y, t.at[1]]} rotation={[0, t.yaw, 0]}>
    {tables.map(x => <GLBProp key={x} url={`${F}reading-table.glb`} position={[x, 0, 0]} scale={0.1} />)}
    {t.furniture === "couch" ? <>
      <GLBProp url={`${F}lounge-sofa.glb`} position={[0, 0, 0.2]} scale={0.16} rotation={[0, Math.PI, 0]} />
      <GLBProp url={`${F}lounge-table.glb`} position={[0, 0, -1.35]} scale={0.1} />
      <GLBProp url={`${F}lounge-tea.glb`} position={[0.3, 0.52, -1.35]} scale={0.075} />
    </> : t.furniture === "picnic" || t.furniture === "pier"
      ? [...new Set(seats.map(([, z]) => z))].map(z => <GLBProp key={z} url={`${P}bench-wood.glb`} position={[0, 0, z]} />)
      : seats.map(([x, z, facing], i) => <GLBProp key={i} url={`${F}study-chair.glb`} position={[x, 0, z]} scale={0.1} rotation={[0, facing, 0]} />)}
    {t.furniture === "pier" && <GLBProp url={`${P}beach-parasol.glb`} position={[-1.3, 0, 0.2]} />}
    {t.furniture !== "couch" && <GLBProp url={`${F}lounge-book.glb`} position={[0.15, 0.84, 0]} scale={0.065} rotation={[0, 0.3, 0]} castShadow={false} />}
  </group>;
}

function Overhead({ name, phase, remaining }: { name?: string; phase: Mate["phase"]; remaining: number | null }) {
  return <div className={s.overhead} data-phase={phase}>
    {name && <b>{name}</b>}
    <span>{phase === "focus" ? `Focus ${formatClock(remaining)}` : phase === "break" ? `Stretch ${formatClock(remaining)}` : "Settling in"}</span>
  </div>;
}

/** Seat-mate stand-in (no multiplayer yet): a resident sprite at the seat, bobbing through breaks. */
function MateFigure({ mate, seat, y, remaining }: { mate: Mate; seat: WorldSeat; y: number; remaining: number | null }) {
  const url = npcSpriteSources(null, mate.member_id).fallback;
  const sheet = useTexture(url);
  const tex = useMemo(() => {
    const t = sheet.clone();
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.repeat.set(1 / 4, 1); t.needsUpdate = true;
    return t;
  }, [sheet]);
  useEffect(() => () => tex.dispose(), [tex]);
  const body = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    // ponytail: placeholder stretch bob until the rigged Sit/Study clips land.
    if (body.current) body.current.position.y = 0.72 + (mate.phase === "break" ? Math.abs(Math.sin(clock.elapsedTime * 2.2)) * 0.12 : 0);
  });
  return <group position={[seat.x, y, seat.z]}>
    <Billboard><mesh ref={body} scale={[1, 0.82, 1]} position={[0, 0.72, 0.2]}>
      <planeGeometry args={[1.45, 1.45]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
    </mesh></Billboard>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 1.75, 0]} center zIndexRange={[35, 0]} style={{ pointerEvents: "none" }}>
      <Overhead name={mate.name} phase={mate.phase} remaining={remaining} />
    </Html>
  </group>;
}

/** Your own countdown, riding above the avatar (row 78). */
function MyOverhead({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null);
  const session = useWorldStudy(w => w.study?.session ?? null);
  const remaining = useWorldStudy(w => w.study?.remaining ?? null);
  useFrame(() => { if (group.current) group.current.position.copy(player.current); });
  if (!session || session.phase === "seated") return null;
  return <group ref={group}>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 1.95, 0]} center zIndexRange={[45, 0]} style={{ pointerEvents: "none" }}>
      <Overhead phase={session.phase} remaining={remaining} />
    </Html>
  </group>;
}

export default function StudySeats({ area, player, ground = flat, board }: {
  area: SeatArea; player: React.RefObject<THREE.Vector3>; ground?: (x: number, z: number) => number; board?: [number, number];
}) {
  const layouts = useMemo(() => STUDY_LAYOUT.filter(t => t.area === area), [area]);
  const tables = useWorldStudy(w => w.study?.tables);
  const session = useWorldStudy(w => w.study?.session ?? null);
  const myTable = useWorldStudy(w => w.study?.table ?? null);
  // Put the avatar in its seat once per session: after "Sit", on load, or on coming back into this area.
  const placed = useRef<string | null>(null);
  const mySeat = session && myTable && layouts.some(l => l.anchor === myTable.anchor) ? seatAt(myTable.anchor, session.seat) : null;
  useEffect(() => {
    if (!session || !mySeat || placed.current === session.id || getWorldStudy().seated) return;
    placed.current = session.id;
    seatAvatar(mySeat);
  }, [session, mySeat]);
  // Session over (finished, Leave seat, another device): stand up if still sitting.
  useEffect(() => {
    const seated = getWorldStudy().seated;
    if (session || !seated || !layouts.some(l => l.anchor === seated.anchor)) return;
    if (atSeat(seated, player.current)) standUp(seated);
    setWorldStudy({ seated: null });
  }, [session, layouts, player]);
  // Leaving the area while seated (scene change) counts as walking away.
  useEffect(() => () => {
    const w = getWorldStudy();
    if (w.seated && layouts.some(l => l.anchor === w.seated!.anchor)) { setWorldStudy({ seated: null, near: null }); void w.study?.end(); }
    else if (w.near) setWorldStudy({ near: null });
  }, [layouts]);

  useFrame(() => {
    const w = getWorldStudy();
    const p = player.current;
    if (w.seated && layouts.some(l => l.anchor === w.seated!.anchor) && walkedAway(w.seated, p.x, p.z)) {
      setWorldStudy({ seated: null });
      if (w.study?.session) void w.study.end();
    }
    const views = w.study?.tables ?? [];
    const mine = w.study?.session;
    let near: WorldSeat | "board" | null = board && Math.hypot(p.x - board[0], p.z - board[1]) < 1.3 ? "board" : null;
    if (!near && w.study) near = nearestSeat(area, p.x, p.z, (anchor, seat) => {
      const view = views.find(v => v.anchor === anchor);
      if (!view) return !w.study!.signedOut;
      if (mine) return !(w.study!.table?.anchor === anchor && mine.seat === seat) || (!!w.seated && atSeat(w.seated, p));
      return !view.can_join || view.taken.includes(seat);
    });
    const prev = w.near;
    const same = prev === near || (typeof prev === "object" && typeof near === "object" && prev?.anchor === near?.anchor && prev?.seat === near?.seat);
    if (!same) setWorldStudy({ near });
  });

  return <>
    {layouts.map(t => <Suspense key={t.anchor} fallback={null}><TableFurniture t={t} ground={ground} /></Suspense>)}
    {(tables ?? []).filter(v => layouts.some(l => l.anchor === v.anchor)).map(v => {
      const layout = layouts.find(l => l.anchor === v.anchor)!;
      return <group key={v.id}>
        {v.mates.filter(m => !m.me).map(m => {
          const seat = seatAt(v.anchor, m.seat);
          return seat && <Suspense key={m.member_id} fallback={null}>
            <MateFigure mate={m} seat={seat} y={ground(seat.x, seat.z)} remaining={m.remaining_s} />
          </Suspense>;
        })}
        {v.is_private && !v.can_join && <Html position={[layout.at[0], ground(...layout.at) + 1.6, layout.at[1]]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div className={s.overhead} data-phase="private"><span>Private table</span></div>
        </Html>}
      </group>;
    })}
    <MyOverhead player={player} />
  </>;
}
