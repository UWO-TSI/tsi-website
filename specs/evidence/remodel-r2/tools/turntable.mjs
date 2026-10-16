// Remodel-r2 evidence: clean turntable views of the old model and ours, every set of one item framed by one camera (the
// union of their bounds, so sizes compare truly). Serves its own page, web/public/assets, the round-1 models (OLD_DIR,
// extracted from git) and three.js from web/node_modules on PORT; headless, muted, no dev server. Run from web/:
//   PORT=3183 OLD_DIR=<dir> node ../specs/evidence/remodel-r2/tools/turntable.mjs <out-dir> [id,id,...]
// Writes <out-dir>/<id>.<set>.<view>.png (SIZE px, the asset audit's cream ground and tan disc at the origin) and
// <out-dir>/tt-meta.json (each set's bounds as drawn). Azimuth 180 looks from -z: the game camera's side.
// Each model is drawn as the game draws it (its use-site scale and turn, double-sided, shadow hulls hidden).
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, only] = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 3183), SIZE = Number(process.env.SIZE ?? 420), OLD_DIR = process.env.OLD_DIR;
const WEB = process.cwd();
mkdirSync(outDir, { recursive: true });

const A = "/assets/acnh/", G = "/assets/game/", R1 = "/old/";
const FRONT = 180;
const AROUND = [["front", FRONT, 14], ["q", FRONT + 40, 26], ["side", FRONT + 90, 14], ["back", FRONT + 180, 14], ["top", FRONT, 62]];
const TWO = [["front", FRONT, 14], ["q", FRONT + 35, 26]];
const one = (url, o = {}) => [{ url, ...o }];
/** The dump bush each closed one is made from (art/nature/close_bushes.py). */
const BUSHES = { "azalea-spring": "azalea", "hydrangea-spring": "hydrangea", "hydrangea-summer": "hydrangea", "hibiscus-summer": "hibiscus",
  "holly-autumn": "holly", "hydrangea-autumn": "hydrangea", "holly-winter": "holly-snow" };
/** A run of connectable fence posts (lib/game/fences.ts, drawn as InstancedNature does): posts on cells, rails between. */
const FENCE_POST = `${G}props/fence-post.glb`, FENCE_RAIL = `${G}props/fence-rail.glb`;
function fenceRun(cells) {
  const key = c => c.join(","), has = new Set(cells.map(key)), parts = cells.map(([x, z]) => ({ url: FENCE_POST, at: [x, 0, z] }));
  for (const [x, z] of cells) {
    if (has.has(key([x + 1, z]))) parts.push({ url: FENCE_RAIL, at: [x + 0.5, 0, z] });
    if (has.has(key([x, z + 1]))) parts.push({ url: FENCE_RAIL, at: [x, 0, z + 0.5], rotY: Math.PI / 2 });
  }
  return parts;
}
const SHELLS = ["asari", "scallop", "turban", "whelk"];
const ITEMS = [
  ...Object.entries(BUSHES).map(([k, src]) => ({ id: `bush-${k}`, sets: { old: one(`${A}plants/bush-${src}.glb`), new: one(`${G}plants/bush-${k}.glb`) }, views: AROUND })),
  ...SHELLS.map(k => ({ id: `shell-${k}`, sets: { old: one(`${A}props/shell-${k}.glb`), r1: one(`${R1}shell-${k}.glb`), new: one(`${G}forage/shell-${k}.glb`) }, views: [...TWO, ["top", FRONT, 70]] })),
  { id: "fence-straight", sets: { old: [{ url: `${A}props/fence-country-b.glb`, at: [-0.6, 0, 0] }, { url: `${A}props/fence-country-b.glb`, at: [0.6, 0, 0] }], new: fenceRun([[-1, 0], [0, 0], [1, 0]]) }, views: TWO },
  { id: "fence-shapes", sets: { new: fenceRun([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [4, 0], [4, 1], [5, 1], [3, 1], [6, 2], [7, 2]]) }, views: [["q", FRONT + 35, 34], ["top", FRONT + 20, 62]] },
  { id: "fence-post", sets: { new: fenceRun([[0, 0]]) }, views: TWO },
  { id: "study-table-classic", sets: {
    old: [{ url: `${A}furniture/reading-table.glb`, scale: 0.1, at: [0.49, 0, 0] }, { url: `${A}furniture/reading-table.glb`, scale: 0.1, at: [-0.49, 0, 0] }, { url: `${R1}lounge-book.glb`, scale: 0.065, at: [0.15, 0.84, 0], rotY: 0.3 }],
    new: [{ url: `${G}props/study-table-classic-long.glb` }, { url: `${G}props/study-book.glb`, scale: 0.65, at: [0.15, 0.848, 0], rotY: 0.3 }],
    r1: [{ url: `${G}props/study-table-long.glb` }, { url: `${G}props/study-book.glb`, scale: 0.65, at: [0.15, 0.848, 0], rotY: 0.3 }],
  }, views: TWO },
  { id: "study-table-classic-pier", sets: {
    old: [{ url: `${A}furniture/reading-table.glb`, scale: 0.1 }, { url: `${R1}lounge-book.glb`, scale: 0.065, at: [0.15, 0.84, 0], rotY: 0.3 }],
    new: [{ url: `${G}props/study-table-classic.glb` }, { url: `${G}props/study-book.glb`, scale: 0.65, at: [0.15, 0.848, 0], rotY: 0.3 }],
    r1: [{ url: `${G}props/study-table.glb` }, { url: `${G}props/study-book.glb`, scale: 0.65, at: [0.15, 0.848, 0], rotY: 0.3 }],
  }, views: TWO },
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
const key = new THREE.DirectionalLight("#fff3df", 2.2); key.position.set(-2.5, 4, -3.5);
const fill = new THREE.DirectionalLight("#e4ecff", 0.5); fill.position.set(3, 1.2, -2);
const rim = new THREE.DirectionalLight("#ffffff", 0.5); rim.position.set(0.5, 2, 4);
scene.add(key, fill, rim);
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 5000);
const loader = new GLTFLoader();
const deg = THREE.MathUtils.degToRad;
async function group(parts) {
  const g = new THREE.Group();
  for (const p of parts) {
    const gltf = await loader.loadAsync(p.url);
    const m = gltf.scene.clone(true);
    m.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(x => /shadow/i.test(x.name))) { o.visible = false; return; }
      for (const x of mats) {
        x.side = THREE.DoubleSide; if (x.emissiveMap) x.emissiveIntensity = 0;
        // The closed bushes shade both faces by their outward normals, as lib/game/modelMaterials.ts draws them.
        if (p.url.includes("/game/plants/bush-")) x.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", THREE.ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", "")); };
      }
    });
    const holder = new THREE.Group();
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
window.__item = async (sets, views) => {
  const groups = {}, boxes = {};
  for (const [name, parts] of Object.entries(sets)) { groups[name] = await group(parts); boxes[name] = boxOf(groups[name]); }
  const all = Object.values(boxes).reduce((a, b) => a.clone().union(b));
  const centre = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 1e-3);
  const out = { bounds: Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, { min: b.min.toArray(), max: b.max.toArray() }])) };
  for (const [name, g] of Object.entries(groups)) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62, 48), new THREE.MeshBasicMaterial({ color: "#e2d6bb" }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(centre.x, 0, centre.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(size.x, size.z) * 0.62, Math.max(size.x, size.z) * 0.64, 64), new THREE.MeshBasicMaterial({ color: "#b9a77f", side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(centre.x, 0.0005 * r, centre.z);
    scene.add(g, disc, ring);
    for (const [view, az, el] of views) {
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
for (const it of ITEMS) {
  try {
    const r = await page.evaluate(([s, v]) => window.__item(s, v), [it.sets, it.views]);
    for (const [k, v] of Object.entries(r)) if (k !== "bounds") writeFileSync(join(outDir, `${it.id}.${k}.png`), Buffer.from(v.split(",")[1], "base64"));
    meta[it.id] = r.bounds;
    console.log("item", it.id, JSON.stringify(r.bounds));
  } catch (e) { console.log("FAILED", it.id, String(e).split("\n")[0].slice(0, 200)); }
}
writeFileSync(metaFile, JSON.stringify(meta, null, 1));
await browser.close();
server.close();
