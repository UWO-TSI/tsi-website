// gpupixels.mjs <a> <b> ...pairs: what WebGL gets from each image, as three uploads it (an <img>, UNPACK_FLIP_Y off,
// premultiply off, colour-space conversion BROWSER_DEFAULT and NONE), read back from a framebuffer: compared byte by byte.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const args = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
let bad = 0;
for (let i = 0; i < args.length; i += 2) {
  const urls = args.slice(i, i + 2).map(f => `data:image/${f.endsWith(".webp") ? "webp" : "png"};base64,${readFileSync(f).toString("base64")}`);
  const r = await page.evaluate(async urls => {
    const imgs = await Promise.all(urls.map(u => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; })));
    const gl = document.createElement("canvas").getContext("webgl2");
    const read = (im, conv) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, conv);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const px = new Uint8Array(im.naturalWidth * im.naturalHeight * 4);
      gl.readPixels(0, 0, im.naturalWidth, im.naturalHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.deleteFramebuffer(fb); gl.deleteTexture(t); return px;
    };
    const out = [];
    for (const conv of [gl.BROWSER_DEFAULT_WEBGL, gl.NONE]) {
      const [a, b] = imgs.map(im => read(im, conv)); let diff = 0;
      for (let k = 0; k < a.length; k++) diff += a[k] !== b[k];
      out.push(diff);
    }
    return { w: imgs[0].naturalWidth, h: imgs[0].naturalHeight, w2: imgs[1].naturalWidth, h2: imgs[1].naturalHeight, out };
  }, urls);
  const same = r.w === r.w2 && r.h === r.h2 && r.out.every(d => d === 0);
  if (!same) bad++;
  console.log(`${same ? "identical on the GPU" : `DIFFERENT ${JSON.stringify(r)}`} ${r.w}x${r.h} ${args[i].split("/").pop()} vs ${args[i + 1].split("/").pop()} (bytes differing, browser-default / none: ${r.out.join(" / ")})`);
}
await browser.close();
process.exit(bad ? 1 : 0);
