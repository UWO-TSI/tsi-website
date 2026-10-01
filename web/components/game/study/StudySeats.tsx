"use client";

/**
 * Study tables in one area of the world (specs/study-world.md): furniture
 * from lib/study/seats.ts, seat-mates on the shared rig at their seats with
 * overhead timers, your own overhead timer, the "Sit" proximity check and
 * walk-away (row 80). Sitting is PlayerAvatar's `tsi:sit` with the seat's
 * measured top; the clip follows `studyPose()`. The HUD owns the session.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import { GLBProp } from "../NatureModels";
import { CafeModel } from "./CafeModel";
import type { ContactSize } from "@/lib/game/shadows";
import Character, { CHARACTER_SCALE, type CharacterMotion } from "../character/Character";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { hashSeed, parseLook, randomLook, seeded } from "@/lib/game/character/look";
import { seatLift } from "@/lib/game/character/clips";
import { FURNITURE, studyLayout, nearestSeat, seatAt, walkedAway, type SeatArea, type TableLayout, type WorldSeat } from "@/lib/study/seats";
import { STUDY_CLIP, getWorldStudy, poseOf, seatAvatar, setWorldStudy, sitDetail, useWorldStudy } from "@/lib/study/worldStore";
import type { Mate } from "@/lib/study/service";
import { formatClock, liveRemaining, useSecond } from "@/lib/study/useStudySession";
import s from "./study.module.css";

const F = "/assets/acnh/furniture/", P = "/assets/acnh/props/";
const flat = () => 0;
/** Without a clip, PlayerAvatar's tsi:sit at the seat you're in stands you up. */
const standUp = (seat: WorldSeat) => window.dispatchEvent(new CustomEvent("tsi:sit", { detail: { x: seat.x, z: seat.z } }));
/** With a clip it sits you (or re-poses you if already there): never a toggle. */
const sitIn = (seat: WorldSeat, phase: Mate["phase"] | undefined) => window.dispatchEvent(new CustomEvent("tsi:sit", { detail: sitDetail(seat, phase) }));
const atSeat = (seat: WorldSeat, p: THREE.Vector3) => Math.abs(p.x - seat.x) < 0.01 && Math.abs(p.z - seat.z) < 0.01;

/** The café furniture (art/cafe/build_cafe.py, one model per kind) and its soft contact shadow, in the set's own frame. */
const CAFE_SET: Partial<Record<TableLayout["furniture"], ContactSize>> = {
  bar: { cx: 0, cz: -0.65, rx: 0.75, rz: 0.35, height: 0, strength: 0.5 },
  two: { cx: 0, cz: 0, rx: 1.15, rz: 0.55, height: 0, strength: 0.55 },
  four: { cx: 0, cz: 0, rx: 0.9, rz: 1.2, height: 0, strength: 0.55 },
  booth: { cx: 0, cz: 0, rx: 0.95, rz: 1.35, height: 0, strength: 0.6 },
  communal: { cx: 0, cz: 0, rx: 1.45, rz: 1.1, height: 0, strength: 0.55 },
};

/**
 * Furniture per kind: the café's hand-modeled sets, and outdoors the village
 * benches and parasol. Exported for the phone companion's isolated table scene
 * (specs/companion.md deliverable 2), which places one table at the origin.
 */
export function TableFurniture({ t, ground }: { t: TableLayout; ground: (x: number, z: number) => number }) {
  const seats = FURNITURE[t.furniture].seats;
  const y = ground(t.at[0], t.at[1]);
  const set = CAFE_SET[t.furniture];
  if (set) return <CafeModel name="cafe-kit" node={`set_${t.furniture}`} position={[t.at[0], y, t.at[1]]} yaw={t.yaw} contact={set} />;
  return <group position={[t.at[0], y, t.at[1]]} rotation={[0, t.yaw, 0]}>
    {t.furniture === "picnic" && [0.49, -0.49].map(x => <GLBProp key={x} url={`${F}reading-table.glb`} position={[x, 0, 0]} scale={0.1} />)}
    {[...new Set(seats.map(([, z]) => z))].map(z => <GLBProp key={z} url={`${P}bench-wood.glb`} position={[0, 0, z]} />)}
    {t.furniture === "pier" && <GLBProp url={`${P}beach-parasol.glb`} position={[-2.4, 0, 0.3]} />}
    {t.furniture === "pier" && <GLBProp url={`${F}reading-table.glb`} position={[0, 0, 0]} scale={0.1} />}
    <GLBProp url={`${F}lounge-book.glb`} position={[0.15, 0.84, 0]} scale={0.065} rotation={[0, 0.3, 0]} />
  </group>;
}

function Overhead({ name, phase, remaining }: { name?: string; phase: Mate["phase"]; remaining: number | null }) {
  return <div className={s.overhead} data-phase={phase}>
    {name && <b>{name}</b>}
    {phase !== "seated" && <span>{phase === "focus" ? `Focus ${formatClock(remaining)}` : `Stretch ${formatClock(remaining)}`}</span>}
  </div>;
}

/** A seat-mate's pill: their countdown runs on the shared second from the snapshot it came in (the table list stays put). */
function MateOverhead({ name, phase, remaining, asOf }: { name?: string; phase: Mate["phase"]; remaining: number | null; asOf: number }) {
  const now = useSecond();
  return <Overhead name={name} phase={phase} remaining={liveRemaining(remaining, asOf, now)} />;
}

/** Seat-mate (no multiplayer yet): the shared rig in their stored look, or a steady default per member, studying/stretching/sitting by phase. */
export function MateFigure({ mate, seat, floor = 0, remaining = null, asOf = 0, overhead = true }: { mate: Mate; seat: WorldSeat; floor?: number; remaining?: number | null; asOf?: number; overhead?: boolean }) {
  const stored = JSON.stringify(mate.look ?? null);
  const look = useMemo(() => (stored !== "null" ? parseLook(JSON.parse(stored)) : randomLook(seeded(hashSeed(mate.member_id)))), [stored, mate.member_id]);
  const clip = STUDY_CLIP[poseOf(mate.phase)];
  const lift = seatLift(clip, seat.y - floor, CHARACTER_SCALE);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: seat.facing, lift, pose: clip, play: null });
  useEffect(() => { Object.assign(motion.current, { yaw: seat.facing, lift, pose: clip }); }, [seat.facing, lift, clip]);
  return <group position={[seat.x, floor, seat.z]}>
    <Character look={look} motion={motion} />
    {overhead && <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, seat.y - floor + 1.25, 0]} center zIndexRange={[35, 0]} style={{ pointerEvents: "none" }}>
      <MateOverhead name={mate.name.split(" ")[0]} phase={mate.phase} remaining={remaining} asOf={asOf} />
    </Html>}
  </group>;
}

/** Your own countdown, just above your nameplate (row 78); any higher it covers the seat-mate across a four-seat table (ruling 6). */
function MyOverhead({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null);
  const session = useWorldStudy(w => w.study?.session ?? null);
  const remaining = useWorldStudy(w => w.study?.remaining ?? null);
  useFrame(() => { if (group.current) group.current.position.copy(player.current); });
  if (!session || session.phase === "seated") return null;
  return <group ref={group}>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 2.05, 0]} center zIndexRange={[45, 0]} style={{ pointerEvents: "none" }}>
      <Overhead phase={session.phase} remaining={remaining} />
    </Html>
  </group>;
}

export default function StudySeats({ area, player, ground = flat, board }: {
  area: SeatArea; player: React.RefObject<THREE.Vector3>; ground?: (x: number, z: number) => number; board?: [number, number];
}) {
  const layouts = useMemo(() => studyLayout().filter(t => t.area === area), [area]);
  const anchors = useMemo(() => new Set(layouts.map(l => l.anchor)), [layouts]);
  const tables = useWorldStudy(w => w.study?.tables);
  const asOf = useWorldStudy(w => w.study?.asOf ?? 0);
  const session = useWorldStudy(w => w.study?.session ?? null);
  const placed = useRef<string | null>(null);
  // Walk-away only counts once the avatar has actually been in the seat.
  const arrived = useRef(false);
  // PlayerAvatar may not be listening yet on the first frames after a scene change: retry the snap briefly.
  const retry = useRef({ until: 0, last: 0 });
  // The clip last sent while seated; a phase change (focus → break) re-poses in place.
  const shown = useRef<string | null>(null);
  // Session over (finished, Leave seat, another device): stand up if still sitting.
  useEffect(() => {
    const seated = getWorldStudy().seated;
    if (session || !seated || !anchors.has(seated.anchor)) return;
    if (atSeat(seated, player.current)) standUp(seated);
    setWorldStudy({ seated: null });
  }, [session, anchors, player]);
  // A scene change after sitting down counts as walking away.
  useEffect(() => () => {
    const w = getWorldStudy();
    if (w.seated && anchors.has(w.seated.anchor)) {
      setWorldStudy({ seated: null, near: null });
      if (arrived.current) void w.study?.end();
      else placed.current = null; // not seated yet (Strict Mode re-runs this cleanup on mount): seat again next frame
    } else if (w.near) setWorldStudy({ near: null });
  }, [anchors]);

  useFrame(() => {
    const w = getWorldStudy();
    const p = player.current;
    const mine = w.study?.session;
    // Once per session, seat the avatar (after "Sit", on load, on coming back into this area).
    // From the frame loop, so PlayerAvatar's tsi:sit listener is already up.
    const table = w.study?.table;
    if (mine && table && anchors.has(table.anchor) && placed.current !== mine.id && !w.seated) {
      const seat = seatAt(table.anchor, mine.seat, ground);
      placed.current = mine.id;
      arrived.current = false;
      retry.current = { until: performance.now() + 3000, last: performance.now() };
      if (seat) seatAvatar(seat);
    }
    const seated = w.seated && anchors.has(w.seated.anchor) ? w.seated : null;
    if (seated && atSeat(seated, p)) arrived.current = true;
    const now = performance.now();
    if (seated && !arrived.current && now < retry.current.until && now - retry.current.last > 400) {
      retry.current.last = now;
      sitIn(seated, mine?.phase);
    }
    const clip = STUDY_CLIP[poseOf(mine?.phase)];
    if (seated && arrived.current && atSeat(seated, p) && shown.current !== clip) {
      shown.current = clip;
      sitIn(seated, mine?.phase);
    }
    if (seated && arrived.current && walkedAway(seated, p.x, p.z)) {
      arrived.current = false;
      setWorldStudy({ seated: null });
      if (mine) void w.study?.end();
    }
    const views = w.study?.tables ?? [];
    let near: WorldSeat | "board" | null = board && Math.hypot(p.x - board[0], p.z - board[1]) < 1.3 ? "board" : null;
    if (!near && w.study) near = nearestSeat(area, p.x, p.z, (anchor, seat) => {
      const view = views.find(v => v.anchor === anchor);
      if (!view) return !w.study!.signedOut;
      if (mine) return !(w.study!.table?.anchor === anchor && mine.seat === seat) || (!!w.seated && atSeat(w.seated, p));
      return !view.can_join || view.taken.includes(seat);
    }, ground);
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
          const seat = seatAt(v.anchor, m.seat, ground);
          return seat && <Suspense key={m.member_id} fallback={null}>
            <MateFigure mate={m} seat={seat} floor={ground(seat.x, seat.z)} remaining={m.remaining_s} asOf={asOf} />
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
