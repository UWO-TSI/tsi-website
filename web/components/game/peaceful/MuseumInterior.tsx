"use client";

/**
 * Museum interior (decisions 61, 67, 201, 202): aquarium, insect hall and nature room side by side in the modelled
 * museum (RoomShell: each wing its own wall colour and floor, a walnut wainscot, side windows and a clerestory, a sign
 * over each wing), built from dump display furniture (aquarium tank, glass case, display stand). Cases fill from
 * /api/collections/museum; each case's plaque, on its walnut stand, names the species and its donor (empty cases never
 * name their species). Signs and plaques are one label texture, redrawn when the wings change. Odile the curator, at
 * her desk, takes donations (DonateSheet) and refuses duplicates.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces, type InteriorStation, type RoomBounds } from "../interiorShared";
import Keeper from "../Keeper";
import { RoomShell, preloadShells, registerShellMaterial, useKitPiece } from "../RoomShell";
import { GLBProp } from "../NatureModels";
import type { Exhibit, MuseumWing } from "@/lib/collections/logic";
import type { Wing } from "@/lib/collections/roster";
import { ROSTER } from "@/lib/collections/roster";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import InteriorDaylight from "../InteriorDaylight";

preloadPieces(["museum-tank", "museum-case", "museum-stand"]);
preloadShells(["museum"]);
const BOUNDS: RoomBounds = { halfW: 9, halfD: 5, spawn: [0, -3.4] };
const CASES_PER_WING = 6;
/** The wings in the shell's order (build_interiors.py WINGS): a label column each. */
const WINGS: Wing[] = ["aquarium", "insect_hall", "nature_room"];
const WING_X: Record<Wing, number> = { aquarium: 6, insect_hall: 0, nature_room: -6 };
const WING_TITLE: Record<Wing, string> = { aquarium: "Aquarium", insect_hall: "Insect hall", nature_room: "Nature room" };
export const MUSEUM_STATIONS: InteriorStation[] = [
  { id: "curator", name: "Curator", pos: [-2.2, -2.2], action: "donate", range: 1.8 },
  { id: "exit", name: "Outside", pos: [0, -4.2], action: "exit", range: 1.4 },
];
const TANK_GLASS = ["mGlass", "mGlassBack"], CASE_GLASS = ["mGlass", "mGlassR"];
const MODEL = new Map(ROSTER.map(s => [s.key, s.model]));

/** Displayed cases for a wing: donated exhibits first, then empty cases, up to the room's capacity. */
export function wingCases(wing: MuseumWing | undefined, capacity = CASES_PER_WING): Exhibit[] {
  if (!wing) return [];
  return [...wing.exhibits.filter(e => e.donated), ...wing.exhibits.filter(e => !e.donated)].slice(0, capacity);
}

// ── Signs and plaques: one atlas, a column per wing (the sign on top, its six cases under) ─────────────────────────
/** Mirrors build_interiors.py LABEL_SIGN_H, LABEL_ROW_H, LABEL_H and the 3 columns. */
const COL_W = 384, SIGN_H = 96, ROW_H = 192, ATLAS_H = SIGN_H + CASES_PER_WING * ROW_H;
const FONT = '"Tethos Nunito", Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif';
/** The kit's bark plaques (the GUI sheet's .plaque): paper type on bark, a dashed paper outline round an empty case. */
const BARK = "#725c4e", PAPER = "#fffbe7", PAPER_SOFT = "#f3ead2";

class LabelAtlas {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private key = "";
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = COL_W * WINGS.length; this.canvas.height = ATLAS_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }
  draw(byWing: Map<Wing, MuseumWing>, force = false) {
    const key = JSON.stringify(WINGS.map(w => { const m = byWing.get(w); return m ? [m.donated, m.total, wingCases(m).map(e => [e.slot, e.donated, e.name, e.donor_name])] : null; }));
    if (key === this.key && !force) return;
    this.key = key;
    const g = this.canvas.getContext("2d")!;
    WINGS.forEach((wing, k) => {
      const x0 = k * COL_W, w = byWing.get(wing);
      // The sign over the wing.
      board(g, x0, 0, COL_W, SIGN_H);
      fitText(g, `${WING_TITLE[wing]} · ${w ? `${w.donated}/${w.total}` : "…"}`, x0 + COL_W / 2, SIGN_H / 2 + 2, COL_W - 40, 46, 800, PAPER);
      const cases = wingCases(w);
      for (let i = 0; i < CASES_PER_WING; i++) {
        const y0 = SIGN_H + i * ROW_H, e = cases[i];
        board(g, x0, y0, COL_W, ROW_H);
        if (e?.donated) {
          fitText(g, e.name ?? "", x0 + COL_W / 2, y0 + ROW_H * 0.42, COL_W - 48, 52, 800, PAPER);
          fitText(g, `Donated by ${e.donor_name ?? "a member"}`, x0 + COL_W / 2, y0 + ROW_H * 0.72, COL_W - 48, 30, 700, PAPER_SOFT);
        } else {
          g.save(); g.strokeStyle = "rgba(243,234,210,0.75)"; g.lineWidth = 4; g.setLineDash([14, 10]);
          g.strokeRect(x0 + 26, y0 + 26, COL_W - 52, ROW_H - 52); g.restore();
          fitText(g, "Empty case", x0 + COL_W / 2, y0 + ROW_H / 2 + 2, COL_W - 80, 40, 700, PAPER_SOFT);
        }
      }
    });
    this.texture.needsUpdate = true;
  }
}
function board(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = BARK; g.fillRect(x, y, w, h);
  // A little grain in the bark and a soft bevel along the top.
  g.globalAlpha = 0.07; g.fillStyle = "#000000";
  for (let i = 0; i < h; i += 6) g.fillRect(x, y + i + ((i * 7) % 3), w, 1);
  g.globalAlpha = 0.18; g.fillStyle = "#ffffff"; g.fillRect(x, y, w, 3);
  g.globalAlpha = 1;
}
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: number, color: string) {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (s > 14 && g.measureText(text).width > maxW) { s -= 2; g.font = `${weight} ${s}px ${FONT}`; }
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, x, y);
}
let atlas: LabelAtlas | null = null;
const labelAtlas = () => (atlas ??= new LabelAtlas());
registerShellMaterial("museum_labels", () => new THREE.MeshStandardMaterial({ name: "Labels", map: labelAtlas().texture, roughness: 0.9 }));

function IconSprite({ url, y, z = 0 }: { url: string; y: number; z?: number }) {
  const tex = useTexture(url);
  return <sprite position={[0, y, z]} scale={[0.85, 0.85, 1]} renderOrder={2}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>;
}

function Case({ wing, exhibit, x, z }: { wing: Wing; exhibit: Exhibit; x: number; z: number }) {
  const piece = wing === "aquarium" ? "museum-tank" : wing === "insect_hall" ? "museum-case" : "museum-stand";
  const model = exhibit.key ? MODEL.get(exhibit.key) : null;
  // Aquarium fish swim low and near the glass: the tank lid hides the middle from the follow camera.
  const itemY = wing === "aquarium" ? 0.72 : wing === "insect_hall" ? 1.2 : 1.25;
  return <group position={[x, 0, z]}>
    <Suspense fallback={null}><Piece name={piece} position={[0, 0, 0]} scale={wing === "aquarium" ? 0.27 : 0.1} glassMaterial={wing === "aquarium" ? TANK_GLASS : wing === "insect_hall" ? CASE_GLASS : undefined} /></Suspense>
    {exhibit.donated && (model
      ? <Suspense fallback={null}><GLBProp url={model} position={[0, itemY - 0.2, 0]} scale={1.2} /></Suspense>
      : exhibit.icon ? <Suspense fallback={null}><IconSprite url={exhibit.icon} y={itemY} z={wing === "aquarium" ? -0.38 : 0} /></Suspense> : null)}
  </group>;
}

/** Odile's desk (art/interiors kit): walnut, a leather top, her lamp, the guest book, a bell and a specimen jar. */
function CuratorDesk() {
  const desk = useKitPiece("curator_desk");
  return <primitive object={desk} position={[-2.2, 0, -1.3]} />;
}

export default function MuseumInterior({ wings, frozen, talking = false, player, onNear, light = ISLAND_LIGHTING.day }: {
  wings: MuseumWing[] | null; frozen: boolean; player: React.RefObject<THREE.Vector3>; onNear: (near: "donate" | "exit" | null) => void;
  /** The donation sheet is open: the curator serves you. */
  talking?: boolean;
  /** The island's light now: the windows follow the time of day. */
  light?: IslandLight;
}) {
  const { scene, camera } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  useEffect(() => { player.current.set(0, 0, -3.4); camera.position.set(0, 8.4, -10.6); }, [camera, player]);
  const byWing = useMemo(() => new Map((wings ?? []).map(w => [w.wing, w])), [wings]);
  const lamps = interiorLight(light).lamps;
  useEffect(() => {
    labelAtlas().draw(byWing);
    // The kit's rounded face may arrive after the first draw: draw again in it.
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) labelAtlas().draw(byWing, true); });
    return () => { alive = false; };
  }, [byWing]);
  const nearRef = useRef<string | null>(null);
  const onWalk = (x: number, z: number) => {
    const s = nearestStation(MUSEUM_STATIONS, x, z)?.id ?? null;
    if (s !== nearRef.current) { nearRef.current = s; onNear(s === "curator" ? "donate" : s === "exit" ? "exit" : null); }
  };
  // Cases in two rows per wing; keep the centre aisle and the curator desk clear.
  const constrain = (x: number, z: number, nx: number, nz: number): [number, number] => {
    const blocked = (px: number, pz: number) => pz > 0.6 || (Math.abs(px + 2.2) < 1 && Math.abs(pz + 1.3) < 0.6);
    return !blocked(nx, nz) ? [nx, nz] : !blocked(nx, z) ? [nx, z] : !blocked(x, nz) ? [x, nz] : [x, z];
  };
  return <>
    {/* The museum keeps the island's hours: the day through its windows and clerestory, the case lights warm at night. */}
    <InteriorDaylight light={light} scale={{ key: 1.4, ambient: 0.32, hemisphere: 0.36, extent: 12 }} />
    <Suspense fallback={null}><RoomShell room="museum" light={light} /><CuratorDesk /></Suspense>
    {WINGS.map(wing => {
      const cx = WING_X[wing], cases = wingCases(byWing.get(wing));
      return <group key={wing}>
        <pointLight position={[cx, 3, 2.6]} intensity={12 * lamps} distance={8} color="#fff0d6" />
        {cases.map((exhibit, i) => <Case key={exhibit.slot} wing={wing} exhibit={exhibit} x={cx + 1.8 - (i % 3) * 1.8} z={i < 3 ? 1.6 : 3.8} />)}
      </group>;
    })}
    <Keeper room="museum" player={player} frozen={frozen} engaged={talking} />
    <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={player as React.MutableRefObject<THREE.Vector3>} onMove={onWalk} constrainMove={constrain} />
  </>;
}
