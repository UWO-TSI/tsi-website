"use client";

/**
 * Phone companion Study tab, 3D piece (specs/companion.md deliverable 2,
 * decision 119): a low-detail view of just the table the member is sitting
 * at, not the island. Strict budget: dpr 1, no shadows, under 60 draw calls
 * (one table's furniture plus up to 4 rigged seat-mates comes in well under
 * that). Reuses the same furniture (`TableFurniture`) and rigged character
 * (`Character`) the 3D cafe uses — this is a second, isolated placement of
 * the same table, not a new art pass.
 *
 * No curved-world projection here (that shader isn't mounted in this
 * scene), so unlike `StudySeats`' in-world `MateFigure` this skips the
 * overhead `<Html>` timer pill — the 2D `Mates` list right below already
 * shows names and phases.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Character, { CHARACTER_SCALE, type CharacterMotion } from "@/components/game/character/Character";
import { TableFurniture } from "@/components/game/study/StudySeats";
import { hashSeed, parseLook, randomLook, seeded } from "@/lib/game/character/look";
import { seatLift } from "@/lib/game/character/clips";
import { localSeats, tableLayout, type WorldSeat } from "@/lib/study/seats";
import { poseOf, STUDY_CLIP } from "@/lib/study/worldStore";
import type { Mate, TableView } from "@/lib/study/service";
import s from "@/components/study/companion.module.css";

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function SeatFigure({ mate, seat }: { mate: Mate; seat: WorldSeat }) {
  const stored = JSON.stringify(mate.look ?? null);
  const look = useMemo(() => (stored !== "null" ? parseLook(JSON.parse(stored)) : randomLook(seeded(hashSeed(mate.member_id)))), [stored, mate.member_id]);
  const clip = STUDY_CLIP[poseOf(mate.phase)];
  const lift = seatLift(clip, seat.y, CHARACTER_SCALE);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: seat.facing, lift, pose: clip, play: null });
  useEffect(() => {
    Object.assign(motion.current, { yaw: seat.facing, lift, pose: clip });
  }, [seat.facing, lift, clip]);
  return (
    <group position={[seat.x, 0, seat.z]}>
      <Character look={look} motion={motion} />
    </group>
  );
}

function Scene({ table, mates }: { table: TableView; mates: Mate[] }) {
  const layout = tableLayout(table.anchor);
  const seats = useMemo(() => localSeats(table.anchor), [table.anchor]);
  const bySeat = useMemo(() => new Map(mates.map((m) => [m.seat, m])), [mates]);
  if (!layout) return null;
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[2.6, 24]} />
        <meshStandardMaterial color="#e9d9b8" roughness={0.95} />
      </mesh>
      <TableFurniture t={{ ...layout, at: [0, 0] }} ground={() => 0} />
      {seats.map((seat) => {
        const mate = bySeat.get(seat.seat);
        return mate ? <SeatFigure key={seat.seat} mate={mate} seat={seat} /> : null;
      })}
    </>
  );
}

/**
 * `table`/`mates` come from the same `useStudySession()` instance the 2D UI
 * uses — no second poll. Loaded only via `dynamic(..., { ssr: false })`
 * (StudyTab.tsx), so it never renders on the server — `hasWebGL()` can run
 * straight in the initial state without a hydration mismatch.
 */
export default function CompanionTableScene({ table, mates }: { table: TableView; mates: Mate[] }) {
  const [supported] = useState(hasWebGL);

  if (!supported) {
    return (
      <section className={s.card} aria-label="Table view unavailable">
        <p className={s.muted}>Your browser can&apos;t show the 3D table view here. Everything else on this page still works.</p>
      </section>
    );
  }
  return (
    <div className={s.sceneWrap}>
      <Canvas
        dpr={1}
        shadows={false}
        gl={{ antialias: true, powerPreference: "low-power" }}
        camera={{ fov: 32, position: [0, 3.1, 3.4] }}
        onCreated={({ camera }) => camera.lookAt(0, 0.7, 0)}
      >
        <Suspense fallback={null}>
          <Scene table={table} mates={mates} />
        </Suspense>
      </Canvas>
    </div>
  );
}
