"use client";

/**
 * Ambient café patrons (row 271; lib/study/patrons.ts): background characters
 * on the shared rig, each in a look seeded by their visit, walking in from the
 * door to a free seat, studying at a laptop or a book or sitting over a cup,
 * and walking out again. Fewer as members sit down or other players come in
 * (multiplayer §5.8: the headcount is room state, every client agrees); any
 * seat a member takes or a player walks up to, you or anyone else, its patron
 * gives up. On the shared world clock, so everyone sees the same café. One
 * frame loop for all of them; React only hears about it when someone comes in
 * or leaves.
 */
import { Suspense, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Character, { CHARACTER_SCALE, type CharacterMotion } from "../character/Character";
import { randomLook, seeded } from "@/lib/game/character/look";
import { seatLift } from "@/lib/game/character/clips";
import { easeFacing } from "@/lib/game/locomotion";
import { PATRON_SPEED, PATRON_YIELD_RANGE, cafePatrons, patronSeats, patronTarget, propSpot, seatKey, type PatronView, type PatronVisit } from "@/lib/study/patrons";
import { getWorldStudy, useWorldStudy } from "@/lib/study/worldStore";
import { worldNow } from "@/lib/game/worldClock";
import { liveRemotes, remoteNear, useOthersIn } from "../net/active";
import { useCafeModel } from "./CafeModel";

const PROP = { laptop: "prop_laptop", book: "prop_book", cup: "prop_cup" } as const;

function Prop({ visit, views }: { visit: PatronVisit; views: React.RefObject<Map<string, PatronView>> }) {
  const node = useCafeModel("cafe-kit", PROP[visit.activity]);
  const spot = useMemo(() => propSpot(visit.seat), [visit.seat]);
  const group = useRef<THREE.Group>(null);
  // On the table once they're down; gone the moment they stand.
  useFrame(() => { if (group.current) group.current.visible = (views.current.get(visit.id)?.sit ?? 0) >= 1; });
  return <group ref={group} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} visible={false}><primitive object={node} /></group>;
}

function Patron({ visit, views }: { visit: PatronVisit; views: React.RefObject<Map<string, PatronView>> }) {
  const look = useMemo(() => randomLook(seeded(visit.seed)), [visit.seed]);
  const clip = visit.activity === "cup" ? "Sit" : "Study";
  const lift = seatLift(clip, visit.seat.y, CHARACTER_SCALE);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const v = views.current.get(visit.id), m = motion.current, g = group.current;
    if (!v || !g) return;
    g.position.set(v.x, 0, v.z);
    m.speed = v.walking ? PATRON_SPEED : 0;
    m.pose = v.sit > 0 ? clip : null;
    // Down onto the seat (and back up) over the first third of the sit: the clip's crossfade does the rest.
    m.lift = lift * Math.min(1, v.sit * 3);
    m.yaw = v.sit > 0 ? v.yaw : easeFacing(m.yaw, v.yaw, 9, Math.min(raw, 0.1));
  });
  return <>
    <group ref={group} position={[visit.seat.x, 0, visit.seat.z]}>
      <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={PATRON_SPEED} /></Suspense>
    </group>
    <Suspense fallback={null}><Prop visit={visit} views={views} /></Suspense>
  </>;
}

let seatKeys: string[] | null = null;
function addTo(this: Set<string>, key: string) { this.add(key); }
/**
 * The seats patrons give up this frame: those members hold, and those another player in the room stands within reach
 * of (as you do, `player`). Module scope, nothing allocated: no one else here, it's `taken` itself.
 */
export function seatsWanted(into: Set<string>, taken: ReadonlySet<string>): ReadonlySet<string> {
  if (!liveRemotes.n) return taken;
  const seats = patronSeats(), keys = (seatKeys ??= seats.map(seatKey));
  into.clear();
  taken.forEach(addTo, into);
  for (let i = 0; i < seats.length; i++) if (remoteNear(seats[i].x, seats[i].z, PATRON_YIELD_RANGE)) into.add(keys[i]);
  return into;
}

export default function CafePatrons({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const tables = useWorldStudy(w => w.study?.tables);
  const mine = useWorldStudy(w => w.study?.session ?? null);
  const myTable = useWorldStudy(w => w.study?.table?.anchor ?? null);
  // Seats real members hold here (the server's tables) and your own: patrons never take them.
  const taken = useMemo(() => {
    const keys = new Set<string>();
    for (const t of tables ?? []) if (t.location === "cafe") for (const seat of t.taken) keys.add(`${t.anchor}#${seat}`);
    if (mine && myTable) keys.add(`${myTable}#${mine.seat}`);
    return keys;
  }, [tables, mine, myTable]);
  // The other players in the café (0 offline or alone: then every patron comes): as many as are seated or here, fewer patrons.
  const others = useOthersIn("cafe");
  const target = patronTarget(Math.max(taken.size, others));
  const state = useRef({ shown: new Set<string>(), yielded: new Map<string, number>(), since: -1, ids: "", wanted: new Set<string>() });
  const views = useRef(new Map<string, PatronView>());
  const [visits, setVisits] = useState<PatronVisit[]>([]);
  useFrame(() => {
    const s = state.current, p = player.current, seated = getWorldStudy().seated, now = worldNow() / 1000;
    if (s.since < 0) s.since = now;
    const list = cafePatrons(now, { taken: seatsWanted(s.wanted, taken), target, player: seated ? null : [p.x, p.z], shown: s.shown, yielded: s.yielded, since: s.since });
    views.current.clear();
    for (const v of list) views.current.set(v.visit.id, v);
    const ids = list.map(v => v.visit.id).join();
    if (ids !== s.ids) { s.ids = ids; setVisits(list.map(v => v.visit)); }
  });
  return <>{visits.map(v => <Patron key={v.id} visit={v} views={views} />)}</>;
}
