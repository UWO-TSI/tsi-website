"use client";

/**
 * The café's lightboxes (lib/game/cafe.ts CAFE_SIGNS): the modeled lightbox
 * body scaled to each sign, and its glowing face drawn once into a canvas —
 * red capitals on white for the hanging signs (ref 1), cream boards with a
 * heading and a two-column list for the menus (refs 2–4). Emissive faces, not
 * lights; hanging signs on two rods to the ceiling.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CAFE_ROOM, CAFE_SIGNS, type CafeSign } from "@/lib/game/cafe";
import { useCafeModel } from "./CafeModel";

const PX = 512;
const SANS = `"Avenir Next", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`;

function paint(sign: CafeSign): THREE.CanvasTexture {
  const [w, h] = sign.size;
  const c = document.createElement("canvas");
  c.width = Math.round(PX * w);
  c.height = Math.round(PX * h);
  const g = c.getContext("2d")!;
  const W = c.width, H = c.height;
  // A diffuser lit from behind: brightest in the middle, a little warmer toward the frame.
  const glow = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.max(W, H) * 0.65);
  glow.addColorStop(0, sign.kind === "sign" ? "#fffdf6" : "#fbf1dc");
  glow.addColorStop(1, sign.kind === "sign" ? "#f4e7cf" : "#ecd8b2");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  if (sign.kind === "sign") {
    g.fillStyle = "#c7372c";
    g.textAlign = "center";
    let size = H * 0.5;
    g.font = `600 ${size}px ${SANS}`;
    while (g.measureText(sign.text).width > W * 0.84 && size > 10) g.font = `600 ${(size -= 4)}px ${SANS}`;
    g.letterSpacing = `${Math.round(size * 0.08)}px`;
    g.fillText(sign.text, W / 2, H * 0.53);
  } else {
    const pad = H * 0.11;
    g.fillStyle = "#4a2c18";
    g.textAlign = "left";
    g.font = `700 ${H * 0.13}px ${SANS}`;
    g.letterSpacing = `${Math.round(H * 0.012)}px`;
    g.fillText(sign.title, pad, pad + H * 0.06);
    g.letterSpacing = "0px";
    g.fillStyle = "#553620";
    g.font = `600 ${H * 0.088}px ${SANS}`;
    const col = Math.ceil(sign.items.length / 2), line = H * 0.135, top = pad + H * 0.24;
    sign.items.forEach((item, i) => g.fillText(item, pad + (i >= col ? W * 0.5 : 0), top + (i % col) * line));
    if (sign.note) {
      g.font = `italic 500 ${H * 0.066}px ${SANS}`;
      g.fillStyle = "#7a5a3c";
      g.fillText(sign.note, pad, H - pad * 0.9);
    }
    g.strokeStyle = "#b8956a";
    g.lineWidth = Math.max(2, H * 0.006);
    g.beginPath(); g.moveTo(pad, pad + H * 0.15); g.lineTo(W - pad, pad + H * 0.15); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Lightbox({ sign }: { sign: CafeSign }) {
  const body = useCafeModel("lightbox");
  const [box, rod] = useMemo(() => [body.getObjectByName("lightbox_body")!, body.getObjectByName("lightbox_rod")!], [body]);
  const texture = useMemo(() => paint(sign), [sign]);
  // Above 1 so the High tier's bloom picks the face up, like a real backlit diffuser.
  const face = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1.5, 1.42, 1.3) }), [texture]);
  useEffect(() => () => { texture.dispose(); face.dispose(); }, [texture, face]);
  const [w, h] = sign.size;
  const rodLength = CAFE_ROOM.ceiling - (sign.at[1] + h / 2);
  return <group position={sign.at}>
    <primitive object={box} scale={[w + 0.08, h + 0.08, 1]} />
    <mesh position={[0, 0, -0.061]} rotation={[0, Math.PI, 0]} material={face}><planeGeometry args={[w, h]} /></mesh>
    {sign.kind === "sign" && [-1, 1].map(s => <primitive key={s} object={s < 0 ? rod : rod.clone()} position={[s * (w / 2 - 0.12), h / 2 + 0.04, 0]} scale={[1, rodLength, 1]} />)}
  </group>;
}

export default function CafeSigns() {
  return <>{CAFE_SIGNS.map(sign => <Lightbox key={sign.id} sign={sign} />)}</>;
}
