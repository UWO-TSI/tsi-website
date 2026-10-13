import { drawTicket } from "./ticketTexture";

export type ShareFormat = "story" | "linkedin";

const SIZES: Record<ShareFormat, [number, number]> = {
  story: [1080, 1920], // 9:16 Instagram / TikTok story
  linkedin: [1200, 627], // LinkedIn feed card
};

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Opts = { name: string; project: string; memberNo: string; date: string };

// Gold vault glow, rings and a scatter of sparkles, centred on (cx, cy).
function backdrop(ctx: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number, r: number, seed: string) {
  ctx.fillStyle = "#08090c";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.35);
  glow.addColorStop(0, "rgba(255,206,120,0.55)");
  glow.addColorStop(0.35, "rgba(255,170,60,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const cool = ctx.createRadialGradient(W, 0, 0, W, 0, Math.max(W, H) * 0.7);
  cool.addColorStop(0, "rgba(34,211,238,0.14)");
  cool.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, W, H);

  for (const [k, a] of [[1, 0.55], [0.84, 0.3], [0.68, 0.16]] as const) {
    ctx.strokeStyle = `rgba(255,209,102,${a})`;
    ctx.lineWidth = k === 1 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }

  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.5 + rand() * 1.1);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.9;
    const size = 1 + rand() * 2.6;
    ctx.fillStyle = `rgba(255,${200 + Math.floor(rand() * 55)},${150 + Math.floor(rand() * 90)},${0.25 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTicketAt(ctx: CanvasRenderingContext2D, ticket: HTMLCanvasElement, cx: number, cy: number, tw: number, tilt: number) {
  const th = tw * (ticket.height / ticket.width);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = tw * 0.08;
  ctx.shadowOffsetY = tw * 0.04;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, tw * 0.025);
  ctx.fillStyle = "#0d1b2a";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.clip();
  ctx.drawImage(ticket, -tw / 2, -th / 2, tw, th);
  const glare = ctx.createLinearGradient(-tw / 2, -th / 2, tw / 2, th / 2);
  glare.addColorStop(0.32, "rgba(255,255,255,0)");
  glare.addColorStop(0.46, "rgba(255,255,255,0.16)");
  glare.addColorStop(0.58, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,209,102,0.55)";
  ctx.lineWidth = Math.max(2, tw * 0.003);
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, tw * 0.025);
  ctx.stroke();
  ctx.restore();
}

function gold(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "#ffd166");
  g.addColorStop(0.5, "#fff3cf");
  g.addColorStop(1, "#ffd166");
  return g;
}

// A designed, fixed-size image for posting, independent of the viewer's screen.
export async function renderShareCard(opts: Opts, format: ShareFormat) {
  const [W, H] = SIZES[format];
  const body = fontVar("--font-body", "system-ui, sans-serif");
  const mono = fontVar("--font-highlight", "ui-monospace, monospace");
  const ticket = (await drawTicket(opts.name, opts.project, opts.memberNo, opts.date)).image as HTMLCanvasElement;
  const logo = new Image();
  logo.src = "/logo-dark.svg";
  const hasLogo = await logo.decode().then(() => true, () => false);
  const team = opts.project ? opts.project.replace(/ Team$/, "") : "";

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  if (format === "story") {
    const cy = H * 0.47;
    backdrop(ctx, W, H, W / 2, cy, W * 0.46, opts.name);

    if (hasLogo) ctx.drawImage(logo, W / 2 - 48, 170, 96, 96);
    ctx.textAlign = "center";
    ctx.fillStyle = "#22d3ee";
    ctx.font = `600 30px ${mono}`;
    ctx.letterSpacing = "10px";
    ctx.fillText("TECH FOR SOCIAL IMPACT", W / 2 + 5, 330);
    ctx.fillStyle = "rgba(241,255,255,0.5)";
    ctx.font = `500 24px ${mono}`;
    ctx.letterSpacing = "8px";
    ctx.fillText("2026 / 27 COHORT", W / 2 + 4, 375);

    drawTicketAt(ctx, ticket, W / 2, cy, W - 110, -0.04);

    ctx.letterSpacing = "0px";
    ctx.font = `800 118px ${body}`;
    const a = "I made it ";
    const b = "in.";
    const total = ctx.measureText(a + b).width;
    const x = W / 2 - total / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#f1ffff";
    ctx.fillText(a, x, H * 0.79);
    ctx.fillStyle = gold(ctx, x + ctx.measureText(a).width, x + total);
    ctx.fillText(b, x + ctx.measureText(a).width, H * 0.79);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(241,255,255,0.85)";
    ctx.font = `600 38px ${body}`;
    ctx.fillText(team ? `${team} team` : "Tech for Social Impact", W / 2, H * 0.79 + 82);
    ctx.fillStyle = "rgba(241,255,255,0.45)";
    ctx.font = `500 24px ${mono}`;
    ctx.letterSpacing = "8px";
    ctx.fillText("WESTERN UNIVERSITY", W / 2 + 4, H - 120);
  } else {
    const cx = W * 0.7;
    const cy = H * 0.52;
    backdrop(ctx, W, H, cx, cy, H * 0.62, opts.name);
    drawTicketAt(ctx, ticket, cx, cy, W * 0.5, -0.05);

    const pad = 64;
    if (hasLogo) ctx.drawImage(logo, pad, 70, 64, 64);
    ctx.textAlign = "left";
    ctx.fillStyle = "#22d3ee";
    ctx.font = `600 18px ${mono}`;
    ctx.letterSpacing = "6px";
    ctx.fillText("TECH FOR SOCIAL IMPACT", pad + 84, 98);
    ctx.fillStyle = "rgba(241,255,255,0.5)";
    ctx.font = `500 15px ${mono}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("2026 / 27 COHORT", pad + 84, 124);

    ctx.letterSpacing = "0px";
    ctx.font = `800 76px ${body}`;
    ctx.fillStyle = "#f1ffff";
    ctx.fillText("I made", pad, 290);
    ctx.fillText("it ", pad, 370);
    const itW = ctx.measureText("it ").width;
    ctx.fillStyle = gold(ctx, pad + itW, pad + itW + ctx.measureText("in.").width);
    ctx.fillText("in.", pad + itW, 370);

    ctx.fillStyle = "rgba(241,255,255,0.85)";
    ctx.font = `600 26px ${body}`;
    ctx.fillText(team ? `${team} team` : "Tech for Social Impact", pad, 440);
    ctx.fillStyle = "rgba(241,255,255,0.45)";
    ctx.font = `500 15px ${mono}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("WESTERN UNIVERSITY", pad, H - 64);
  }
  return c;
}

export function shareCaption(project: string) {
  const team = project ? ` on the ${project.replace(/ Team$/, "")} team` : "";
  return `Excited to share that I'm joining Tech for Social Impact at Western for the 2026/27 cohort${team}, building software for organizations doing real good in our community.`;
}
