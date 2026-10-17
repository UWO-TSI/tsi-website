// Remodel evidence (game/remodel-nature), from the asset audit's turntable (specs/asset-audit/tools/turntable.mjs on
// game/asset-audit): clean views of GLBs, front and three-quarter, the same stage and light for the old and the new.
// Serves its own page plus web/public/assets and three.js from web/node_modules on PORT (default 3183); headless,
// muted. No dev server needed. Run from web/:
//   PORT=3183 node ../art/nature/evidence/turntable.mjs <out-dir> <list.txt>   (one /assets/... path per line)
// Writes <out-dir>/<slug>.front.png and <slug>.q.png (480 px, cream ground, a tan disc at the model's origin so
// floating and sinking read), where slug is the path under /assets with "/" turned to "__". FIT=<units> frames every
// model at that size instead of its own (so a family keeps its relative sizes). LEAF=<hex> tints the ACNH oaks' grey
// leaves and trunk as the game does (lib/game/modelMaterials.ts: the season's leaf colour x 1.6, the atlas contrast
// compressed), so a "before" oak shows its in-game colour.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, listFile] = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 3183), SIZE = Number(process.env.SIZE ?? 480), FIT = Number(process.env.FIT ?? 0);
const LEAF = JSON.stringify(process.env.LEAF ?? "");
const WEB = process.cwd();
const list = readFileSync(listFile, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
mkdirSync(outDir, { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4efe3">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const SIZE = ${SIZE}, FIT = ${FIT}, LEAF = ${LEAF};
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
window.__tt = async (url) => {
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;
  model.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // The game hides shadow-caster hulls and draws every face double sided (lib/game/modelMaterials.ts).
    if (mats.some(m => /shadow/i.test(m.name))) { o.visible = false; return; }
    for (const m of mats) {
      m.side = THREE.DoubleSide;
      if (LEAF && /OakLeaf/.test(m.name) && !/Snow/.test(m.name)) {
        m.color.set(LEAF).multiplyScalar(1.6);
        m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb = diffuse * (0.065 + 0.9 * sampledDiffuseColor.rgb);\n#endif"); };
      }
      if (LEAF && /OakTrunk/.test(m.name)) m.color.set("#b88c58").multiplyScalar(1.7);
    }
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o, true); });
  const centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = FIT || Math.max(size.length() / 2, 1e-3);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62, 48), new THREE.MeshBasicMaterial({ color: "#e2d6bb" }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0;
  const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(size.x, size.z) * 0.62, Math.max(size.x, size.z) * 0.64, 64), new THREE.MeshBasicMaterial({ color: "#b9a77f", side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0005 * r;
  scene.add(model, disc, ring);
  const out = {};
  for (const [name, az, el] of [["front", 0, 14], ["q", 35, 26]]) {
    const dir = new THREE.Vector3(Math.sin(deg(az)) * Math.cos(deg(el)), Math.sin(deg(el)), Math.cos(deg(az)) * Math.cos(deg(el)));
    const dist = r / Math.sin(deg(15)) * 1.05;
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix();
    camera.lookAt(centre);
    renderer.render(scene, camera);
    out[name] = renderer.domElement.toDataURL("image/png");
  }
  scene.remove(model, disc, ring);
  model.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); }); } });
  return { ...out, size: size.toArray(), min: box.min.toArray(), max: box.max.toArray() };
};
window.__ready = true;
</script>`;

const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" || url === "/tt.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const file = url.startsWith("/three/") ? join(WEB, "node_modules", url.slice(1)) : url.startsWith("/assets/") ? join(WEB, "public", url) : null;
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
const meta = {};
let ok = 0;
for (const url of list) {
  const slug = url.replace(/^\/assets\//, "").replace(/\.glb$/, "").replaceAll("/", "__");
  try {
    const r = await page.evaluate(u => window.__tt(u), url);
    for (const v of ["front", "q"]) writeFileSync(join(outDir, `${slug}.${v}.png`), Buffer.from(r[v].split(",")[1], "base64"));
    meta[url] = { size: r.size, min: r.min, max: r.max };
    ok++;
  } catch (e) { console.log("FAILED", url, String(e).split("\n")[0].slice(0, 160)); }
}
writeFileSync(join(outDir, "meta.json"), JSON.stringify(meta));
console.log(`turntable: ${ok}/${list.length}`);
await browser.close();
server.close();
