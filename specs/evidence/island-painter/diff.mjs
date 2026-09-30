// Pixel diff of two shot folders: per-image changed-pixel share (any channel > tol) and mean abs error.
// node diff.mjs <dirA> <dirB> [tol=8]; writes <dirB>/diff-<name>.png highlighting changes.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [A, B, TOL = "8"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--mute-audio"] });
const page = await browser.newPage();
for (const f of fs.readdirSync(A).filter(f => f.endsWith(".png") && !f.startsWith("diff-") && fs.existsSync(`${B}/${f}`))) {
  const a = fs.readFileSync(`${A}/${f}`).toString("base64"), b = fs.readFileSync(`${B}/${f}`).toString("base64");
  const r = await page.evaluate(async ([a, b, tol]) => {
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height;
    const g = c.getContext("2d"); g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height);
    g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height);
    const out = g.createImageData(c.width, c.height);
    let changed = 0, sum = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
      sum += d; const hit = d > tol; if (hit) changed++;
      const grey = db.data[i] * 0.3;
      out.data.set(hit ? [255, 0, 80, 255] : [grey, grey, grey, 255], i);
    }
    g.putImageData(out, 0, 0);
    return { share: changed / (da.data.length / 4), mae: sum / (da.data.length / 4), png: c.toDataURL("image/png").split(",")[1] };
  }, [a, b, Number(TOL)]);
  fs.writeFileSync(`${B}/diff-${f}`, Buffer.from(r.png, "base64"));
  console.log(`${f}\tchanged ${(r.share * 100).toFixed(3)}%\tmean abs err ${r.mae.toFixed(3)}`);
}
await browser.close();
