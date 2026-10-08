import { drawTicket } from "./ticketTexture";

export type ShareFormat = "post" | "story";

const SIZES: Record<ShareFormat, [number, number]> = {
  post: [1080, 1350], // 4:5 feed post: Instagram, LinkedIn, X
  story: [1080, 1920], // 9:16 story
};

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// A designed, fixed-size image for posting, independent of the viewer's screen.
export async function renderShareCard(
  opts: { name: string; project: string; memberNo: string; date: string },
  format: ShareFormat
) {
  const [W, H] = SIZES[format];
  const story = format === "story";
  const body = fontVar("--font-body", "system-ui, sans-serif");
  const mono = fontVar("--font-highlight", "ui-monospace, monospace");
  const ticket = (await drawTicket(opts.name, opts.project, opts.memberNo, opts.date)).image as HTMLCanvasElement;
  const logo = new Image();
  logo.src = "/logo-dark.svg";
  const hasLogo = await logo.decode().then(() => true, () => false);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // Background: near-black with a warm vault glow and a cool corner light.
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(0, 0, W, H);
  const cy = story ? H * 0.5 : H * 0.53;
  const glow = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, W * 0.75);
  glow.addColorStop(0, "rgba(255,197,107,0.38)");
  glow.addColorStop(0.45, "rgba(255,170,60,0.10)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const cool = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
  cool.addColorStop(0, "rgba(34,211,238,0.16)");
  cool.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, W, H);

  // Vault rings behind the ticket.
  ctx.strokeStyle = "rgba(255,209,102,0.55)";
  ctx.lineWidth = 3;
  for (const r of [W * 0.42, W * 0.36]) {
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,209,102,0.25)";
  }

  // Header: mark + org name.
  const pad = 80;
  const top = story ? 150 : 90;
  if (hasLogo) ctx.drawImage(logo, pad, top - 8, 64, 64);
  ctx.fillStyle = "#22d3ee";
  ctx.font = `600 26px ${mono}`;
  ctx.letterSpacing = "8px";
  ctx.textBaseline = "middle";
  ctx.fillText("TECH FOR SOCIAL IMPACT", pad + (hasLogo ? 88 : 0), top + 24);

  // Headline.
  ctx.letterSpacing = "0px";
  ctx.textBaseline = "alphabetic";
  const h1 = story ? 120 : 104;
  const hy = top + (story ? 260 : 200);
  ctx.fillStyle = "#f1ffff";
  ctx.font = `800 ${h1}px ${body}`;
  ctx.fillText("I made it", pad, hy);
  const gold = ctx.createLinearGradient(pad, 0, W - pad, 0);
  gold.addColorStop(0, "#ffd166");
  gold.addColorStop(0.5, "#fff3cf");
  gold.addColorStop(1, "#ffd166");
  ctx.fillStyle = gold;
  ctx.fillText("into TSI.", pad, hy + h1 * 1.02);

  // Ticket, tilted, with a soft shadow and a glare streak.
  const tw = W - pad * 2 + 20;
  const th = tw * (ticket.height / ticket.width);
  ctx.save();
  ctx.translate(W / 2, cy + (story ? 120 : 110));
  ctx.rotate(-0.06);
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, 22);
  ctx.fillStyle = "#0d1b2a";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  ctx.drawImage(ticket, -tw / 2, -th / 2, tw, th);
  const glare = ctx.createLinearGradient(-tw / 2, -th / 2, tw / 2, th / 2);
  glare.addColorStop(0.3, "rgba(255,255,255,0)");
  glare.addColorStop(0.45, "rgba(255,255,255,0.14)");
  glare.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";

  // Footer.
  const fy = H - (story ? 200 : 110);
  ctx.fillStyle = "rgba(241,255,255,0.85)";
  ctx.font = `600 34px ${body}`;
  ctx.fillText(`2026/27 Cohort${opts.project ? `  ·  ${opts.project}` : ""}`, pad, fy);
  ctx.fillStyle = "rgba(241,255,255,0.45)";
  ctx.font = `500 26px ${mono}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("WESTERN UNIVERSITY", pad, fy + 48);

  return c;
}

export function shareCaption(project: string) {
  const team = project ? ` on the ${project.replace(/ Team$/, "")} team` : "";
  return `Excited to share that I'm joining Tech for Social Impact at Western for the 2026/27 cohort${team}, building software for organizations doing real good in our community.`;
}
