"use client";

/**
 * The HQ's trophy case (specs/polish/forage-craft-museum.md 8): this week's biggest catches (/api/collections/trophies,
 * two a member so it shows the club) in 3D in a walnut and glass cabinet (art/interiors/build_interiors.py
 * trophy_case), each on its own little stand with a brass plate (the plates and the sign over the case are one label
 * texture, drawn here and redrawn when the trophies change): the best three at eye level on the middle shelf, the next
 * three below, the club's gold, silver and bronze cups on top. Your own say "Yours" on their plates. The trophy sheet
 * (E at the case) still lists them all. The member clubhouse only: the applicant island keeps its display.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { apiCall } from "@/lib/apiClient";
import { HQ_LAYOUT } from "@/lib/game/clubhouse";
import type { Trophy } from "@/lib/collections/logic";
import { ROSTER } from "@/lib/collections/roster";
import { SPECIES as CRITTERS } from "./Critters";
import { GLBProp } from "./NatureModels";
import { Piece } from "./interiorShared";
import { registerShellMaterial, useKitPiece } from "./RoomShell";
import { levelFish, tankFishDef } from "./peaceful/TankFish";

/** Mirrors build_interiors.py TROPHY: the stands' spots (x, shelf height) in trophy_slots() order, the cups' shelf, the stands' tops. */
const SLOTS: readonly [number, number][] = [[0.72, 0.17], [0, 0.17], [-0.72, 0.17], [0.72, 0.75], [0, 0.75], [-0.72, 0.75]];
const TOP_SHELF = 1.33, STAND_TOP = 0.09;
/** Rank → slot: the best three at eye level (the middle shelf, the first in the middle, the second on the left as you look), the next three below. */
const SLOT_OF_RANK = [4, 3, 5, 1, 0, 2];
/** The label atlas: 512 wide, the sign 96 high on top, then a 96 high row per stand (build_interiors.py TROPHY_SIGN_H, TROPHY_ROW_H). */
const W = 512, SIGN_H = 96, ROW_H = 96, H = SIGN_H + 6 * ROW_H;
const FONT = '"Tethos Nunito", Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif';
const WALNUT = "#5e3d26", PAPER = "#fbf3dc", BRASS = "#c9a75e", INK = "#3b2a14", GOLD_INK = "#7a4b0f";
const MODEL = new Map(ROSTER.map(s => [s.key, s.model]));
const CRITTER = new Map(CRITTERS.map(c => [c.key, c]));

class Labels {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas = document.createElement("canvas");
  constructor() {
    this.canvas.width = W; this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false; // the kit's UVs are glTF's (v down the image)
    this.texture.anisotropy = 4;
  }
  draw(trophies: readonly Trophy[] | null, me: string | null, weekOf: string) {
    const g = this.canvas.getContext("2d")!;
    g.fillStyle = WALNUT; g.fillRect(0, 0, W, SIGN_H);
    fit(g, "This week's trophies", W / 2, SIGN_H * 0.4, W - 40, 40, 800, PAPER);
    fit(g, weekOf, W / 2, SIGN_H * 0.76, W - 60, 22, 700, "#e9dcc0");
    for (let s = 0; s < 6; s++) {
      const y0 = SIGN_H + s * ROW_H, rank = SLOT_OF_RANK.indexOf(s), t = trophies?.[rank];
      g.fillStyle = BRASS; g.fillRect(0, y0, W, ROW_H);
      g.globalAlpha = 0.18; g.fillStyle = "#ffffff"; g.fillRect(0, y0, W, 6); g.globalAlpha = 1;
      if (!t) { fit(g, trophies ? "Waiting for a big one" : "…", W / 2, y0 + ROW_H / 2, W - 50, 30, 700, "#5e4a2a"); continue; }
      const mine = !!me && t.member_id === me;
      fit(g, `${t.rank}. ${t.name} · ${t.size_cm} cm`, W / 2, y0 + ROW_H * 0.38, W - 40, 34, 800, INK);
      fit(g, mine ? "Yours" : t.member_name, W / 2, y0 + ROW_H * 0.74, W - 60, 26, 800, mine ? GOLD_INK : "#4a3a22");
    }
    this.texture.needsUpdate = true;
  }
}
function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: number, color: string) {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (s > 12 && g.measureText(text).width > maxW) { s -= 2; g.font = `${weight} ${s}px ${FONT}`; }
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, x, y);
}
let labels: Labels | null = null;
const trophyLabels = () => (labels ??= new Labels());
registerShellMaterial("trophy_labels", () => new THREE.MeshStandardMaterial({ name: "TrophyLabels", map: trophyLabels().texture, roughness: 0.55, metalness: 0.25 }));

/** A fish laid level on a short brass post, turned to show its side. */
function MountedFish({ trophy }: { trophy: Trophy }) {
  const def = tankFishDef(trophy.key)!;
  const { scene } = useGLTF(def.model);
  const body = useMemo(() => levelFish(scene, def, 0.5), [scene, def]);
  return <group position={[0, 0.2, 0]} rotation={[0, Math.PI / 2 + 0.25, 0.08]}><primitive object={body} /></group>;
}
/** One trophy on its stand: a fish mounted, a bug or a shell as it is. */
function Specimen({ trophy }: { trophy: Trophy }) {
  if (tankFishDef(trophy.key)) return <MountedFish trophy={trophy} />;
  const critter = CRITTER.get(trophy.key);
  if (critter) return <GLBProp url={critter.model} scale={critter.scale * 1.6} position={[0, 0.03, 0]} rotation={[0, -0.4, 0]} />;
  const model = MODEL.get(trophy.key);
  return model ? <GLBProp url={model} scale={1.4} position={[0, 0.02, 0]} rotation={[0, -0.5, 0]} /> : null;
}

function Cabinet() {
  const shell = useKitPiece("trophy_case"), plates = useKitPiece("trophy_labels");
  return <><primitive object={shell} /><primitive object={plates} /></>;
}

export default function TrophyCase({ member }: { member: string | null }) {
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [week, setWeek] = useState("");
  useEffect(() => {
    let alive = true;
    apiCall<{ week_start: string; trophies: Trophy[] }>("/api/collections/trophies", "case").then(c => {
      if (!alive) return;
      setTrophies(c.trophies.slice(0, 6));
      setWeek(`Since ${new Date(`${c.week_start}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}`);
    }, () => { if (alive) setTrophies([]); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    trophyLabels().draw(trophies, member, week);
    let alive = true;
    // The kit's rounded face may arrive after the first draw: draw again in it.
    void document.fonts?.ready.then(() => { if (alive) trophyLabels().draw(trophies, member, week); });
    return () => { alive = false; };
  }, [trophies, member, week]);
  const [x, , z] = HQ_LAYOUT.display.position;
  return <group position={[x, 0, z]}>
    <Suspense fallback={null}><Cabinet /></Suspense>
    {(trophies ?? []).map((t, rank) => {
      const [sx, sy] = SLOTS[SLOT_OF_RANK[rank]];
      return <group key={`${t.key}:${t.member_id}`} position={[sx, sy + STAND_TOP, -0.03]}><Suspense fallback={null}><Specimen trophy={t} /></Suspense></group>;
    })}
    {/* The club's cups on the top shelf. */}
    <Suspense fallback={null}>
      <Piece name="gold-hha-trophy" rotX={Math.PI / 2} position={[0, TOP_SHELF, 0]} rotY={Math.PI} scale={0.075} />
      <Piece name="silver-hha-trophy" rotX={Math.PI / 2} position={[0.68, TOP_SHELF, 0.02]} rotY={Math.PI} scale={0.065} />
      <Piece name="bronze-hha-trophy" rotX={Math.PI / 2} position={[-0.68, TOP_SHELF, 0.02]} rotY={Math.PI} scale={0.065} />
    </Suspense>
  </group>;
}
