"use client";

/**
 * Seasonal event dressing (specs/seasonal-events.md): each event's decoration
 * set, anchored to the village's landmarks from the map file. It is an event
 * layer, never an island edit: nothing here is saved into the map, and it all
 * comes down when the event's window closes. World state only (look spec §7.1):
 * the running event (club goals at world-clock time) and landmark positions.
 * Also the in-world sheets the event's spots open: the tourney board and the
 * GENESIS posters.
 */
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp } from "./NatureModels";
import IslandSheet from "./IslandSheet";
import { TreeLeaves } from "./AmbienceFX";
import { eventSolids, landmark, type LandmarkId } from "@/lib/game/defaultIsland";
import { Lantern } from "./AmbientProps";
import { sheddingTrees, worldWind } from "@/lib/game/worldFx";
import type { IslandEvent } from "@/lib/game/seasonalEvents";
import type { IslandLight } from "@/lib/game/islandLighting";
import type { TourneyView } from "@/lib/collections/service";
import { apiCall } from "@/lib/apiClient";
import styles from "./DefaultIslandWorld.module.css";

const P = "/assets/acnh/props/", F = "/assets/acnh/furniture/", PL = "/assets/acnh/plants/", S = "/assets/acnh/seasonal/";

/**
 * A decoration: its landmark and offset (world units), model, yaw, scale, lift
 * off the ground; `solid`: world-axis half extents walked around like a
 * building (defaultIsland eventSolids), centred `solidAt` from the model's
 * origin; `lamp`: a street lamp that lights up at night.
 */
type Piece = { at: At; url: string; yaw?: number; scale?: number; lift?: number; solid?: [number, number]; solidAt?: [number, number]; lamp?: boolean };
type At = [LandmarkId, number, number];
/** What E does at a spot the event adds (DefaultIslandWorld's Near). */
export type EventNear = "trophy" | "posters" | "cocoa" | "picnic";
interface Spot { near: EventNear; at: At; range: number }

/** The event lawn east of the plaza, between the plaza and the museum. */
const lawn = (dx: number, dz: number): At => ["plaza", 9.3 + dx, 0.4 + dz];
/** The fall tourney's plaza trophy, in front of the catch board (clear of the bench beside it). */
const TROPHY: At = ["catch", 0.8, -1.0];
/** GENESIS: the stage is a wooden deck (its top 0.36 up) with the poster board at the back (the board model's origin is its left end). */
const STAGE_TOP = 0.36;
const POSTER_BOARD: At = lawn(-0.84, 1.43);
/** Every event hangs its garland arch over the path in from the bridge; its guy lines run out to the map's lamp (east) and a lamp of the event's own (west). */
const garland = (url: string): Piece[] => [
  { at: ["plaza", -2.9, -1.5], url: `${P}streetlamp.glb`, lamp: true, solid: [0.25, 0.25] },
  { at: ["plaza", 1.6, -1.3], url, scale: 0.09, yaw: -0.044 },
];

const DECOR: Record<string, { pieces: Piece[]; spots: Spot[]; lights?: At[] }> = {
  "fall-tourney": {
    pieces: [
      ...garland(`${S}harvest-garland-n.glb`),
      { at: TROPHY, url: `${F}museum-stand.glb`, scale: 0.08, solid: [0.45, 0.45] },
      { at: TROPHY, url: `${F}gold-hha-trophy.glb`, scale: 0.12, lift: 0.8 },
    ],
    spots: [{ near: "trophy", at: TROPHY, range: 1.6 }],
  },
  "winter-lights": {
    pieces: [
      ...garland(`${S}christmas-garland.glb`),
      { at: lawn(0, 0), url: `${PL}tree-cedar-snow.glb`, scale: 1.3, solid: [0.5, 0.5] },
      { at: lawn(-1.5, -1), url: `${P}stone-lantern.glb`, solid: [0.4, 0.4] },
      { at: lawn(1.5, -1), url: `${P}stone-lantern.glb`, solid: [0.4, 0.4] },
      { at: lawn(-1.4, 1.2), url: `${PL}bush-holly-snow.glb` },
      { at: lawn(1.5, 1.1), url: `${PL}bush-holly-snow.glb` },
      // The cart model's origin is off its body (x 1.75–3.77, z −0.34–1.03): turned π, the body sits 2.76 west, 0.35 south.
      { at: ["cafe", -0.14, -2.45], url: `${P}market-cart.glb`, yaw: Math.PI, solid: [1.05, 0.45], solidAt: [-2.76, -0.35] },
    ],
    spots: [{ near: "cocoa", at: ["cafe", -2.9, -3.8], range: 1.5 }],
    lights: [lawn(0, -0.6), lawn(-1.5, -1), lawn(1.5, -1)],
  },
  genesis: {
    pieces: [
      ...garland(`${S}carnival-garland.glb`),
      { at: lawn(0, 0.2), url: `${P}bridge-wooden.glb`, yaw: Math.PI / 2, solid: [1.45, 1.9] },
      { at: lawn(-1.9, -1.4), url: `${P}streetlamp.glb`, lamp: true, solid: [0.25, 0.25] },
      { at: lawn(1.9, -1.4), url: `${P}streetlamp.glb`, lamp: true, solid: [0.25, 0.25] },
      { at: lawn(-1.3, 1.5), url: `${F}monument-banner.glb`, scale: 0.1, lift: STAGE_TOP },
      { at: lawn(1.3, 1.5), url: `${F}monument-banner.glb`, scale: 0.1, lift: STAGE_TOP },
      { at: POSTER_BOARD, url: `${P}bulletin-board.glb`, lift: STAGE_TOP },
    ],
    spots: [{ near: "posters", at: lawn(0, -2.0), range: 2.2 }],
  },
  "spring-picnic": {
    pieces: [
      ...garland(`${S}carnival-garland.glb`),
      { at: lawn(-0.9, -0.6), url: `${P}beach-towel.glb`, yaw: 0.2 },
      { at: lawn(0.9, 0.8), url: `${P}beach-towel.glb`, yaw: -0.3 },
      { at: lawn(-0.9, -0.6), url: `${F}lounge-tea.glb`, scale: 0.07, lift: 0.11 },
      { at: lawn(0.9, 0.8), url: `${F}lounge-tea.glb`, scale: 0.07, lift: 0.11 },
      { at: lawn(2.3, -1.6), url: `${PL}tree-blossom.glb`, solid: [0.35, 0.35] },
      { at: lawn(-2.0, 1.9), url: `${PL}tree-blossom.glb`, solid: [0.35, 0.35] },
    ],
    spots: [{ near: "picnic", at: lawn(0, 0.1), range: 1.9 }],
  },
};

const place = ([id, dx, dz]: At): [number, number] | null => {
  const l = landmark(id);
  return l && [l.x + dx, l.z + dz];
};

/** The E spots the running event adds, in world XZ. */
export function eventSpots(decor: string | null): { near: EventNear; x: number; z: number; range: number }[] {
  return (decor ? DECOR[decor]?.spots ?? [] : []).flatMap(s => {
    const p = place(s.at);
    return p ? [{ near: s.near, x: p[0], z: p[1], range: s.range }] : [];
  });
}

export function EventDecor({ event, ground, light }: { event: IslandEvent | null; ground: (x: number, z: number) => number; light: IslandLight }) {
  const set = event ? DECOR[event.decor] : undefined;
  const pieces = useMemo(() => (set?.pieces ?? []).flatMap(p => {
    const at = place(p.at);
    return at ? [{ ...p, key: `${p.url}:${p.at.join()}`, position: [at[0], ground(at[0], at[1]) + (p.lift ?? 0), at[1]] as [number, number, number] }] : [];
  }), [set, ground]);
  useEffect(() => {
    const rects = pieces.flatMap(p => {
      if (!p.solid) return [];
      const x = p.position[0] + (p.solidAt?.[0] ?? 0), z = p.position[2] + (p.solidAt?.[1] ?? 0);
      return [{ x0: x - p.solid[0], x1: x + p.solid[0], z0: z - p.solid[1], z1: z + p.solid[1] }];
    });
    eventSolids.push(...rects);
    return () => { eventSolids.splice(0, eventSolids.length); };
  }, [pieces]);
  const blossoms = useMemo(() => sheddingTrees(pieces.filter(p => p.url.endsWith("tree-blossom.glb")).map(p => ({ x: p.position[0], y: p.position[1], z: p.position[2], model: p.url, scale: 1 })), "spring"), [pieces]);
  const wind = useMemo(() => worldWind("clear"), []);
  if (!event || !set) return null;
  return <Suspense fallback={null}>
    {pieces.map(p => p.lamp
      ? <Lantern key={p.key} position={p.position} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />
      : <GLBProp key={p.key} url={p.url} position={p.position} rotation={[0, p.yaw ?? 0, 0]} scale={p.scale ?? 1} />)}
    {(set.lights ?? []).map(at => { const p = place(at); return p && <pointLight key={at.join()} position={[p[0], ground(p[0], p[1]) + 1.6, p[1]]} color="#ffcf8a" intensity={light.lampsOn ? light.lamp * 1.4 : 0} distance={5} />; })}
    {blossoms.length > 0 && <TreeLeaves trees={blossoms} mode="petals" wind={wind} ground={ground} />}
    {event.decor === "fall-tourney" && <TrophyCue ground={ground} />}
    {event.decor === "genesis" && <Posters titles={event.goal.event.posters} ground={ground} />}
    {event.decor === "genesis" && <EventCue at={lawn(0, 1.6)} lift={3.6} ground={ground}>{event.goal.title}</EventCue>}
    {event.decor === "winter-lights" && <EventCue at={["cafe", -2.9, -2.8]} lift={2.3} ground={ground}>Hot cocoa</EventCue>}
  </Suspense>;
}

function EventCue({ at, lift, ground, children }: { at: At; lift: number; ground: (x: number, z: number) => number; children: ReactNode }) {
  const p = place(at);
  return p && <Html position={[p[0], ground(p[0], p[1]) + lift, p[1]]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>{children}</div></Html>;
}

/** The tourney's current leaders over the plaza trophy (the top of each board is public: principle 6). */
function TrophyCue({ ground }: { ground: (x: number, z: number) => number }) {
  const [board, setBoard] = useState<TourneyView | null>(null);
  useEffect(() => { apiCall<TourneyView | null>("/api/collections/tourney", "tourney").then(setBoard, () => {}); }, []);
  const leaders = board?.boards.flatMap(b => (b.top[0] ? [`${b.category === "fish" ? "Fish" : "Sea"}: ${b.top[0].name} · ${b.top[0].size_cm} cm`] : [])) ?? [];
  return <EventCue at={TROPHY} lift={2.2} ground={ground}>{board?.title ?? "Fall fishing tourney"}{leaders.map(l => <small key={l}>{l}</small>)}</EventCue>;
}

/** A GENESIS poster: the project's title on a paper card (canvas texture), pinned to the board. */
function posterTexture(title: string, index: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 320;
  const g = canvas.getContext("2d")!;
  const hues = ["#e8704a", "#4f7fd6", "#5aa469", "#b56fd0", "#e3a93a"];
  g.fillStyle = "#fbf4e4"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = hues[index % hues.length]; g.fillRect(0, 0, 256, 92);
  g.fillStyle = "#fffdf7"; g.font = "bold 34px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("GENESIS", 128, 58);
  g.fillStyle = "#3a2f28"; g.font = "bold 28px system-ui, sans-serif";
  const words = title.split(/\s+/), lines: string[] = [];
  for (const w of words) { const last = lines[lines.length - 1]; if (last && g.measureText(`${last} ${w}`).width < 220) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w); }
  lines.slice(0, 5).forEach((l, i) => g.fillText(l, 128, 150 + i * 36));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The first two posters on the stage's board (the sheet lists them all); with no titles yet, the showcase's own card. */
function Posters({ titles, ground }: { titles: string[]; ground: (x: number, z: number) => number }) {
  const shown = useMemo(() => (titles.length ? titles.slice(0, 2) : ["Project showcase"]), [titles]);
  const textures = useMemo(() => shown.map(posterTexture), [shown]);
  useEffect(() => () => textures.forEach(t => t.dispose()), [textures]);
  const at = place(POSTER_BOARD);
  if (!at) return null;
  // On the board's south face, over the cork: one poster in the middle, two side by side.
  return <>{textures.map((t, i) => <mesh key={i} position={[at[0] + (shown.length === 1 ? 0.84 : 0.43 + i * 0.82), ground(at[0], at[1]) + STAGE_TOP + 1.12, at[1] + 0.25]} rotation={[0, Math.PI, 0]}>
    <planeGeometry args={[0.74, 0.92]} />
    <meshStandardMaterial map={t} roughness={0.9} />
  </mesh>)}</>;
}

// ─── Sheets ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL = { fish: "Biggest fish", sea: "Biggest sea creature" } as const;

/** The tourney board (E at the plaza trophy): the top half by name, your own row, unnamed neighbours below the line. */
export function TourneySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<TourneyView | null | "error" | "loading">("loading");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiCall<TourneyView | null>("/api/collections/tourney", "tourney").then(t => alive && setData(t), () => alive && setData("error"));
    return () => { alive = false; };
  }, [open]);
  if (!open) return null;
  const until = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "");
  return <IslandSheet title="Fishing tourney" onClose={onClose} testId="tourney-sheet">
    {data === "loading" ? <p>Reading the board…</p> : data === "error" ? <p>Sign in to see the tourney board.</p> : data === null ? <p>No tourney has run yet. It comes back every September.</p> : <>
      <p className={styles.hint}>{data.title} {data.cycle} · {data.open ? `biggest catch wins, until ${until(data.end)}` : "final standings"}. The top half is on the board by name; everyone else sees only their own place.</p>
      {data.boards.map(b => <section key={b.category} className={styles.tourneyBoard}>
        <h3>{CATEGORY_LABEL[b.category]} <small>{b.entrants} {b.entrants === 1 ? "entrant" : "entrants"}</small></h3>
        {b.entrants === 0 ? <p className={styles.hint}>No entries yet. Any catch during the tourney counts.</p> : <ol className={styles.trophyList}>
          {b.top.map(r => <li key={r.rank} data-mine={r.mine || undefined}><span className={styles.trophyRank}>{r.rank}</span><span><b>{r.name}</b> · {r.size_cm} cm<small>{r.species}</small></span></li>)}
          {b.me && !b.top.some(r => r.mine) && <>
            {b.around.filter(r => r.rank < b.me!.rank).map(r => <li key={r.rank} data-anon><span className={styles.trophyRank}>{r.rank}</span><span>A member · {r.size_cm} cm</span></li>)}
            <li data-mine><span className={styles.trophyRank}>{b.me.rank}</span><span><b>You</b> · {b.me.size_cm} cm<small>{b.me.species}</small></span></li>
            {b.around.filter(r => r.rank > b.me!.rank).map(r => <li key={r.rank} data-anon><span className={styles.trophyRank}>{r.rank}</span><span>A member · {r.size_cm} cm</span></li>)}
          </>}
        </ol>}
        {!b.me && b.entrants > 0 && data.open && <p className={styles.hint}>You haven&apos;t entered yet: catch anything in this category.</p>}
      </section>)}
    </>}
  </IslandSheet>;
}

/** GENESIS posters (E at the stage): this year's projects, and why showing up in person counts. */
export function PostersSheet({ open, onClose, event }: { open: boolean; onClose: () => void; event: IslandEvent | null }) {
  if (!open || !event) return null;
  const titles = event.goal.event.posters;
  return <IslandSheet title="GENESIS week" onClose={onClose} testId="posters-sheet">
    <p className={styles.hint}>The club&apos;s project showcase, mirrored on the island. Checking in at the real GENESIS counts the most toward this week&apos;s goal.</p>
    {titles.length ? <ul className={styles.posterList}>{titles.map(t => <li key={t}>{t}</li>)}</ul> : <p>This year&apos;s project posters go up here once the showcase lineup is set.</p>}
  </IslandSheet>;
}
