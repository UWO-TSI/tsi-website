/**
 * Family sigils drawn to a canvas (placeholder art until real sigil sprites
 * exist): a ring with the family glyph. Arcane = eight-point star, Ranger =
 * compass needle, Vanguard = spark, Warden = leaf.
 */
import * as THREE from "three";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";

export function sigilTexture(family: Family, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const c = size / 2, color = FAMILIES[family].light;
  g.translate(c, c);
  g.shadowColor = color; g.shadowBlur = size * 0.08;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = size * 0.028; g.lineJoin = "round";
  g.beginPath(); g.arc(0, 0, size * 0.42, 0, Math.PI * 2); g.stroke();
  g.lineWidth = size * 0.012;
  g.beginPath(); g.arc(0, 0, size * 0.36, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * size * 0.39, Math.sin(a) * size * 0.39, size * 0.012, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = size * 0.03;
  const r = size * 0.26;
  g.beginPath();
  if (family === "Arcane") {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.38 : (i % 4 ? r * 0.72 : r); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  } else if (family === "Ranger") {
    g.moveTo(0, -r); g.lineTo(r * 0.28, 0); g.lineTo(0, r); g.lineTo(-r * 0.28, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
  } else if (family === "Vanguard") {
    g.moveTo(r * 0.2, -r); g.lineTo(-r * 0.45, r * 0.1); g.lineTo(0, r * 0.1); g.lineTo(-r * 0.2, r); g.lineTo(r * 0.45, -r * 0.1); g.lineTo(0, -r * 0.1); g.closePath(); g.fill();
  } else {
    g.moveTo(0, r); g.bezierCurveTo(-r * 0.9, r * 0.2, -r * 0.5, -r * 0.8, 0, -r); g.bezierCurveTo(r * 0.5, -r * 0.8, r * 0.9, r * 0.2, 0, r); g.fill();
    g.strokeStyle = "rgba(20,40,20,0.55)"; g.lineWidth = size * 0.014; g.shadowBlur = 0;
    g.beginPath(); g.moveTo(0, r * 0.9); g.lineTo(0, -r * 0.7); g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
