// Remodel-props evidence: clean turntable views of the old and the new model side by side, one camera for both (framed
// on the larger of the two, so their sizes compare truly), front and three-quarter. Serves its own page plus
// web/public/assets, the old GLBs (OLD_DIR, extracted from git) and three.js from web/node_modules on PORT; headless,
// muted. No dev server needed. Run from web/:
//   PORT=3182 OLD_DIR=<dir> node ../specs/evidence/remodel-props/tools/turntable-pair.mjs <out-dir> [id,id,...]
// Writes <out-dir>/<id>.old.front.png, .old.q.png, .new.front.png, .new.q.png (480 px, the asset audit's cream ground
// and tan disc at the origin) and <out-dir>/tt-meta.json (each model's bounds as drawn).
// Each model is drawn as the game draws it: its use-site scale (and turn), double-sided, shadow hulls hidden.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, only] = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 3182), SIZE = Number(process.env.SIZE ?? 480), OLD_DIR = process.env.OLD_DIR;
const WEB = process.cwd();
mkdirSync(outDir, { recursive: true });

/** Old: as the game drew it (use-site scale and turn). New: the same. `front`: the azimuth the front view looks from (deg, 0 = from +z). */
const A = "/old/acnh/";
const PAIRS = [
  { id: "campfire", old: [{ url: `${A}props/campfire.glb`, scale: 0.8 }], new: [{ url: "/assets/game/props/campfire.glb" }], front: 0 },
  { id: "mailbox", old: [{ url: `${A}furniture/mailbox.glb`, scale: 0.1 }], new: [{ url: "/assets/game/props/mailbox.glb" }], front: 0 },
  { id: "streetlamp", old: [{ url: `${A}props/streetlamp.glb` }], new: [{ url: "/assets/game/props/streetlamp.glb" }], front: 0 },
  { id: "hq-lamps", old: [{ url: `${A}furniture/floor-lamp.glb`, scale: 0.115, at: [-0.45, 0, 0] }, { url: `${A}furniture/clubhouse-pendant.glb`, scale: 0.07, at: [0.45, 1.9, 0] }],
    new: [{ url: "/assets/game/props/hq-floor-lamp.glb", scale: 1.15, at: [-0.45, 0, 0] }, { url: "/assets/game/props/hq-pendant.glb", scale: 0.7, at: [0.45, 1.9, 0] }], front: 180 },
  { id: "museum-door-fence", old: [{ url: `${A}props/fence-country-b.glb`, at: [-0.6, 0, 0] }, { url: `${A}props/fence-country-b.glb`, at: [0.6, 0, 0] }], new: [{ url: "/assets/game/props/museum-door-fence.glb" }], front: 180 },
  { id: "welcome-mat", old: [{ url: `${A}furniture/yellow-message-mat.glb`, scale: 0.14, rotX: Math.PI, rotY: Math.PI }], new: [{ url: "/assets/game/props/welcome-mat.glb", scale: 1.4 }], front: 180 },
  { id: "buoy", old: [{ url: `${A}props/buoy.glb`, scale: 0.085 }], new: [{ url: "/assets/game/props/buoy.glb" }], front: 0 },
  { id: "rowboat", old: [{ url: "/old/game/wharf/rowboat.glb" }], new: [{ url: "/assets/game/wharf/rowboat.glb" }], front: 90 },
  { id: "study-table", old: [{ url: `${A}furniture/reading-table.glb`, scale: 0.1, at: [0.49, 0, 0] }, { url: `${A}furniture/reading-table.glb`, scale: 0.1, at: [-0.49, 0, 0] }, { url: `${A}furniture/lounge-book.glb`, scale: 0.065, at: [0.15, 0.84, 0], rotY: 0.3 }],
    new: [{ url: "/assets/game/props/study-table-long.glb" }, { url: "/assets/game/props/study-book.glb", scale: 0.65, at: [0.15, 0.84, 0], rotY: 0.3 }], front: 0 },
].filter(p => !only || only.split(",").includes(p.id));

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4efe3">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const SIZE = ${SIZE};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor("#f4efe3", 1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight("#fff8ec", "#b9ad94", 1.5));
const key = new THREE.DirectionalLight("#fff3df", 2.2); key.position.set(-2.5, 4, 3.5);
const fill = new THREE.DirectionalLight("#e4ecff", 0.5); fill.position.set(3, 1.2, 2);
const rim = new THREE.DirectionalLight("#ffffff", 0.5); rim.position.set(0.5, 2, -4);
scene.add(key, fill, rim);
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 5000);
const loader = new GLTFLoader();
const deg = THREE.MathUtils.degToRad;
async function group(parts) {
  const g = new THREE.Group();
  for (const p of parts) {
    const gltf = await loader.loadAsync(p.url);
    const m = gltf.scene;
    m.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(x => /shadow/i.test(x.name))) { o.visible = false; return; }
      for (const x of mats) { x.side = THREE.DoubleSide; if (x.emissiveMap) x.emissiveIntensity = 0; }
    });
    const holder = new THREE.Group();
    if (p.rotX) {
      // interiorShared Piece: turned over, then grounded on its bounds.
      m.rotation.x = p.rotX; m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -b.min.y, -c.z);
    }
    holder.add(m);
    holder.scale.setScalar(p.scale ?? 1);
    holder.rotation.y = p.rotY ?? 0;
    holder.position.set(...(p.at ?? [0, 0, 0]));
    g.add(holder);
  }
  g.updateMatrixWorld(true);
  return g;
}
const boxOf = g => { const b = new THREE.Box3(); g.traverse(o => { if (o.isMesh && o.visible) b.expandByObject(o, true); }); return b; };
window.__pair = async (oldParts, newParts, front) => {
  const og = await group(oldParts), ng = await group(newParts);
  const ob = boxOf(og), nb = boxOf(ng), all = ob.clone().union(nb);
  const centre = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 1e-3);
  const out = { old: { min: ob.min.toArray(), max: ob.max.toArray() }, new: { min: nb.min.toArray(), max: nb.max.toArray() } };
  for (const [name, g] of [["old", og], ["new", ng]]) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62, 48), new THREE.MeshBasicMaterial({ color: "#e2d6bb" }));
    disc.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(size.x, size.z) * 0.62, Math.max(size.x, size.z) * 0.64, 64), new THREE.MeshBasicMaterial({ color: "#b9a77f", side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0005 * r;
    scene.add(g, disc, ring);
    for (const [view, az, el] of [["front", front, 12], ["q", front + 35, 26]]) {
      const dir = new THREE.Vector3(Math.sin(deg(az)) * Math.cos(deg(el)), Math.sin(deg(el)), Math.cos(deg(az)) * Math.cos(deg(el)));
      const dist = r / Math.sin(deg(15)) * 0.98;
      camera.position.copy(centre).addScaledVector(dir, dist);
      camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix();
      camera.lookAt(centre);
      renderer.render(scene, camera);
      out[name + "." + view] = renderer.domElement.toDataURL("image/png");
    }
    scene.remove(g, disc, ring);
  }
  return out;
};
window.__ready = true;
</script>`;

const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" || url === "/tt.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const file = url.startsWith("/three/") ? join(WEB, "node_modules", url.slice(1))
    : url.startsWith("/assets/") ? join(WEB, "public", url)
    : url.startsWith("/old/") && OLD_DIR ? join(OLD_DIR, url.slice(5)) : null;
  if (!file || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${PORT}/tt.html`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
const metaFile = join(outDir, "tt-meta.json");
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
for (const p of PAIRS) {
  try {
    const r = await page.evaluate(([o, n, f]) => window.__pair(o, n, f), [p.old, p.new, p.front]);
    for (const k of ["old.front", "old.q", "new.front", "new.q"]) writeFileSync(join(outDir, `${p.id}.${k}.png`), Buffer.from(r[k].split(",")[1], "base64"));
    meta[p.id] = { old: r.old, new: r.new };
    console.log("pair", p.id, JSON.stringify(meta[p.id]));
  } catch (e) { console.log("FAILED", p.id, String(e).split("\n")[0].slice(0, 200)); }
}
writeFileSync(metaFile, JSON.stringify(meta, null, 1));
await browser.close();
server.close();
