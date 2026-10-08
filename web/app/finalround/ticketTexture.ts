import * as THREE from "three";

export const TICKET_W = 3.2;
export const TICKET_H = 1.8;

const PX = 2048;
const PY = Math.round((PX * TICKET_H) / TICKET_W);

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export async function drawTicket(name: string, project: string, memberNo: string, date: string) {
  await document.fonts.ready;
  const body = fontVar("--font-body", "system-ui, sans-serif");
  const mono = fontVar("--font-highlight", "ui-monospace, monospace");

  const c = document.createElement("canvas");
  c.width = PX;
  c.height = PY;
  const ctx = c.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, PX, PY);
  bg.addColorStop(0, "#0d1b2a");
  bg.addColorStop(0.5, "#111827");
  bg.addColorStop(1, "#0a0a0c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PX, PY);

  // holographic sweep
  const holo = ctx.createLinearGradient(0, PY, PX, 0);
  holo.addColorStop(0.15, "rgba(34,211,238,0)");
  holo.addColorStop(0.35, "rgba(34,211,238,0.22)");
  holo.addColorStop(0.5, "rgba(255,209,102,0.2)");
  holo.addColorStop(0.65, "rgba(29,155,240,0.24)");
  holo.addColorStop(0.85, "rgba(29,155,240,0)");
  ctx.fillStyle = holo;
  ctx.fillRect(0, 0, PX, PY);

  // fine grid
  ctx.strokeStyle = "rgba(241,255,255,0.04)";
  ctx.lineWidth = 2;
  for (let x = 0; x < PX; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, PY);
    ctx.stroke();
  }
  for (let y = 0; y < PY; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PX, y);
    ctx.stroke();
  }

  const pad = 120;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#22d3ee";
  ctx.font = `600 44px ${mono}`;
  ctx.letterSpacing = "14px";
  ctx.fillText("TECH FOR SOCIAL IMPACT", pad, pad + 40);
  ctx.fillStyle = "rgba(241,255,255,0.5)";
  ctx.fillText("2026 / 27 COHORT", pad, pad + 110);

  // admit one pill
  ctx.font = `600 38px ${mono}`;
  ctx.letterSpacing = "10px";
  const pill = "ADMIT ONE";
  const pw = ctx.measureText(pill).width + 90;
  ctx.strokeStyle = "rgba(255,209,102,0.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(PX - pad - pw, pad - 20, pw, 84, 42);
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  ctx.fillText(pill, PX - pad - pw + 45, pad + 36);

  ctx.letterSpacing = "12px";
  ctx.fillStyle = "rgba(241,255,255,0.6)";
  ctx.font = `500 44px ${body}`;
  ctx.fillText("ACCEPTED", pad, 470);

  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#f1ffff";
  let size = 170;
  ctx.font = `700 ${size}px ${body}`;
  while (ctx.measureText(name).width > PX - pad * 2 && size > 70) {
    size -= 6;
    ctx.font = `700 ${size}px ${body}`;
  }
  ctx.fillText(name, pad, 470 + 40 + size * 0.85);

  const welcome = project ? `Welcome to ${project}.` : "Welcome to the team.";
  let wsize = 60;
  ctx.font = `500 ${wsize}px ${body}`;
  while (ctx.measureText(welcome).width > PX - pad * 2 && wsize > 34) {
    wsize -= 2;
    ctx.font = `500 ${wsize}px ${body}`;
  }
  ctx.fillStyle = "#22d3ee";
  ctx.fillText(welcome, pad, 470 + 40 + size * 0.85 + 100);

  // perforation
  const perfY = PY - 330;
  ctx.setLineDash([18, 16]);
  ctx.strokeStyle = "rgba(241,255,255,0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, perfY);
  ctx.lineTo(PX - pad, perfY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.letterSpacing = "10px";
  ctx.font = `500 34px ${mono}`;
  ctx.fillStyle = "rgba(241,255,255,0.5)";
  ctx.fillText("MEMBER NO.", pad, perfY + 80);
  ctx.textAlign = "right";
  ctx.fillText("ISSUED", PX - pad, perfY + 80);
  ctx.letterSpacing = "4px";
  ctx.font = `700 72px ${mono}`;
  ctx.fillStyle = "#f1ffff";
  ctx.fillText(date.toUpperCase(), PX - pad, perfY + 170);
  ctx.textAlign = "left";
  ctx.fillText(memberNo, pad, perfY + 170);

  // barcode
  ctx.fillStyle = "rgba(241,255,255,0.7)";
  let seed = 0;
  for (const ch of memberNo + name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  let x = pad;
  while (x < PX - pad) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const w = 3 + (seed % 4) * 3;
    ctx.fillRect(x, PY - 120, w, 60);
    x += w + 6 + ((seed >> 4) % 3) * 4;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
